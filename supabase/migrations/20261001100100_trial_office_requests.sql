-- Trial office requests (طلبات المكاتب التجريبية).
--
-- Anyone can ask for a trial office from the sign-in screen. The manage-users Edge
-- Function (action request_office) creates the requester's account and calls
-- svc_request_office, which creates the office with status 'pending' and makes the
-- requester its admin. A pending or rejected office grants nothing: every policy goes
-- through current_office_id() / current_app_role(), which only accept active offices,
-- and the svc_* helpers also require an active office. The platform owner approves
-- (status 'active') or rejects (status 'rejected') with platform_review_office_request.
--
-- Abuse limits (the request needs no account): at most 20 undecided requests in total,
-- and at most 3 requests a day from one source (a keyed hash of the caller's IP made
-- by the Edge Function; the IP itself is never stored).

create table private.office_requests (
  office_id uuid primary key references public.offices (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  decision text check (decision in ('approved', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  check ((decision is null) = (decided_at is null))
);
create index office_requests_undecided_idx on private.office_requests (created_at) where decision is null;
create index office_requests_source_idx on private.office_requests (source_hash, created_at) where source_hash is not null;
alter table private.office_requests enable row level security;
revoke all on table private.office_requests from public, anon, authenticated;
comment on table private.office_requests is 'Trial offices requested from the sign-in screen and the platform owner''s decision. Written only by svc_request_office and platform_review_office_request.';

------------------------------------------------------------------------------
-- 1. Trusted helpers for the manage-users Edge Function (service_role only).
------------------------------------------------------------------------------
-- Null when a new request is allowed, otherwise why not: 'queue_full' or 'too_many'.
create or replace function public.svc_office_request_limit(p_source_hash text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case
    when (select count(*) from private.office_requests r where r.decision is null) >= 20 then 'queue_full'
    when p_source_hash is not null and (
      select count(*) from private.office_requests r
       where r.source_hash = p_source_hash and r.created_at > now() - interval '1 day') >= 3 then 'too_many'
  end;
$function$;

create or replace function public.svc_request_office(
  p_user uuid, p_admin_name text, p_admin_phone text,
  p_name text, p_phone text, p_note text, p_source_hash text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_office uuid; v_limit text;
begin
  -- One request at a time, so concurrent requests cannot race past the limits.
  lock table private.office_requests in share row exclusive mode;
  v_limit := public.svc_office_request_limit(p_source_hash);
  if v_limit is not null then
    raise exception 'office request limit reached: %', v_limit using errcode = '54000';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.office_id is not null) then
    raise exception 'user already belongs to an office' using errcode = '23505';
  end if;
  insert into public.offices (name, name_ar, phone, status)
  values (btrim(p_name), btrim(p_name), nullif(btrim(coalesce(p_phone, '')), ''), 'pending')
  returning id into v_office;
  update public.profiles
     set office_id = v_office, role = 'admin', is_active = true, full_name = left(btrim(p_admin_name), 200), phone = p_admin_phone
   where id = p_user and office_id is null;
  if not found then raise exception 'admin profile not found' using errcode = 'P0002'; end if;
  insert into private.office_requests (office_id, requested_by, note, source_hash)
  values (v_office, p_user, nullif(left(btrim(coalesce(p_note, '')), 500), ''), p_source_hash);
  perform private.write_audit(v_office, 'office_requested', 'office', v_office, jsonb_build_object('admin_user_id', p_user));
  return v_office;
end $function$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.svc_office_request_limit(text)',
    'public.svc_request_office(uuid, text, text, text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 2. Platform owner: list and decide requests.
------------------------------------------------------------------------------
create or replace function public.platform_list_office_requests()
 returns table (office_id uuid, office_name text, office_phone text, status public.office_status,
                admin_name text, admin_phone text, note text, requested_at timestamptz,
                decision text, decided_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not private.is_platform_admin((select auth.uid())) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  return query
    select r.office_id, coalesce(o.name_ar, o.name), o.phone, o.status,
           p.full_name, p.phone, r.note, r.created_at, r.decision, r.decided_at
      from private.office_requests r
      join public.offices o on o.id = r.office_id
      left join public.profiles p on p.id = r.requested_by
     order by (r.decision is null) desc, r.created_at desc
     limit 100;
end $function$;
revoke all on function public.platform_list_office_requests() from public, anon;
grant execute on function public.platform_list_office_requests() to authenticated;

-- Approve (pending or previously rejected → active) or reject (pending → rejected).
create or replace function public.platform_review_office_request(p_office uuid, p_approve boolean)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := (select auth.uid()); v_status public.office_status;
begin
  if not private.is_platform_admin(v_actor) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  if p_approve is null then raise exception 'a decision is required' using errcode = '22023'; end if;
  select o.status into v_status
    from private.office_requests r join public.offices o on o.id = r.office_id
   where r.office_id = p_office
     for update;
  if not found then raise exception 'office request not found' using errcode = 'P0002'; end if;
  if v_status not in ('pending', 'rejected') or (not p_approve and v_status <> 'pending') then
    raise exception 'this request has already been decided' using errcode = '22023';
  end if;
  update public.offices
     set status = (case when p_approve then 'active' else 'rejected' end)::public.office_status
   where id = p_office;
  update private.office_requests
     set decision = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = v_actor
   where office_id = p_office;
  perform private.write_audit(p_office, case when p_approve then 'office_request_approved' else 'office_request_rejected' end,
    'office', p_office, jsonb_build_object('by_platform_admin', v_actor));
end $function$;
revoke all on function public.platform_review_office_request(uuid, boolean) from public, anon;
grant execute on function public.platform_review_office_request(uuid, boolean) to authenticated;

------------------------------------------------------------------------------
-- 3. The offices console lists offices, not requests; requests are decided only
--    through platform_review_office_request, which also records the decision.
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
    where o.status not in ('pending', 'rejected')
    order by o.created_at desc;
end $function$;

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
  if p_status in ('pending', 'rejected') then
    raise exception 'office requests are decided with platform_review_office_request' using errcode = '22023';
  end if;
  update public.offices set status = p_status where id = p_office and status not in ('pending', 'rejected');
  if not found then
    if exists (select 1 from public.offices o where o.id = p_office) then
      raise exception 'office requests are decided with platform_review_office_request' using errcode = '22023';
    end if;
    raise exception 'office not found' using errcode = 'P0002';
  end if;
  perform private.write_audit(p_office, 'office_status_changed', 'office', p_office, jsonb_build_object('status', p_status));
end $function$;
