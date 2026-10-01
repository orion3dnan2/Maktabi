-- Foundation: additive office membership, case teams and retry-safe versioned writes.
create table public.office_members (
  office_id uuid not null references public.offices(id),
  user_id uuid not null references public.profiles(id),
  role public.app_role not null check (role <> 'client'),
  status text not null default 'active' check (status in ('active','suspended','invited')),
  joined_at timestamptz, created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  primary key (office_id,user_id)
);
alter table public.office_members enable row level security;
insert into public.office_members(office_id,user_id,role,status,joined_at)
select office_id,id,role,case when is_active then 'active' else 'suspended' end,created_at
from public.profiles where office_id is not null and role in ('admin','lawyer','employee','reception');

create function private.sync_profile_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.office_id is distinct from new.office_id then
    update public.office_members set status='suspended' where user_id=old.id and office_id=old.office_id;
  end if;
  if new.office_id is not null and new.role in ('admin','lawyer','employee','reception') then
    insert into public.office_members(office_id,user_id,role,status,joined_at,created_by)
    values(new.office_id,new.id,new.role,case when new.is_active then 'active' else 'suspended' end,now(),auth.uid())
    on conflict(office_id,user_id) do update set role=excluded.role,status=excluded.status;
  elsif new.office_id is not null then
    update public.office_members set status='suspended' where office_id=new.office_id and user_id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.sync_profile_membership() from public;
create trigger profiles_membership after insert or update of office_id,role,is_active on public.profiles
for each row execute function private.sync_profile_membership();

create function private.office_role(p_office uuid) returns public.app_role
language sql stable security definer set search_path='' as $$
select m.role from public.office_members m
join public.offices o on o.id=m.office_id
join public.profiles p on p.id=m.user_id
where m.office_id=p_office and m.user_id=auth.uid() and m.status='active'
and p.is_active and o.status='active'
$$;
revoke all on function private.office_role(uuid) from public;
grant execute on function private.office_role(uuid) to authenticated;
create or replace function private.current_office_id() returns uuid
language sql stable security definer set search_path='' as $$
select p.office_id from public.profiles p where p.id=auth.uid() and private.office_role(p.office_id) is not null
$$;
create or replace function private.current_app_role() returns public.app_role
language sql stable security definer set search_path='' as $$
select private.office_role(p.office_id) from public.profiles p where p.id=auth.uid()
$$;
grant select on public.office_members to authenticated;
grant all on public.office_members to service_role;
create policy office_members_select on public.office_members for select to authenticated
using (user_id=auth.uid() or private.office_role(office_id)='admin');
create index office_members_user_idx on public.office_members(user_id,office_id);

alter table public.clients add column revision integer not null default 1;
alter table public.matters add column revision integer not null default 1;
alter table public.matter_parties add column is_primary boolean not null default false;
create unique index matter_parties_primary_idx on public.matter_parties(matter_id) where is_primary;
create function private.bump_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
revoke all on function private.bump_revision() from public;
create trigger clients_revision before update on public.clients for each row execute function private.bump_revision();
create trigger matters_revision before update on public.matters for each row execute function private.bump_revision();

create table public.matter_assignments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null, matter_id uuid not null, user_id uuid not null,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(), assigned_by uuid default auth.uid() references public.profiles(id),
  ended_at timestamptz,
  foreign key(office_id,matter_id) references public.matters(office_id,id),
  foreign key(office_id,user_id) references public.office_members(office_id,user_id)
);
alter table public.matter_assignments enable row level security;
create unique index assignments_active_member_idx on public.matter_assignments(matter_id,user_id) where ended_at is null;
create unique index assignments_primary_idx on public.matter_assignments(matter_id) where ended_at is null and is_primary;
create index assignments_user_idx on public.matter_assignments(user_id,matter_id) where ended_at is null;
insert into public.matter_assignments(office_id,matter_id,user_id,is_primary,assigned_by)
select office_id,id,assigned_lawyer_id,true,created_by from public.matters where assigned_lawyer_id is not null;

create or replace function private.can_access_matter(p_matter uuid) returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from public.matters m where m.id=p_matter and (
 private.office_role(m.office_id) in ('admin','employee')
 or (private.office_role(m.office_id)='lawyer' and (
   m.created_by=auth.uid() or m.assigned_lawyer_id=auth.uid()
   or exists(select 1 from public.matter_assignments a where a.office_id=m.office_id and a.matter_id=m.id and a.user_id=auth.uid() and a.ended_at is null)
 ))
))
$$;
create or replace function private.lawyer_can_see_client(p_client uuid) returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from public.matters m where m.client_id=p_client and private.can_access_matter(m.id))
or exists(select 1 from public.matter_parties p where p.client_id=p_client and private.can_access_matter(p.matter_id))
$$;
drop policy matters_select on public.matters;
create policy matters_select on public.matters for select to authenticated using(private.can_access_matter(id));
drop policy matters_update on public.matters;
create policy matters_update on public.matters for update to authenticated using(private.can_access_matter(id))
with check(private.can_access_matter(id));
drop policy clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using(
 private.office_role(office_id) in ('admin','employee','reception')
 or (private.office_role(office_id)='lawyer' and (created_by=auth.uid() or private.lawyer_can_see_client(id))));
drop policy clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using(
 private.office_role(office_id) in ('admin','employee','reception')
 or (private.office_role(office_id)='lawyer' and (created_by=auth.uid() or private.lawyer_can_see_client(id))))
with check(office_id=private.current_office_id() and private.is_staff());

grant select,insert,update on public.matter_assignments to authenticated;
grant all on public.matter_assignments to service_role;
create policy assignment_select on public.matter_assignments for select to authenticated using(private.can_access_matter(matter_id));
create policy assignment_insert on public.matter_assignments for insert to authenticated with check(private.office_role(office_id)='admin' and assigned_by=auth.uid());
create policy assignment_update on public.matter_assignments for update to authenticated using(private.office_role(office_id)='admin') with check(private.office_role(office_id)='admin');
create function private.guard_assignment() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.office_id is distinct from old.office_id or new.matter_id is distinct from old.matter_id or new.user_id is distinct from old.user_id or new.assigned_by is distinct from old.assigned_by or new.assigned_at is distinct from old.assigned_at) then
    raise exception 'immutable assignment identity' using errcode='42501';
  end if;
  if new.ended_at is null and not exists(select 1 from public.office_members m where m.office_id=new.office_id and m.user_id=new.user_id and m.status='active'
    and (not new.is_primary or m.role in ('lawyer','admin'))) then
    raise exception 'assignee must be an active office member; primary must be lawyer/admin' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_assignment() from public;
create trigger assignment_guard before insert or update on public.matter_assignments for each row execute function private.guard_assignment();
create trigger assignment_audit after insert or update on public.matter_assignments for each row execute function private.audit_row('matter_assignment');

-- Only caller's mutation receipts are exposed. No legal payload in this table.
create table public.sync_receipts (
 office_id uuid not null references public.offices(id), user_id uuid not null default auth.uid() references public.profiles(id),
 operation_id uuid not null, entity_id uuid not null, kind text not null check(kind in ('client','matter','assignment')),
 request_hash text not null, revision integer not null, created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.sync_receipts enable row level security;
grant select,insert on public.sync_receipts to authenticated;
grant all on public.sync_receipts to service_role;
create policy receipts_select on public.sync_receipts for select to authenticated using(user_id=auth.uid() and private.office_role(office_id) is not null);
create policy receipts_insert on public.sync_receipts for insert to authenticated with check(user_id=auth.uid() and private.office_role(office_id) is not null);

create function public.sync_client(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_revision integer; v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex'); v_receipt public.sync_receipts;
begin
  if private.office_role(p_office) is null or p_office is distinct from private.current_office_id() then raise exception 'office access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
  select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
  if found then
    if v_receipt.request_hash<>v_hash or v_receipt.kind<>'client' then raise exception 'mutation id reused' using errcode='22023'; end if;
    return v_receipt.revision;
  end if;
  if length(trim(coalesce(p_data->>'displayName','')))=0 or p_data->>'kind' not in ('PERSON','ORGANIZATION') or length(coalesce(p_data->>'phone',''))<7 then raise exception 'invalid client fields' using errcode='22023'; end if;
  select revision into v_revision from public.clients where id=p_id and office_id=p_office for update;
  if coalesce(v_revision,0)<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
  if v_revision is null then
    insert into public.clients(id,office_id,full_name,client_type,phone,whatsapp,email,address,contact_person,registration_number,civil_id,notes)
    values(p_id,p_office,trim(p_data->>'displayName'),case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,p_data->>'phone',p_data->>'whatsapp',nullif(p_data->>'email',''),p_data->>'address',p_data->>'contactPerson',p_data->>'registration',p_data->>'nationalId',p_data->>'notes') returning revision into v_revision;
  else
    update public.clients set full_name=trim(p_data->>'displayName'),client_type=case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,
    phone=p_data->>'phone',whatsapp=p_data->>'whatsapp',email=nullif(p_data->>'email',''),address=p_data->>'address',contact_person=p_data->>'contactPerson',registration_number=p_data->>'registration',civil_id=p_data->>'nationalId',notes=p_data->>'notes'
    where id=p_id and office_id=p_office returning revision into v_revision;
    if not found then raise exception 'client update denied' using errcode='42501'; end if;
  end if;
  insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'client',v_hash,v_revision);
  return v_revision;
end $$;
revoke all on function public.sync_client(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_client(uuid,uuid,uuid,integer,jsonb) to authenticated;

create function public.sync_matter(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_revision integer; v_client uuid; v_party jsonb; v_receipt public.sync_receipts;
v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex');
begin
 if private.office_role(p_office) not in ('admin','employee','lawyer') or private.office_role(p_office) is null or p_office is distinct from private.current_office_id() then raise exception 'case access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
 select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
 if found then if v_receipt.request_hash<>v_hash or v_receipt.kind<>'matter' then raise exception 'mutation id reused' using errcode='22023'; end if; return v_receipt.revision; end if;
 if length(trim(coalesce(p_data->>'title','')))=0 or length(trim(coalesce(p_data->>'reference','')))=0 or length(trim(coalesce(p_data->>'authority','')))=0
 or p_data->>'status' not in ('ACTIVE','ON_HOLD','CLOSED','ARCHIVED') or p_data->>'type' not in ('CRIMINAL','CIVIL','PERSONAL_STATUS','LABOUR','SPECIAL_COURT','COMMERCIAL_REGISTRY','LAND_REGISTRY','NOTARIZATION','OTHER')
 or jsonb_typeof(p_data->'details')<>'object'
 or (select count(*) from jsonb_array_elements(p_data->'parties') p where (p->>'isPrimary')::boolean and p->>'role'='CLIENT' and p->>'clientId' is not null)<>1 then raise exception 'invalid case fields' using errcode='22023'; end if;
 select (p->>'clientId')::uuid into v_client from jsonb_array_elements(p_data->'parties') p where (p->>'isPrimary')::boolean;
 if not exists(select 1 from public.clients where office_id=p_office and id=v_client) then raise exception 'client access denied' using errcode='42501'; end if;
 select revision into v_revision from public.matters where id=p_id and office_id=p_office for update;
 if coalesce(v_revision,0)<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
 if v_revision is null then
  insert into public.matters(id,office_id,client_id,matter_number,title,matter_type,court_name,status,opened_at,details,description)
  values(p_id,p_office,v_client,trim(p_data->>'reference'),trim(p_data->>'title'),lower(p_data->>'type')::public.matter_type,p_data->>'authority',
   (case p_data->>'status' when 'ACTIVE' then 'open' else lower(p_data->>'status') end)::public.matter_status,(p_data->>'openedAt')::date,p_data->'details',p_data->>'notes') returning revision into v_revision;
 else
  update public.matters set client_id=v_client,matter_number=trim(p_data->>'reference'),title=trim(p_data->>'title'),matter_type=lower(p_data->>'type')::public.matter_type,court_name=p_data->>'authority',
  status=(case p_data->>'status' when 'ACTIVE' then 'open' else lower(p_data->>'status') end)::public.matter_status,opened_at=(p_data->>'openedAt')::date,details=p_data->'details',description=p_data->>'notes'
  where id=p_id and office_id=p_office returning revision into v_revision;
  if not found then raise exception 'case update denied' using errcode='42501'; end if;
 end if;
 delete from public.matter_parties where matter_id=p_id and office_id=p_office;
 for v_party in select value from jsonb_array_elements(p_data->'parties') loop
  if v_party->>'clientId' is not null and not exists(select 1 from public.clients where id=(v_party->>'clientId')::uuid and office_id=p_office) then raise exception 'party client access denied' using errcode='42501'; end if;
  insert into public.matter_parties(id,office_id,matter_id,client_id,display_name,party_role,is_primary)
  values((v_party->>'id')::uuid,p_office,p_id,(v_party->>'clientId')::uuid,v_party->>'displayName',lower(v_party->>'role')::public.party_role,coalesce((v_party->>'isPrimary')::boolean,false));
 end loop;
 insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'matter',v_hash,v_revision);
 return v_revision;
end $$;
revoke all on function public.sync_matter(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_matter(uuid,uuid,uuid,integer,jsonb) to authenticated;

create function public.sync_assignment(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_revision integer; v_user uuid:=(p_data->>'userId')::uuid; v_primary boolean:=coalesce((p_data->>'isPrimary')::boolean,false);
v_remove boolean:=coalesce((p_data->>'remove')::boolean,false); v_receipt public.sync_receipts;
v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex');
begin
 if private.office_role(p_office) is distinct from 'admin' then raise exception 'admin only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
 select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
 if found then if v_receipt.request_hash<>v_hash or v_receipt.kind<>'assignment' then raise exception 'mutation id reused' using errcode='22023'; end if; return v_receipt.revision; end if;
 select revision into v_revision from public.matters where id=p_id and office_id=p_office for update;
 if v_revision is null then raise exception 'case access denied' using errcode='42501'; end if;
 if v_revision<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
 if v_remove then
  update public.matter_assignments set ended_at=now() where office_id=p_office and matter_id=p_id and user_id=v_user and ended_at is null;
  update public.matters set assigned_lawyer_id=case when assigned_lawyer_id=v_user then null else assigned_lawyer_id end where id=p_id returning revision into v_revision;
 else
  if not exists(select 1 from public.office_members where office_id=p_office and user_id=v_user and status='active' and (not v_primary or role in ('admin','lawyer'))) then raise exception 'invalid assignee' using errcode='23514'; end if;
  update public.matter_assignments set ended_at=now() where office_id=p_office and matter_id=p_id and ended_at is null and (user_id=v_user or (v_primary and is_primary));
  insert into public.matter_assignments(office_id,matter_id,user_id,is_primary) values(p_office,p_id,v_user,v_primary);
  update public.matters set assigned_lawyer_id=case when v_primary then v_user when assigned_lawyer_id=v_user then null else assigned_lawyer_id end where id=p_id returning revision into v_revision;
 end if;
 insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'assignment',v_hash,v_revision);
 return v_revision;
end $$;
revoke all on function public.sync_assignment(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_assignment(uuid,uuid,uuid,integer,jsonb) to authenticated;
