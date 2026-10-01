-- Maktabi core schema: offices, users (profiles) and the legal-practice records they own.
-- Every business row carries office_id. Relationships between business rows use composite
-- (office_id, id) foreign keys, so the database itself refuses to link records across offices.
-- Legal and financial records are never cascade-deleted; they are archived or voided instead.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('admin', 'lawyer', 'employee', 'reception');
create type public.office_status as enum ('active', 'suspended', 'closed');
create type public.client_type as enum ('individual', 'organization');
create type public.client_status as enum ('active', 'inactive', 'archived');
create type public.identity_document_type as enum ('civil_id', 'passport', 'national_id', 'residency', 'commercial_registration', 'other');
create type public.matter_type as enum ('criminal', 'civil', 'commercial', 'personal_status', 'labour', 'administrative', 'real_estate', 'special_court', 'commercial_registry', 'land_registry', 'notarization', 'consultation', 'other');
create type public.matter_status as enum ('open', 'on_hold', 'closed', 'archived');
create type public.priority_level as enum ('low', 'normal', 'high', 'urgent');
create type public.party_role as enum ('client', 'opponent', 'witness', 'expert', 'other');
create type public.appointment_type as enum ('client_meeting', 'court_session', 'consultation', 'internal_meeting', 'reminder', 'other');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type public.document_type as enum ('pleading', 'evidence', 'contract', 'power_of_attorney', 'judgment', 'correspondence', 'identity', 'receipt', 'other');
create type public.payment_type as enum ('legal_fee', 'retainer', 'consultation_fee', 'court_fee', 'expense_reimbursement', 'trust_deposit', 'refund', 'other');
create type public.payment_method as enum ('cash', 'bank_transfer', 'knet', 'card', 'cheque', 'other');
create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded', 'void');

-- ---------------------------------------------------------------- offices
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  name_ar text check (name_ar is null or char_length(btrim(name_ar)) between 1 and 200),
  phone text check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,24}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text check (address is null or char_length(address) <= 1000),
  country char(2) not null default 'KW' check (country ~ '^[A-Z]{2}$'),
  default_currency char(3) not null default 'KWD' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kuwait' check (char_length(timezone) between 1 and 64),
  status public.office_status not null default 'active',
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.offices is 'A law office (tenant). All business data is isolated per office.';
comment on column public.offices.settings is 'Office-level preferences (receipt prefixes, branding, ...). Not used for authorization.';

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  office_id uuid references public.offices (id) on delete restrict,
  role public.app_role,
  full_name text not null default '' check (char_length(full_name) <= 200),
  display_name text check (display_name is null or char_length(display_name) <= 100),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,24}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_requires_office check ((office_id is null) = (role is null)),
  constraint profiles_office_member_key unique (office_id, id)
);
create index profiles_office_role_idx on public.profiles (office_id, role) where is_active;
create unique index profiles_email_uidx on public.profiles (lower(email)) where email is not null;
comment on table public.profiles is 'Application user, 1:1 with auth.users. office_id + role are the only source of authorization and can only be changed by an office admin or trusted server code.';
comment on column public.profiles.email is 'Mirror of auth.users.email maintained by trigger; lets admins identify colleagues. Not used for authorization.';

-- ---------------------------------------------------------------- authorization helpers
create or replace function private.current_office_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.office_id
  from public.profiles p
  join public.offices o on o.id = p.office_id
  where p.id = (select auth.uid()) and p.is_active and o.status = 'active';
$$;

create or replace function private.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role
  from public.profiles p
  join public.offices o on o.id = p.office_id
  where p.id = (select auth.uid()) and p.is_active and o.status = 'active';
$$;

create table private.office_counters (
  office_id uuid not null references public.offices (id) on delete cascade,
  scope text not null,
  year int not null,
  last_value int not null default 0,
  primary key (office_id, scope, year)
);

create or replace function private.next_office_number(p_office uuid, p_scope text, p_prefix text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_year int := extract(year from now() at time zone 'Asia/Kuwait'); v_value int;
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

create or replace function private.next_matter_number()
returns text language sql volatile security definer set search_path = '' as $$
  select private.next_office_number(private.current_office_id(), 'matter', 'M');
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.current_office_id(), private.current_app_role(), private.next_matter_number() to authenticated;

-- ---------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  client_type public.client_type not null default 'individual',
  full_name text not null check (char_length(btrim(full_name)) between 1 and 300),
  id_type public.identity_document_type,
  civil_id text,
  id_country char(2) check (id_country is null or id_country ~ '^[A-Z]{2}$'),
  nationality char(2) check (nationality is null or nationality ~ '^[A-Z]{2}$'),
  phone text check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,24}$'),
  secondary_phone text check (secondary_phone is null or secondary_phone ~ '^\+?[0-9][0-9 ()-]{5,24}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text check (address is null or char_length(address) <= 1000),
  contact_person text check (contact_person is null or char_length(contact_person) <= 200),
  registration_number text check (registration_number is null or char_length(registration_number) <= 100),
  notes text check (notes is null or char_length(notes) <= 10000),
  status public.client_status not null default 'active',
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_office_key unique (office_id, id),
  constraint clients_identity_complete check (civil_id is null or (id_type is not null and char_length(btrim(civil_id)) between 3 and 50 and civil_id = btrim(civil_id))),
  constraint clients_kuwait_civil_id check (not (id_type = 'civil_id' and coalesce(id_country, 'KW') = 'KW') or civil_id ~ '^[0-9]{12}$')
);
create unique index clients_identity_uidx on public.clients (office_id, id_type, coalesce(id_country, ''), civil_id) where civil_id is not null;
create index clients_office_name_idx on public.clients (office_id, full_name);
create index clients_created_by_idx on public.clients (created_by);
comment on column public.clients.civil_id is 'Identity document number. Kuwait civil ID (12 digits) when id_type = civil_id and id_country = KW; any format otherwise.';

-- ---------------------------------------------------------------- matters
create table public.matters (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  client_id uuid not null,
  assigned_lawyer_id uuid,
  matter_number text not null default private.next_matter_number() check (char_length(matter_number) between 1 and 50 and matter_number = btrim(matter_number)),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 20000),
  matter_type public.matter_type not null default 'other',
  court_name text check (court_name is null or char_length(court_name) <= 300),
  case_number text check (case_number is null or char_length(case_number) <= 100),
  status public.matter_status not null default 'open',
  priority public.priority_level not null default 'normal',
  opened_at date not null default current_date,
  closed_at date,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matters_office_key unique (office_id, id),
  constraint matters_number_key unique (office_id, matter_number),
  constraint matters_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict,
  constraint matters_lawyer_fk foreign key (office_id, assigned_lawyer_id) references public.profiles (office_id, id) on delete restrict,
  constraint matters_closed_dates check (closed_at is null or closed_at >= opened_at),
  constraint matters_closed_status check ((status in ('closed', 'archived')) = (closed_at is not null))
);
create index matters_office_status_idx on public.matters (office_id, status);
create index matters_client_idx on public.matters (office_id, client_id);
create index matters_lawyer_idx on public.matters (office_id, assigned_lawyer_id) where assigned_lawyer_id is not null;
create index matters_created_by_idx on public.matters (created_by);
comment on column public.matters.details is 'Type-specific structured fields (charge, plot number, ...). Not used for authorization.';

create table public.matter_parties (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  matter_id uuid not null,
  client_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 300),
  party_role public.party_role not null default 'other',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_parties_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete cascade,
  constraint matter_parties_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict
);
create index matter_parties_matter_idx on public.matter_parties (office_id, matter_id);
create index matter_parties_client_idx on public.matter_parties (office_id, client_id) where client_id is not null;

-- ---------------------------------------------------------------- appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  client_id uuid,
  matter_id uuid,
  assigned_to uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 5000),
  appointment_type public.appointment_type not null default 'client_meeting',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or char_length(location) <= 500),
  status public.appointment_status not null default 'scheduled',
  reminder_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict,
  constraint appointments_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict,
  constraint appointments_assignee_fk foreign key (office_id, assigned_to) references public.profiles (office_id, id) on delete restrict,
  constraint appointments_time_order check (ends_at is null or ends_at > starts_at),
  constraint appointments_reminder_before check (reminder_at is null or reminder_at <= starts_at)
);
create index appointments_office_starts_idx on public.appointments (office_id, starts_at);
create index appointments_client_idx on public.appointments (office_id, client_id) where client_id is not null;
create index appointments_matter_idx on public.appointments (office_id, matter_id) where matter_id is not null;
create index appointments_assignee_idx on public.appointments (office_id, assigned_to, starts_at) where assigned_to is not null;
create index appointments_created_by_idx on public.appointments (created_by);
create index appointments_reminder_idx on public.appointments (reminder_at) where reminder_at is not null and status in ('scheduled', 'confirmed');

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  matter_id uuid,
  client_id uuid,
  assigned_to uuid not null default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 5000),
  priority public.priority_level not null default 'normal',
  status public.task_status not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict,
  constraint tasks_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict,
  constraint tasks_assignee_fk foreign key (office_id, assigned_to) references public.profiles (office_id, id) on delete restrict,
  constraint tasks_completed_state check ((status = 'completed') = (completed_at is not null))
);
create index tasks_assignee_status_idx on public.tasks (office_id, assigned_to, status);
create index tasks_open_due_idx on public.tasks (office_id, due_at) where status in ('pending', 'in_progress');
create index tasks_matter_idx on public.tasks (office_id, matter_id) where matter_id is not null;
create index tasks_client_idx on public.tasks (office_id, client_id) where client_id is not null;
create index tasks_created_by_idx on public.tasks (created_by);

-- ---------------------------------------------------------------- documents (metadata; binaries live in Storage)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  client_id uuid,
  matter_id uuid,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name !~ '[/\\]'),
  storage_path text not null unique,
  mime_type text not null check (mime_type ~ '^[a-z]+/[a-z0-9.+-]+$'),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  document_type public.document_type not null default 'other',
  description text check (description is null or char_length(description) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict,
  constraint documents_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict,
  constraint documents_storage_path_layout check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]{1,255}$' and split_part(storage_path, '/', 1) = office_id::text
  )
);
create index documents_matter_idx on public.documents (office_id, matter_id) where matter_id is not null;
create index documents_client_idx on public.documents (office_id, client_id) where client_id is not null;
create index documents_office_created_idx on public.documents (office_id, created_at desc);
create index documents_uploaded_by_idx on public.documents (uploaded_by);

-- ---------------------------------------------------------------- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  client_id uuid not null,
  matter_id uuid,
  amount numeric(14, 3) not null check (amount > 0),
  currency char(3) not null default 'KWD' check (currency ~ '^[A-Z]{3}$'),
  payment_type public.payment_type not null default 'legal_fee',
  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'completed',
  reference_number text check (reference_number is null or char_length(btrim(reference_number)) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  paid_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_client_fk foreign key (office_id, client_id) references public.clients (office_id, id) on delete restrict,
  constraint payments_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict,
  constraint payments_completed_has_date check (payment_status <> 'completed' or paid_at is not null)
);
create unique index payments_reference_uidx on public.payments (office_id, reference_number) where reference_number is not null;
create index payments_client_idx on public.payments (office_id, client_id);
create index payments_matter_idx on public.payments (office_id, matter_id) where matter_id is not null;
create index payments_office_paid_idx on public.payments (office_id, paid_at desc);
create index payments_created_by_idx on public.payments (created_by);
comment on column public.payments.amount is 'Exact decimal amount in the given currency (3 decimals covers KWD fils). Never floating point.';

-- ---------------------------------------------------------------- audit_logs (append-only)
create table public.audit_logs (
  id bigint generated always as identity primary key,
  office_id uuid references public.offices (id) on delete restrict,
  user_id uuid,
  action text not null check (action ~ '^[a-z][a-z_]{2,63}$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z_]{1,63}$'),
  entity_id uuid,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_logs_office_created_idx on public.audit_logs (office_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);
comment on table public.audit_logs is 'Append-only audit trail written by database triggers and trusted functions. user_id intentionally has no FK so history survives user deletion.';
