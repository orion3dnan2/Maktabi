-- Phase 1: platform owner, phone-based accounts created server-side, client portal.
--
-- Accounts are created only by the manage-users Edge Function (service role):
--   * the platform owner creates offices and their first admin;
--   * an office admin creates staff (admin / lawyer / employee / reception);
--   * an office admin or employee creates a portal login for a client record.
-- Nobody signs up from the app. The svc_* functions below are executable by
-- service_role only; the function passes the verified caller id as p_actor.

------------------------------------------------------------------------------
-- 1. Client portal accounts: a profile with role 'client' points at one client
--    record of the same office.
------------------------------------------------------------------------------
alter table public.profiles add column client_id uuid;
alter table public.profiles
  add constraint profiles_client_same_office_fkey foreign key (office_id, client_id)
  references public.clients (office_id, id) on delete restrict;
alter table public.profiles
  add constraint profiles_client_role_matches_client
  check ((role is not distinct from 'client'::public.app_role) = (client_id is not null));
create index profiles_client_id_idx on public.profiles (client_id) where client_id is not null;
comment on column public.profiles.client_id is 'Set only for role = client: the client record this portal login belongs to. Managed by trusted server code.';

-- Identity, membership and client link cannot be changed through the API.
create or replace function private.guard_profiles()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare v_uid uuid := (select auth.uid());
begin
  if private.is_api_caller() then
    if new.id is distinct from old.id or new.email is distinct from old.email or new.created_at is distinct from old.created_at then
      raise exception 'identity fields cannot be changed' using errcode = '42501';
    end if;
    if new.office_id is distinct from old.office_id then
      raise exception 'office membership is managed by an administrator' using errcode = '42501';
    end if;
    if new.client_id is distinct from old.client_id then
      raise exception 'client portal links are managed by the office' using errcode = '42501';
    end if;
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      if private.current_app_role() is distinct from 'admin' or old.office_id is distinct from private.current_office_id() then
        raise exception 'only an office admin can change roles or activation' using errcode = '42501';
      end if;
      if old.id = v_uid then
        raise exception 'admins cannot change their own role or activation' using errcode = '42501';
      end if;
    end if;
  end if;

  if old.role = 'admin' and old.is_active
     and (new.role is distinct from 'admin' or not new.is_active or new.office_id is distinct from old.office_id)
     and not exists (select 1 from public.profiles p where p.office_id = old.office_id and p.role = 'admin' and p.is_active and p.id <> old.id) then
    raise exception 'an office must keep at least one active admin' using errcode = '23514';
  end if;
  return new;
end $function$;

-- Staff = any office role except client. Used to keep portal accounts out of
-- every staff policy (clients only read their data through portal_overview()).
create or replace function private.is_staff()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(private.current_app_role() in ('admin', 'lawyer', 'employee', 'reception'), false);
$function$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to authenticated;

------------------------------------------------------------------------------
-- 2. Close the policies that only checked "has any role".
------------------------------------------------------------------------------
drop policy appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.is_staff()));

drop policy clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.is_staff()));

drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    office_id = (select private.current_office_id()) and (select private.is_staff())
    and ((select private.current_app_role()) = any (array['admin', 'employee', 'lawyer']::public.app_role[]) or assigned_to = (select auth.uid()))
  );

drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    office_id = (select private.current_office_id()) and (select private.is_staff())
    and ((select private.current_app_role()) = any (array['admin', 'employee']::public.app_role[])
      or assigned_to = (select auth.uid()) or created_by = (select auth.uid())
      or ((select private.current_app_role()) = 'lawyer' and matter_id is not null and private.can_access_matter(matter_id)))
  );

drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    office_id = (select private.current_office_id()) and (select private.is_staff())
    and ((select private.current_app_role()) = any (array['admin', 'employee']::public.app_role[])
      or assigned_to = (select auth.uid()) or created_by = (select auth.uid())
      or ((select private.current_app_role()) = 'lawyer' and matter_id is not null and private.can_access_matter(matter_id)))
  )
  with check (
    office_id = (select private.current_office_id()) and (select private.is_staff())
    and ((select private.current_app_role()) = any (array['admin', 'employee', 'lawyer']::public.app_role[]) or assigned_to = (select auth.uid()))
  );

-- Portal accounts see only their own profile, not the office's staff list.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (office_id = (select private.current_office_id()) and (select private.is_staff())));

-- The office row (settings etc.) is for staff; portal gets name/phone via portal_overview().
drop policy offices_select on public.offices;
create policy offices_select on public.offices for select to authenticated
  using (id = (select private.current_office_id()) and (select private.is_staff()));

------------------------------------------------------------------------------
-- 3. Platform owner.
------------------------------------------------------------------------------
create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table private.platform_admins is 'Platform owners: may create offices and suspend them. Not an office role.';

create table private.bootstrap_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null
);
comment on table private.bootstrap_codes is 'One-time codes (sha256 hex) that let the first platform owner create their account. Consumed on use.';

create or replace function private.is_platform_admin(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p_user is not null and exists (select 1 from private.platform_admins a where a.user_id = p_user);
$function$;
revoke all on function private.is_platform_admin(uuid) from public;

------------------------------------------------------------------------------
-- 4. What the signed-in user may open (used by the app to route).
------------------------------------------------------------------------------
create or replace function public.my_access()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'user_id', p.id,
    'full_name', p.full_name,
    'phone', p.phone,
    'role', p.role,
    'is_active', p.is_active,
    'client_id', p.client_id,
    'office', case when o.id is null then null else jsonb_build_object('id', o.id, 'name', coalesce(o.name_ar, o.name), 'status', o.status) end,
    'platform_admin', private.is_platform_admin(p.id)
  )
  from public.profiles p
  left join public.offices o on o.id = p.office_id
  where p.id = (select auth.uid());
$function$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

------------------------------------------------------------------------------
-- 5. Platform owner screens.
------------------------------------------------------------------------------
create or replace function public.platform_list_offices()
 returns table (id uuid, name text, name_ar text, phone text, country bpchar, status public.office_status, created_at timestamptz, members bigint, admins jsonb)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not private.is_platform_admin((select auth.uid())) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  return query
    select o.id, o.name, o.name_ar, o.phone, o.country, o.status, o.created_at,
      (select count(*) from public.profiles p where p.office_id = o.id and p.role <> 'client'),
      coalesce((select jsonb_agg(jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'is_active', p.is_active) order by p.created_at)
                from public.profiles p where p.office_id = o.id and p.role = 'admin'), '[]'::jsonb)
    from public.offices o
    order by o.created_at desc;
end $function$;
revoke all on function public.platform_list_offices() from public, anon;
grant execute on function public.platform_list_offices() to authenticated;

create or replace function public.platform_set_office_status(p_office uuid, p_status public.office_status)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_platform_admin((select auth.uid())) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  update public.offices set status = p_status where id = p_office;
  if not found then raise exception 'office not found' using errcode = 'P0002'; end if;
  perform private.write_audit(p_office, 'office_status_changed', 'office', p_office, jsonb_build_object('status', p_status));
end $function$;
revoke all on function public.platform_set_office_status(uuid, public.office_status) from public, anon;
grant execute on function public.platform_set_office_status(uuid, public.office_status) to authenticated;

------------------------------------------------------------------------------
-- 6. Trusted helpers for the manage-users Edge Function (service_role only).
------------------------------------------------------------------------------
create or replace function public.svc_bootstrap_code_valid(p_code_hash text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select not exists (select 1 from private.platform_admins)
     and exists (select 1 from private.bootstrap_codes c where c.code_hash = p_code_hash and c.expires_at > now());
$function$;

create or replace function public.svc_bootstrap_owner(p_code_hash text, p_user uuid, p_full_name text, p_phone text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  lock table private.platform_admins in exclusive mode;
  if exists (select 1 from private.platform_admins) then return false; end if;
  delete from private.bootstrap_codes where code_hash = p_code_hash and expires_at > now();
  if not found then return false; end if;
  delete from private.bootstrap_codes;
  insert into private.platform_admins (user_id) values (p_user);
  update public.profiles set full_name = left(btrim(p_full_name), 200), phone = p_phone where id = p_user;
  return true;
end $function$;

create or replace function public.svc_create_office(
  p_actor uuid, p_admin uuid, p_admin_name text, p_admin_phone text,
  p_name text, p_name_ar text, p_phone text,
  p_country bpchar default 'SD', p_currency bpchar default 'SDG', p_timezone text default 'Africa/Khartoum')
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_office uuid;
begin
  if not private.is_platform_admin(p_actor) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_admin and p.office_id is not null) then
    raise exception 'user already belongs to an office' using errcode = '23505';
  end if;
  insert into public.offices (name, name_ar, phone, country, default_currency, timezone)
  values (btrim(p_name), nullif(btrim(coalesce(p_name_ar, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''), p_country, p_currency, p_timezone)
  returning id into v_office;
  update public.profiles
     set office_id = v_office, role = 'admin', is_active = true, full_name = left(btrim(p_admin_name), 200), phone = p_admin_phone
   where id = p_admin;
  if not found then raise exception 'admin profile not found' using errcode = 'P0002'; end if;
  perform private.write_audit(v_office, 'office_created', 'office', v_office, jsonb_build_object('admin_user_id', p_admin, 'by_platform_admin', p_actor));
  return v_office;
end $function$;

create or replace function public.svc_add_member(p_actor uuid, p_user uuid, p_role public.app_role, p_full_name text, p_phone text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_office uuid;
begin
  select p.office_id into v_office
    from public.profiles p join public.offices o on o.id = p.office_id
   where p.id = p_actor and p.role = 'admin' and p.is_active and o.status = 'active';
  if v_office is null then raise exception 'only an active office admin can add members' using errcode = '42501'; end if;
  if p_role is null or p_role = 'client' then raise exception 'invalid staff role' using errcode = '22023'; end if;
  update public.profiles
     set office_id = v_office, role = p_role, is_active = true, full_name = left(btrim(p_full_name), 200), phone = p_phone
   where id = p_user and office_id is null;
  if not found then raise exception 'user already belongs to an office' using errcode = '23505'; end if;
  return v_office;
end $function$;

create or replace function public.svc_link_client_login(p_actor uuid, p_user uuid, p_client uuid, p_phone text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_office uuid; v_name text;
begin
  select p.office_id into v_office
    from public.profiles p join public.offices o on o.id = p.office_id
   where p.id = p_actor and p.role in ('admin', 'employee') and p.is_active and o.status = 'active';
  if v_office is null then raise exception 'only an office admin or employee can create client logins' using errcode = '42501'; end if;
  select c.full_name into v_name from public.clients c where c.id = p_client and c.office_id = v_office;
  if v_name is null then raise exception 'client not found in this office' using errcode = 'P0002'; end if;
  update public.profiles
     set office_id = v_office, role = 'client', client_id = p_client, is_active = true, full_name = left(v_name, 200), phone = p_phone
   where id = p_user and office_id is null;
  if not found then raise exception 'user already belongs to an office' using errcode = '23505'; end if;
  perform private.write_audit(v_office, 'client_login_created', 'client', p_client, jsonb_build_object('user_id', p_user, 'by', p_actor));
  return v_office;
end $function$;

-- May p_actor reset p_target's password? Platform owner: anyone. Office admin:
-- anyone in the office. Office employee: client portal accounts of the office.
create or replace function public.svc_can_manage_user(p_actor uuid, p_target uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select private.is_platform_admin(p_actor) or exists (
    select 1
      from public.profiles a
      join public.offices o on o.id = a.office_id and o.status = 'active'
      join public.profiles t on t.office_id = a.office_id
     where a.id = p_actor and t.id = p_target and a.is_active
       and (a.role = 'admin' or (a.role = 'employee' and t.role = 'client'))
  );
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.svc_bootstrap_code_valid(text)',
    'public.svc_bootstrap_owner(text, uuid, text, text)',
    'public.svc_create_office(uuid, uuid, text, text, text, text, text, bpchar, bpchar, text)',
    'public.svc_add_member(uuid, uuid, public.app_role, text, text)',
    'public.svc_link_client_login(uuid, uuid, uuid, text)',
    'public.svc_can_manage_user(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 7. Client portal: one read-only call returning only client-facing fields.
------------------------------------------------------------------------------
create or replace function public.portal_overview()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_client uuid; v_office uuid;
begin
  select p.client_id, p.office_id into v_client, v_office
    from public.profiles p join public.offices o on o.id = p.office_id
   where p.id = (select auth.uid()) and p.role = 'client' and p.is_active and o.status = 'active';
  if v_client is null then
    raise exception 'portal access is only for active client accounts' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'client', (select jsonb_build_object('id', c.id, 'full_name', c.full_name) from public.clients c where c.id = v_client),
    'office', (select jsonb_build_object('name', coalesce(o.name_ar, o.name), 'phone', o.phone, 'address', o.address) from public.offices o where o.id = v_office),
    'matters', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'matter_number', m.matter_number, 'title', m.title, 'matter_type', m.matter_type,
               'status', m.status, 'court_name', m.court_name, 'case_number', m.case_number,
               'opened_at', m.opened_at, 'closed_at', m.closed_at, 'lawyer_name', l.full_name)
             order by m.opened_at desc)
        from public.matters m
        left join public.profiles l on l.id = m.assigned_lawyer_id
       where m.office_id = v_office and m.status <> 'archived'
         and (m.client_id = v_client or exists (
               select 1 from public.matter_parties mp
                where mp.office_id = v_office and mp.matter_id = m.id and mp.client_id = v_client and mp.party_role = 'client'))
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'title', a.title, 'appointment_type', a.appointment_type, 'starts_at', a.starts_at,
               'ends_at', a.ends_at, 'location', a.location, 'status', a.status, 'matter_title', m.title)
             order by a.starts_at)
        from public.appointments a
        left join public.matters m on m.id = a.matter_id
       where a.office_id = v_office
         and a.appointment_type in ('court_session', 'client_meeting', 'consultation')
         and a.status in ('scheduled', 'confirmed')
         and a.starts_at >= now() - interval '1 day'
         and (a.client_id = v_client or m.client_id = v_client or exists (
               select 1 from public.matter_parties mp
                where mp.office_id = v_office and mp.matter_id = a.matter_id and mp.client_id = v_client and mp.party_role = 'client'))
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pay.id, 'amount', pay.amount, 'currency', pay.currency, 'payment_type', pay.payment_type,
               'payment_method', pay.payment_method, 'payment_status', pay.payment_status,
               'reference_number', pay.reference_number, 'paid_at', pay.paid_at, 'matter_number', m.matter_number)
             order by coalesce(pay.paid_at, pay.created_at) desc)
        from public.payments pay
        left join public.matters m on m.id = pay.matter_id
       where pay.office_id = v_office and pay.client_id = v_client
         and pay.payment_status in ('pending', 'completed', 'refunded')
    ), '[]'::jsonb)
  );
end $function$;
revoke all on function public.portal_overview() from public, anon;
grant execute on function public.portal_overview() to authenticated;
