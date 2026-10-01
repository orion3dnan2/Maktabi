-- The first draft schema (20260927113413_maktabi_init) stored whole workflows as JSON blobs and is
-- superseded by the normalized, role-aware schema that follows. It was created the same day and never
-- held data; this migration refuses to run if any row exists, so no data can be lost.
do $$
declare v_rows bigint;
begin
  select (select count(*) from public.offices) + (select count(*) from public.office_members)
       + (select count(*) from public.office_data) + (select count(*) from public.clients)
       + (select count(*) from public.matters) + (select count(*) from public.matter_workflows)
       + (select count(*) from public.client_profiles)
    into v_rows;
  if v_rows > 0 then
    raise exception 'Refusing to drop the draft schema: % rows exist. Migrate the data first.', v_rows;
  end if;
end $$;

drop function if exists public.sync_office(uuid, jsonb);
drop function if exists public.create_office(text);
drop table if exists public.client_profiles, public.matter_workflows, public.matters, public.clients,
  public.office_data, public.office_members, public.offices;
drop function if exists private.is_office_member(uuid), private.is_office_owner(uuid), private.touch_updated_at();
