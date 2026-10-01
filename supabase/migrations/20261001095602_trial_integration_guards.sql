-- Align sync with deployed identity constraints and stamp trusted membership actors.
CREATE OR REPLACE FUNCTION public.sync_client(p_operation uuid, p_office uuid, p_id uuid, p_base_revision integer, p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  if nullif(btrim(p_data->>'nationalId'),'') is not null and exists(select 1 from public.clients where id=p_id and office_id=p_office and id_type is not null and id_type<>'national_id') then raise exception 'existing non-national identity is preserved; identity changes require a dedicated form' using errcode='22023'; end if;
  if p_data ? 'status' and coalesce(p_data->>'status','') not in ('ACTIVE','INACTIVE','ARCHIVED') then raise exception 'invalid client status' using errcode='22023'; end if;
  select revision into v_revision from public.clients where id=p_id and office_id=p_office for update;
  if coalesce(v_revision,0)<>p_base_revision then raise exception 'revision conflict' using errcode='PT409'; end if;
  if v_revision is null then
    insert into public.clients(id,office_id,full_name,client_type,phone,whatsapp,email,address,contact_person,registration_number,civil_id,id_type,notes)
    values(p_id,p_office,trim(p_data->>'displayName'),case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,p_data->>'phone',p_data->>'whatsapp',nullif(p_data->>'email',''),p_data->>'address',p_data->>'contactPerson',nullif(btrim(p_data->>'registration'),''),nullif(btrim(p_data->>'nationalId'),''),case when nullif(btrim(p_data->>'nationalId'),'') is not null then 'national_id'::public.identity_document_type end,p_data->>'notes') returning revision into v_revision;
  else
    update public.clients set full_name=trim(p_data->>'displayName'),client_type=case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,
    phone=p_data->>'phone',whatsapp=p_data->>'whatsapp',email=nullif(p_data->>'email',''),address=p_data->>'address',contact_person=p_data->>'contactPerson',registration_number=p_data->>'registration',civil_id=case when id_type is null or id_type='national_id' then nullif(btrim(p_data->>'nationalId'),'') else civil_id end,
    id_type=case when id_type is null or id_type='national_id' then case when nullif(btrim(p_data->>'nationalId'),'') is not null then 'national_id'::public.identity_document_type end else id_type end,notes=p_data->>'notes',status=case when p_data ? 'status' then lower(p_data->>'status')::public.client_status else status end
    where id=p_id and office_id=p_office returning revision into v_revision;
    if not found then raise exception 'client update denied' using errcode='42501'; end if;
  end if;
  insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'client',v_hash,v_revision);
  return v_revision;
end $function$;


-- Accounts pending approval, rejected, inactive or suspended cannot forge login audit entries.
create or replace function private.log_login_success()
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_office uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='28000'; end if;
  if private.is_platform_admin(v_uid) then
    select office_id into v_office from public.profiles where id=v_uid;
  else
    v_office := private.current_office_id();
    if v_office is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active
       and (p.role='client' or private.office_role(v_office) is not null)) then
      raise exception 'active office membership required' using errcode='42501';
    end if;
  end if;
  perform private.write_audit(v_office,'login_success','auth',v_uid,'{}');
end $$;

-- Count every public attempt, including duplicate phone numbers and failed Auth calls.
-- The global budget applies even when no trustworthy source header is available.
create table private.office_request_attempts (
  id bigint generated always as identity primary key,
  source_hash text check(source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index office_request_attempts_time_idx on private.office_request_attempts(created_at);
create index office_request_attempts_source_idx on private.office_request_attempts(source_hash,created_at);
alter table private.office_request_attempts enable row level security;
revoke all on private.office_request_attempts from public,anon,authenticated;
revoke all on sequence private.office_request_attempts_id_seq from public,anon,authenticated;
create function public.svc_consume_office_request_attempt(p_source_hash text)
returns text language plpgsql security definer set search_path='' as $$
begin
  lock table private.office_request_attempts in share row exclusive mode;
  -- Ephemeral throttling counters contain no business or legal records.
  delete from private.office_request_attempts where created_at < now()-interval '2 days';
  if (select count(*) from private.office_request_attempts where created_at>now()-interval '1 day')>=100 then return 'daily_limit'; end if;
  if p_source_hash is not null and (select count(*) from private.office_request_attempts where source_hash=p_source_hash and created_at>now()-interval '1 day')>=10 then return 'too_many'; end if;
  insert into private.office_request_attempts(source_hash) values(p_source_hash);
  return null;
end $$;
revoke all on function public.svc_consume_office_request_attempt(text) from public,anon,authenticated;
grant execute on function public.svc_consume_office_request_attempt(text) to service_role;
