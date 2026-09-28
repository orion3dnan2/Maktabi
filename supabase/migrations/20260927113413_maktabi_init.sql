-- Maktabi: office-scoped cloud storage with row level security.
create schema if not exists private;

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.office_members (
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'OWNER' check (role in ('OWNER', 'LAWYER', 'ASSISTANT', 'ACCOUNTANT', 'VIEWER')),
  created_at timestamptz not null default now(),
  primary key (office_id, user_id)
);
create index office_members_user_idx on public.office_members (user_id);

create table public.office_data (
  office_id uuid primary key references public.offices (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.clients (
  office_id uuid not null references public.offices (id) on delete cascade,
  id text not null,
  display_name text not null,
  kind text not null check (kind in ('PERSON', 'ORGANIZATION')),
  phone text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (office_id, id)
);

create table public.matters (
  office_id uuid not null references public.offices (id) on delete cascade,
  id text not null,
  reference text not null,
  title text not null,
  type text not null,
  status text not null check (status in ('ACTIVE', 'ON_HOLD', 'CLOSED', 'ARCHIVED')),
  opened_at date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (office_id, id)
);
create unique index matters_reference_uidx on public.matters (office_id, lower(trim(reference)));

create table public.matter_workflows (
  office_id uuid not null,
  matter_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (office_id, matter_id),
  foreign key (office_id, matter_id) references public.matters (office_id, id) on delete cascade
);

create table public.client_profiles (
  office_id uuid not null,
  client_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (office_id, client_id),
  foreign key (office_id, client_id) references public.clients (office_id, id) on delete cascade
);

create or replace function private.is_office_member(p_office uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.office_members m where m.office_id = p_office and m.user_id = (select auth.uid()));
$$;
create or replace function private.is_office_owner(p_office uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.office_members m where m.office_id = p_office and m.user_id = (select auth.uid()) and m.role = 'OWNER');
$$;
revoke all on function private.is_office_member(uuid), private.is_office_owner(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_office_member(uuid), private.is_office_owner(uuid) to authenticated;

alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.office_data enable row level security;
alter table public.clients enable row level security;
alter table public.matters enable row level security;
alter table public.matter_workflows enable row level security;
alter table public.client_profiles enable row level security;

create policy "members read office" on public.offices for select to authenticated using (private.is_office_member(id));
create policy "owners update office" on public.offices for update to authenticated using (private.is_office_owner(id)) with check (private.is_office_owner(id));

create policy "members read membership" on public.office_members for select to authenticated using (private.is_office_member(office_id));
create policy "owners add members" on public.office_members for insert to authenticated with check (private.is_office_owner(office_id));
create policy "owners change members" on public.office_members for update to authenticated using (private.is_office_owner(office_id)) with check (private.is_office_owner(office_id));
create policy "owners remove members" on public.office_members for delete to authenticated using (private.is_office_owner(office_id));

do $$
declare t text;
begin
  foreach t in array array['office_data', 'clients', 'matters', 'matter_workflows', 'client_profiles'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (private.is_office_member(office_id))', t);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (private.is_office_member(office_id))', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (private.is_office_member(office_id)) with check (private.is_office_member(office_id))', t);
    execute format('create policy "members delete" on public.%I for delete to authenticated using (private.is_office_member(office_id))', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger clients_touch before update on public.clients for each row execute function private.touch_updated_at();
create trigger matters_touch before update on public.matters for each row execute function private.touch_updated_at();
create trigger matter_workflows_touch before update on public.matter_workflows for each row execute function private.touch_updated_at();
create trigger client_profiles_touch before update on public.client_profiles for each row execute function private.touch_updated_at();
create trigger office_data_touch before update on public.office_data for each row execute function private.touch_updated_at();

create or replace function public.create_office(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_office uuid;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'office name required' using errcode = '22023'; end if;
  insert into public.offices (name, created_by) values (trim(p_name), v_user) returning id into v_office;
  insert into public.office_members (office_id, user_id, role) values (v_office, v_user, 'OWNER');
  return v_office;
end $$;
revoke all on function public.create_office(text) from public, anon;
grant execute on function public.create_office(text) to authenticated;

create or replace function public.sync_office(p_office uuid, p_changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_office_member(p_office) then raise exception 'not a member of this office' using errcode = '42501'; end if;

  if p_changes ? 'office' then
    insert into public.office_data (office_id, data) values (p_office, p_changes->'office')
    on conflict (office_id) do update set data = excluded.data;
  end if;

  insert into public.clients (office_id, id, display_name, kind, phone, data)
  select p_office, x->>'id', x->>'displayName', x->>'kind', x->>'phone', x
  from jsonb_array_elements(coalesce(p_changes->'clients'->'upsert', '[]')) x
  on conflict (office_id, id) do update set display_name = excluded.display_name, kind = excluded.kind, phone = excluded.phone, data = excluded.data;

  insert into public.matters (office_id, id, reference, title, type, status, opened_at, data)
  select p_office, x->>'id', x->>'reference', x->>'title', x->>'type', x->>'status', nullif(x->>'openedAt', '')::date, x
  from jsonb_array_elements(coalesce(p_changes->'matters'->'upsert', '[]')) x
  on conflict (office_id, id) do update set reference = excluded.reference, title = excluded.title, type = excluded.type, status = excluded.status, opened_at = excluded.opened_at, data = excluded.data;

  insert into public.matter_workflows (office_id, matter_id, data)
  select p_office, x->>'id', x->'data' from jsonb_array_elements(coalesce(p_changes->'workflows'->'upsert', '[]')) x
  on conflict (office_id, matter_id) do update set data = excluded.data;

  insert into public.client_profiles (office_id, client_id, data)
  select p_office, x->>'id', x->'data' from jsonb_array_elements(coalesce(p_changes->'profiles'->'upsert', '[]')) x
  on conflict (office_id, client_id) do update set data = excluded.data;

  delete from public.matter_workflows where office_id = p_office and matter_id in (select jsonb_array_elements_text(coalesce(p_changes->'workflows'->'delete', '[]')));
  delete from public.client_profiles where office_id = p_office and client_id in (select jsonb_array_elements_text(coalesce(p_changes->'profiles'->'delete', '[]')));
  delete from public.matters where office_id = p_office and id in (select jsonb_array_elements_text(coalesce(p_changes->'matters'->'delete', '[]')));
  delete from public.clients where office_id = p_office and id in (select jsonb_array_elements_text(coalesce(p_changes->'clients'->'delete', '[]')));
end $$;
revoke all on function public.sync_office(uuid, jsonb) from public, anon;
grant execute on function public.sync_office(uuid, jsonb) to authenticated;
