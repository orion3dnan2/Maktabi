-- Server-side integrity: timestamps, trusted actor columns, per-role field guards,
-- append-only audit trail, and Supabase Auth -> profiles provisioning.
-- Guards apply to API callers (roles anon/authenticated). Trusted server code running as
-- postgres/service_role (migrations, SQL editor, private functions) is not restricted by them.

-- ---------------------------------------------------------------- generic helpers
create or replace function private.is_api_caller()
returns boolean language sql stable set search_path = '' as $$
  select current_user in ('authenticated', 'anon');
$$;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- BEFORE INSERT: the actor column named in TG_ARGV[0] is always the authenticated caller.
create or replace function private.stamp_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_api_caller() then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], (select auth.uid())));
  end if;
  return new;
end $$;

-- BEFORE UPDATE: columns listed in TG_ARGV can never change through the API.
create or replace function private.forbid_column_changes()
returns trigger language plpgsql set search_path = '' as $$
declare v_col text; v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
begin
  if private.is_api_caller() then
    foreach v_col in array tg_argv loop
      if v_old -> v_col is distinct from v_new -> v_col then
        raise exception 'column % cannot be changed', v_col using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

-- Security definer: the caller may not be allowed to read the matter row itself.
create or replace function private.can_access_matter(p_matter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matters m
    where m.id = p_matter
      and m.office_id = private.current_office_id()
      and (
        private.current_app_role() in ('admin', 'employee')
        or (private.current_app_role() = 'lawyer' and (m.assigned_lawyer_id = (select auth.uid()) or m.created_by = (select auth.uid())))
      )
  );
$$;

-- A lawyer sees clients of the matters they work on (primary client or listed party).
create or replace function private.lawyer_can_see_client(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matters m
    where m.client_id = p_client and m.office_id = private.current_office_id()
      and (m.assigned_lawyer_id = (select auth.uid()) or m.created_by = (select auth.uid()))
  ) or exists (
    select 1 from public.matter_parties mp
    join public.matters m on m.office_id = mp.office_id and m.id = mp.matter_id
    where mp.client_id = p_client and m.office_id = private.current_office_id()
      and (m.assigned_lawyer_id = (select auth.uid()) or m.created_by = (select auth.uid()))
  );
$$;

-- ---------------------------------------------------------------- audit trail
create or replace function private.write_audit(p_office uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}')
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.audit_logs (office_id, user_id, action, entity_type, entity_id, metadata)
  values (p_office, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'));
$$;

-- AFTER trigger for business tables. Records which fields changed and status transitions,
-- never the confidential values themselves.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_entity text := tg_argv[0];
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_changed text[];
  v_meta jsonb := '{}';
  v_action text;
  v_col text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_row) n
    where n.key not in ('updated_at') and n.value is distinct from v_old -> n.key;
    if v_changed is null then return null; end if;
    v_meta := jsonb_build_object('changed', to_jsonb(v_changed));
    foreach v_col in array array['status', 'payment_status', 'assigned_lawyer_id', 'assigned_to', 'matter_id'] loop
      if v_col = any (v_changed) then
        v_meta := v_meta || jsonb_build_object(v_col, jsonb_build_object('from', v_old -> v_col, 'to', v_row -> v_col));
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    v_meta := jsonb_strip_nulls(jsonb_build_object('matter_id', v_row -> 'matter_id', 'client_id', v_row -> 'client_id'));
    if v_entity = 'payment' then
      v_meta := v_meta || jsonb_build_object('amount', v_row -> 'amount', 'currency', v_row -> 'currency', 'payment_status', v_row -> 'payment_status');
    elsif v_entity = 'document' then
      v_meta := v_meta || jsonb_build_object('file_name', v_row -> 'file_name', 'file_size', v_row -> 'file_size');
    end if;
  end if;
  v_action := case
    when v_entity = 'document' and tg_op = 'INSERT' then 'document_uploaded'
    when tg_op = 'INSERT' then v_entity || '_created'
    when tg_op = 'UPDATE' then v_entity || '_updated'
    else v_entity || '_deleted' end;
  perform private.write_audit((v_row ->> 'office_id')::uuid, v_action, v_entity, (v_row ->> 'id')::uuid, v_meta);
  return null;
end $$;

-- Audit history is immutable for everyone, including admins and the service role.
create or replace function private.audit_logs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs for each statement execute function private.audit_logs_immutable();

-- ---------------------------------------------------------------- per-table guards
-- offices: admins edit contact details and settings; lifecycle status is server-managed.
create or replace function private.guard_offices()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_api_caller() and (new.status is distinct from old.status or new.id is distinct from old.id) then
    raise exception 'office status can only be changed by the platform' using errcode = '42501';
  end if;
  return new;
end $$;

-- profiles: users edit their own personal fields; only an office admin changes role/activation
-- of someone else; office membership changes only through trusted functions. An office always
-- keeps at least one active admin.
create or replace function private.guard_profiles()
returns trigger language plpgsql set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if private.is_api_caller() then
    if new.id is distinct from old.id or new.email is distinct from old.email or new.created_at is distinct from old.created_at then
      raise exception 'identity fields cannot be changed' using errcode = '42501';
    end if;
    if new.office_id is distinct from old.office_id then
      raise exception 'office membership is managed by an administrator' using errcode = '42501';
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
end $$;

create or replace function private.audit_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.office_id is distinct from old.office_id then
    if old.office_id is not null then
      perform private.write_audit(old.office_id, 'user_removed_from_office', 'profile', new.id, jsonb_build_object('role', old.role));
    end if;
    if new.office_id is not null then
      perform private.write_audit(new.office_id, 'user_added_to_office', 'profile', new.id, jsonb_build_object('role', new.role));
    end if;
  elsif new.role is distinct from old.role then
    perform private.write_audit(new.office_id, 'user_role_changed', 'profile', new.id, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform private.write_audit(coalesce(new.office_id, old.office_id), case when new.is_active then 'user_activated' else 'user_deactivated' end, 'profile', new.id, '{}');
  end if;
  return null;
end $$;

-- clients: reception may only maintain contact details.
create or replace function private.guard_clients()
returns trigger language plpgsql set search_path = '' as $$
declare v_col text; v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
begin
  if private.is_api_caller() and private.current_app_role() = 'reception' then
    for v_col in select key from jsonb_each(v_new) loop
      if v_col not in ('phone', 'secondary_phone', 'email', 'address', 'contact_person', 'updated_at')
         and v_old -> v_col is distinct from v_new -> v_col then
        raise exception 'reception can only update client contact details (tried %)', v_col using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

-- matters: assignment rules, lawyer eligibility and automatic closing date.
create or replace function private.guard_matters()
returns trigger language plpgsql set search_path = '' as $$
declare v_role public.app_role := private.current_app_role();
begin
  if new.assigned_lawyer_id is not null and (tg_op = 'INSERT' or new.assigned_lawyer_id is distinct from old.assigned_lawyer_id) then
    if not exists (select 1 from public.profiles p where p.id = new.assigned_lawyer_id and p.office_id = new.office_id and p.is_active and p.role in ('lawyer', 'admin')) then
      raise exception 'matters can only be assigned to an active lawyer or admin of the office' using errcode = '23514';
    end if;
  end if;
  if private.is_api_caller() then
    if tg_op = 'INSERT' and v_role = 'lawyer' and new.assigned_lawyer_id is not null and new.assigned_lawyer_id <> (select auth.uid()) then
      raise exception 'lawyers can only assign new matters to themselves' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.assigned_lawyer_id is distinct from old.assigned_lawyer_id and v_role is distinct from 'admin' then
      raise exception 'only an admin can reassign a matter' using errcode = '42501';
    end if;
  end if;
  if new.status in ('closed', 'archived') and new.closed_at is null then
    new.closed_at := greatest(current_date, new.opened_at);
  elsif new.status in ('open', 'on_hold') then
    new.closed_at := null;
  end if;
  return new;
end $$;

-- Linking an existing row to a matter requires access to that matter.
create or replace function private.guard_matter_link()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_api_caller() and new.matter_id is not null
     and (tg_op = 'INSERT' or new.matter_id is distinct from old.matter_id)
     and not private.can_access_matter(new.matter_id) then
    raise exception 'no access to the linked matter' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function private.guard_tasks()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and new.completed_at is null then new.completed_at := now();
  elsif new.status <> 'completed' then new.completed_at := null;
  end if;
  return new;
end $$;

-- payments: financial facts are immutable once recorded; corrections are voids + new entries.
-- The paying client must be the matter's client or one of its parties.
create or replace function private.guard_payments()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and private.is_api_caller()
     and (new.amount, new.currency, new.client_id, new.matter_id, new.payment_type)
         is distinct from (old.amount, old.currency, old.client_id, old.matter_id, old.payment_type) then
    raise exception 'amount, currency, client, matter and type of a payment cannot be changed; void it and record a new one' using errcode = '42501';
  end if;
  if new.matter_id is not null and not exists (
    select 1 from public.matters m where m.office_id = new.office_id and m.id = new.matter_id and m.client_id = new.client_id
    union all
    select 1 from public.matter_parties mp where mp.office_id = new.office_id and mp.matter_id = new.matter_id and mp.client_id = new.client_id
  ) then
    raise exception 'the client is not a party to this matter' using errcode = '23514';
  end if;
  if new.payment_status = 'completed' and new.paid_at is null then new.paid_at := now(); end if;
  return new;
end $$;

-- ---------------------------------------------------------------- attach triggers
do $$
declare t text;
begin
  foreach t in array array['offices', 'profiles', 'clients', 'matters', 'matter_parties', 'appointments', 'tasks', 'documents', 'payments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
  foreach t in array array['clients', 'matters', 'appointments', 'tasks', 'payments'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function private.stamp_actor(%L)', t || '_stamp_actor', t, 'created_by');
    execute format('create trigger %I before update on public.%I for each row execute function private.forbid_column_changes(%L, %L, %L, %L)', t || '_immutable', t, 'id', 'office_id', 'created_by', 'created_at');
  end loop;
  foreach t in array array['appointments', 'tasks', 'documents'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.guard_matter_link()', t || '_guard_matter_link', t);
  end loop;
end $$;

create trigger documents_stamp_actor before insert on public.documents for each row execute function private.stamp_actor('uploaded_by');
create trigger documents_immutable before update on public.documents for each row execute function private.forbid_column_changes('id', 'office_id', 'uploaded_by', 'created_at', 'storage_path', 'file_size', 'mime_type');
create trigger matter_parties_immutable before update on public.matter_parties for each row execute function private.forbid_column_changes('id', 'office_id', 'matter_id', 'created_at');
create trigger offices_guard before update on public.offices for each row execute function private.guard_offices();
create trigger profiles_guard before update on public.profiles for each row execute function private.guard_profiles();
create trigger profiles_audit after update on public.profiles for each row execute function private.audit_profiles();
create trigger clients_guard before update on public.clients for each row execute function private.guard_clients();
create trigger matters_guard before insert or update on public.matters for each row execute function private.guard_matters();
create trigger tasks_guard before insert or update on public.tasks for each row execute function private.guard_tasks();
create trigger payments_guard before insert or update on public.payments for each row execute function private.guard_payments();

create trigger clients_audit after insert or update or delete on public.clients for each row execute function private.audit_row('client');
create trigger matters_audit after insert or update or delete on public.matters for each row execute function private.audit_row('matter');
create trigger appointments_audit after insert or update or delete on public.appointments for each row execute function private.audit_row('appointment');
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function private.audit_row('task');
create trigger documents_audit after insert or update or delete on public.documents for each row execute function private.audit_row('document');
create trigger payments_audit after insert or update or delete on public.payments for each row execute function private.audit_row('payment');

-- ---------------------------------------------------------------- Supabase Auth integration
-- Every new auth user gets a profile with NO office and NO role: authentication alone grants nothing.
-- user_metadata is copied only as display text, never used for authorization.
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();

create or replace function private.handle_auth_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function private.handle_auth_email_change();

-- Explicit bootstrap of an office and its first admin. Not callable through the API:
-- run it from the Supabase SQL editor as the project owner, e.g.
--   select private.bootstrap_office('owner@example.com', 'Office name', 'اسم المكتب');
create or replace function private.bootstrap_office(p_admin_email text, p_name text, p_name_ar text default null, p_country char(2) default 'KW', p_currency char(3) default 'KWD')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid; v_office uuid;
begin
  if private.is_api_caller() then raise exception 'bootstrap_office is restricted to trusted operators' using errcode = '42501'; end if;
  select p.id into v_user from public.profiles p where lower(p.email) = lower(btrim(p_admin_email));
  if v_user is null then raise exception 'no signed-up user with email %', p_admin_email; end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.office_id is not null) then
    raise exception 'user already belongs to an office';
  end if;
  insert into public.offices (name, name_ar, country, default_currency) values (btrim(p_name), nullif(btrim(p_name_ar), ''), p_country, p_currency) returning id into v_office;
  update public.profiles set office_id = v_office, role = 'admin', is_active = true where id = v_user;
  perform private.write_audit(v_office, 'office_created', 'office', v_office, jsonb_build_object('admin_user_id', v_user));
  return v_office;
end $$;

-- Admins add an already signed-up user (who has no office yet) to their office.
create or replace function private.add_office_member(p_email text, p_role public.app_role)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_office uuid := private.current_office_id(); v_user uuid;
begin
  if v_office is null or private.current_app_role() is distinct from 'admin' then
    raise exception 'only an office admin can add members' using errcode = '42501';
  end if;
  if p_role is null then raise exception 'role is required' using errcode = '22023'; end if;
  select p.id into v_user from public.profiles p where lower(p.email) = lower(btrim(p_email)) and p.office_id is null;
  if v_user is null then
    raise exception 'no signed-up user without an office has this email' using errcode = 'P0002';
  end if;
  update public.profiles set office_id = v_office, role = p_role, is_active = true where id = v_user;
  return v_user;
end $$;

create or replace function private.log_login_success()
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_office uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select p.office_id into v_office from public.profiles p where p.id = v_uid;
  perform private.write_audit(v_office, 'login_success', 'auth', v_uid, '{}');
end $$;

-- Thin security-invoker entry points exposed through the Data API.
create or replace function public.add_office_member(p_email text, p_role public.app_role)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.add_office_member(p_email, p_role);
$$;
create or replace function public.log_login_success()
returns void language sql volatile security invoker set search_path = '' as $$
  select private.log_login_success();
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_api_caller(), private.current_office_id(), private.current_app_role(), private.next_matter_number(),
  private.can_access_matter(uuid), private.lawyer_can_see_client(uuid),
  private.add_office_member(text, public.app_role), private.log_login_success()
  to authenticated;
revoke all on function public.add_office_member(text, public.app_role), public.log_login_success() from public, anon;
grant execute on function public.add_office_member(text, public.app_role), public.log_login_success() to authenticated;
