-- Phase 2: Clients and Matters are stored in Supabase instead of each device's local vault.
-- Additive only: no existing column, policy or migration is changed except where noted.

------------------------------------------------------------------------------
-- 1. clients.whatsapp: the app requires a WhatsApp number for every client.
--    It is a contact detail, so reception may maintain it like phone/email.
------------------------------------------------------------------------------
alter table public.clients
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9][0-9 ()-]{5,24}$');

create or replace function private.guard_clients()
returns trigger language plpgsql set search_path = '' as $$
declare v_col text; v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
begin
  if private.is_api_caller() and private.current_app_role() = 'reception' then
    for v_col in select key from jsonb_each(v_new) loop
      if v_col not in ('phone', 'secondary_phone', 'whatsapp', 'email', 'address', 'contact_person', 'updated_at')
         and v_old -> v_col is distinct from v_new -> v_col then
        raise exception 'reception can only update client contact details (tried %)', v_col using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- 2. Matter parties: a registered client is referenced, never copied. Exactly one of
--    client_id / display_name is set, and a client appears at most once per matter.
------------------------------------------------------------------------------
alter table public.matter_parties alter column display_name drop not null;
alter table public.matter_parties
  add constraint matter_parties_client_or_name check ((client_id is null) <> (display_name is null));
create unique index matter_parties_client_once_uidx
  on public.matter_parties (office_id, matter_id, client_id) where client_id is not null;

------------------------------------------------------------------------------
-- 3. save_matter: create or update a matter and replace its party list in one
--    transaction, as the calling user. SECURITY INVOKER: every RLS policy, guard
--    trigger and composite (office_id, ...) foreign key still applies.
--    p_matter: {id, client_id, assigned_lawyer_id, matter_number, title, description,
--               matter_type, court_name, status, opened_at, details}
--    p_parties: [{id | null, client_id | null, display_name, party_role, notes}]
--    The primary client is matters.client_id and is not repeated in p_parties.
------------------------------------------------------------------------------
create or replace function public.save_matter(p_matter jsonb, p_parties jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_matter ->> 'id')::uuid;
  v_client uuid := (p_matter ->> 'client_id')::uuid;
  v_party jsonb;
  v_party_id uuid;
  v_party_client uuid;
begin
  if v_id is null or v_client is null then
    raise exception 'matter id and primary client are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_parties) is distinct from 'array' then
    raise exception 'parties must be a JSON array' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_parties) p where (p ->> 'client_id')::uuid = v_client) then
    raise exception 'the primary client cannot also be listed as a party' using errcode = '23514';
  end if;

  if exists (select 1 from public.matters m where m.id = v_id) then
    update public.matters set
      client_id = v_client,
      assigned_lawyer_id = (p_matter ->> 'assigned_lawyer_id')::uuid,
      matter_number = p_matter ->> 'matter_number',
      title = p_matter ->> 'title',
      description = nullif(p_matter ->> 'description', ''),
      matter_type = (p_matter ->> 'matter_type')::public.matter_type,
      court_name = nullif(p_matter ->> 'court_name', ''),
      status = (p_matter ->> 'status')::public.matter_status,
      opened_at = (p_matter ->> 'opened_at')::date,
      details = coalesce(p_matter -> 'details', '{}'::jsonb)
    where id = v_id;
    if not found then
      raise exception 'matter not found' using errcode = 'P0002';
    end if;
  else
    insert into public.matters (id, client_id, assigned_lawyer_id, matter_number, title, description, matter_type, court_name, status, opened_at, details)
    values (
      v_id, v_client, (p_matter ->> 'assigned_lawyer_id')::uuid,
      coalesce(nullif(p_matter ->> 'matter_number', ''), private.next_matter_number()),
      p_matter ->> 'title', nullif(p_matter ->> 'description', ''),
      (p_matter ->> 'matter_type')::public.matter_type, nullif(p_matter ->> 'court_name', ''),
      coalesce((p_matter ->> 'status')::public.matter_status, 'open'),
      coalesce((p_matter ->> 'opened_at')::date, current_date),
      coalesce(p_matter -> 'details', '{}'::jsonb));
  end if;

  -- Parties not in the new list are removed; listed ones are updated in place or added.
  delete from public.matter_parties mp
   where mp.matter_id = v_id
     and mp.id not in (select (p ->> 'id')::uuid from jsonb_array_elements(p_parties) p where p ->> 'id' is not null);

  for v_party in select value from jsonb_array_elements(p_parties) loop
    v_party_id := (v_party ->> 'id')::uuid;
    v_party_client := (v_party ->> 'client_id')::uuid;
    if v_party_id is not null and exists (select 1 from public.matter_parties mp where mp.id = v_party_id and mp.matter_id = v_id) then
      update public.matter_parties set
        client_id = v_party_client,
        display_name = case when v_party_client is null then nullif(btrim(v_party ->> 'display_name'), '') end,
        party_role = coalesce((v_party ->> 'party_role')::public.party_role, 'other'),
        notes = nullif(v_party ->> 'notes', '')
      where id = v_party_id and matter_id = v_id;
    else
      -- A reused id that belongs to another matter fails on the primary key: parties
      -- can never be moved between matters through this function.
      insert into public.matter_parties (id, matter_id, client_id, display_name, party_role, notes)
      values (
        coalesce(v_party_id, gen_random_uuid()), v_id, v_party_client,
        case when v_party_client is null then nullif(btrim(v_party ->> 'display_name'), '') end,
        coalesce((v_party ->> 'party_role')::public.party_role, 'other'),
        nullif(v_party ->> 'notes', ''));
    end if;
  end loop;

  return v_id;
end $$;
revoke all on function public.save_matter(jsonb, jsonb) from public, anon;
grant execute on function public.save_matter(jsonb, jsonb) to authenticated;
comment on function public.save_matter(jsonb, jsonb) is 'Creates or updates a matter and its parties atomically as the caller (RLS and guards apply).';
