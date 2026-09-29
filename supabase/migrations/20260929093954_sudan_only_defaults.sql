-- Maktabi serves Sudanese law offices only (product decision, 2026-09-29): no Kuwaiti
-- defaults, numbers, currency or formats. This replaces the Kuwait values left from the
-- first schema. No rows are converted: the project had no offices, clients or payments
-- when this was applied.

------------------------------------------------------------------------------
-- 1. Office and payment defaults: Sudan, Sudanese pound, Khartoum time.
--    Payment amounts use the pound's two decimals (the three were for Kuwaiti fils).
------------------------------------------------------------------------------
alter table public.offices
  alter column country set default 'SD',
  alter column default_currency set default 'SDG',
  alter column timezone set default 'Africa/Khartoum';

alter table public.payments
  alter column currency set default 'SDG',
  alter column amount type numeric(14, 2);
comment on column public.payments.amount is 'Exact decimal amount in the given currency (two decimals, as for the Sudanese pound). Never floating point.';

------------------------------------------------------------------------------
-- 2. Yearly office numbering (matter numbers, ...) follows Sudan time.
--    Same function as before; only the time zone changes.
------------------------------------------------------------------------------
create or replace function private.next_office_number(p_office uuid, p_scope text, p_prefix text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_year int := extract(year from now() at time zone 'Africa/Khartoum'); v_value int;
begin
  if p_office is null then return null; end if;
  if current_user in ('authenticated', 'anon') and p_office is distinct from private.current_office_id() then
    raise exception 'cannot allocate numbers for another office' using errcode = '42501';
  end if;
  insert into private.office_counters as c (office_id, scope, year, last_value)
  values (p_office, p_scope, v_year, 1)
  on conflict (office_id, scope, year) do update set last_value = c.last_value + 1
  returning last_value into v_value;
  return p_prefix || '-' || v_year || '-' || lpad(v_value::text, 5, '0');
end $$;

------------------------------------------------------------------------------
-- 3. Identity: the Sudanese national number (id_type = national_id) is digits only.
--    The Kuwait civil-ID rule (12 digits) is removed.
------------------------------------------------------------------------------
alter table public.clients drop constraint clients_kuwait_civil_id;
alter table public.clients
  add constraint clients_national_id_digits check (id_type is distinct from 'national_id' or civil_id ~ '^[0-9]+$');
comment on column public.clients.civil_id is 'Identity document number. The Sudanese national number (id_type = national_id, id_country = SD) is digits only.';

------------------------------------------------------------------------------
-- 4. Operator-only office bootstrap: Sudanese defaults (same function otherwise).
------------------------------------------------------------------------------
create or replace function private.bootstrap_office(p_admin_email text, p_name text, p_name_ar text default null, p_country char(2) default 'SD', p_currency char(3) default 'SDG')
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

------------------------------------------------------------------------------
-- 5. Payment methods: 'knet' (Kuwait) becomes 'bankak' (بنكك), the method the app
--    already offers. No payment used 'knet'.
------------------------------------------------------------------------------
alter type public.payment_method rename value 'knet' to 'bankak';
