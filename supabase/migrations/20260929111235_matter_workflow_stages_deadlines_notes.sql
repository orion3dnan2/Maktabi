-- Matter workflow, slice 1: procedure stages, deadlines, follow-up notes, office procedure
-- templates and a per-matter event log move from each device's vault to Supabase, and
-- appointments gain a link to a stage and a session outcome.
--
-- Rules the app used to check on the device are enforced here for every API caller:
--   * stages start in order, complete only with a reference, a date and every requirement done,
--     and are skipped only with a written reason; a finished stage never changes;
--   * nothing is added to or changed in the workflow of a closed or archived matter;
--   * a matter cannot be closed or archived while it has a scheduled appointment, an open
--     deadline or an unfinished stage.
-- Nothing here can be deleted through the API: there are no delete policies, and notes and
-- events are append-only. Additive only: no existing column, policy or migration is changed.

------------------------------------------------------------------------------
-- 1. Shape checks for the JSON columns (used by CHECK constraints, so they run as the caller).
------------------------------------------------------------------------------
create type public.stage_status as enum ('pending', 'active', 'completed', 'skipped');

-- {"field": "text", ...}: the free-text fields of a stage (police station, court circuit, ...).
create or replace function private.valid_stage_details(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_key text; v_value jsonb; v_count int := 0;
begin
  if jsonb_typeof(p) is distinct from 'object' then return false; end if;
  for v_key, v_value in select key, value from jsonb_each(p) loop
    v_count := v_count + 1;
    if v_count > 60 or char_length(v_key) not between 1 and 60
       or jsonb_typeof(v_value) is distinct from 'string' or char_length(v_value #>> '{}') > 2000 then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- [{"title": "...", "done": true|false}, ...]
create or replace function private.valid_stage_requirements(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_item jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > 50 then return false; end if;
  for v_item in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item -> 'title') is distinct from 'string'
       or char_length(btrim(v_item ->> 'title')) not between 1 and 300
       or jsonb_typeof(v_item -> 'done') is distinct from 'boolean' then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- [{"name": "...", "authority": "...", "requirements": ["...", ...]}, ...] (1 to 60 stages)
create or replace function private.valid_template_stages(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_stage jsonb; v_requirement jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 60 then return false; end if;
  for v_stage in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(v_stage) is distinct from 'object'
       or jsonb_typeof(v_stage -> 'name') is distinct from 'string'
       or char_length(btrim(v_stage ->> 'name')) not between 1 and 200
       or jsonb_typeof(v_stage -> 'authority') is distinct from 'string'
       or char_length(btrim(v_stage ->> 'authority')) not between 1 and 200
       or jsonb_typeof(coalesce(v_stage -> 'requirements', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(v_stage -> 'requirements', '[]'::jsonb)) > 50 then
      return false;
    end if;
    for v_requirement in select value from jsonb_array_elements(coalesce(v_stage -> 'requirements', '[]'::jsonb)) loop
      if jsonb_typeof(v_requirement) is distinct from 'string' or char_length(btrim(v_requirement #>> '{}')) not between 1 and 300 then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end $$;

revoke all on function private.valid_stage_details(jsonb), private.valid_stage_requirements(jsonb), private.valid_template_stages(jsonb) from public, anon;
grant execute on function private.valid_stage_details(jsonb), private.valid_stage_requirements(jsonb), private.valid_template_stages(jsonb) to authenticated;

------------------------------------------------------------------------------
-- 2. Tables.
------------------------------------------------------------------------------
create table public.matter_stages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  matter_id uuid not null,
  procedure_name text not null check (char_length(btrim(procedure_name)) between 1 and 200),
  position integer not null check (position between 0 and 100000),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  authority text not null check (char_length(btrim(authority)) between 1 and 200),
  reference text not null default '' check (char_length(reference) <= 100),
  stage_date date,
  status public.stage_status not null default 'pending',
  details jsonb not null default '{}' check (private.valid_stage_details(details)),
  requirements jsonb not null default '[]' check (private.valid_stage_requirements(requirements)),
  document_ids uuid[] not null default '{}' check (cardinality(document_ids) <= 100),
  notes text not null default '' check (char_length(notes) <= 10000),
  skip_reason text check (skip_reason is null or char_length(btrim(skip_reason)) between 1 and 1000),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_stages_matter_key unique (office_id, matter_id, id),
  constraint matter_stages_position_key unique (matter_id, position),
  constraint matter_stages_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict,
  constraint matter_stages_skip_reason check ((status = 'skipped') = (skip_reason is not null)),
  constraint matter_stages_finished_at check ((status in ('completed', 'skipped')) = (finished_at is not null)),
  constraint matter_stages_started_at check (status <> 'active' or started_at is not null),
  constraint matter_stages_completion check (
    status <> 'completed'
    or (btrim(reference) <> '' and stage_date is not null and not jsonb_path_exists(requirements, '$[*] ? (@.done != true)'))
  )
);
create unique index matter_stages_one_active_uidx on public.matter_stages (matter_id) where status = 'active';
create index matter_stages_created_by_idx on public.matter_stages (created_by);
comment on table public.matter_stages is 'Procedure stages of a matter (police, prosecution, court, registry ...), in order. Rows are never deleted.';
comment on column public.matter_stages.document_ids is 'Documents attached to the stage. Checked against public.documents once documents move to the server (next slice).';

alter table public.appointments
  add column stage_id uuid,
  add column outcome text check (outcome is null or char_length(btrim(outcome)) between 1 and 5000),
  add constraint appointments_stage_fk foreign key (office_id, matter_id, stage_id) references public.matter_stages (office_id, matter_id, id) on delete restrict,
  add constraint appointments_stage_has_matter check (stage_id is null or matter_id is not null),
  add constraint appointments_outcome_completed check (outcome is null or status = 'completed');
create index appointments_stage_idx on public.appointments (office_id, matter_id, stage_id) where stage_id is not null;
-- A stage has at most one upcoming appointment; saving the stage moves or cancels it.
create unique index appointments_stage_open_uidx on public.appointments (stage_id) where stage_id is not null and status in ('scheduled', 'confirmed');
comment on column public.appointments.outcome is 'What happened in the session (completed appointments only).';

create table public.matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  matter_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  due_at timestamptz not null,
  legal_basis text not null check (char_length(btrim(legal_basis)) between 1 and 2000),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_deadlines_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict
);
create index matter_deadlines_matter_idx on public.matter_deadlines (office_id, matter_id);
create index matter_deadlines_open_due_idx on public.matter_deadlines (office_id, due_at) where completed_at is null;
create index matter_deadlines_created_by_idx on public.matter_deadlines (created_by);
create index matter_deadlines_completed_by_idx on public.matter_deadlines (completed_by);
comment on table public.matter_deadlines is 'Appeal windows and other deadlines the lawyer set, with the legal basis used to compute them.';

create table public.matter_notes (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  matter_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint matter_notes_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete restrict
);
create index matter_notes_matter_idx on public.matter_notes (office_id, matter_id, created_at desc);
create index matter_notes_created_by_idx on public.matter_notes (created_by);
comment on table public.matter_notes is 'Follow-up notes. Append-only: a correction is a new note.';

create table public.procedure_templates (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default private.current_office_id() references public.offices (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  matter_types public.matter_type[] not null check (cardinality(matter_types) between 1 and 20),
  stages jsonb not null check (private.valid_template_stages(stages)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedure_templates_name_key unique (office_id, name)
);
create index procedure_templates_created_by_idx on public.procedure_templates (created_by);
comment on table public.procedure_templates is 'Procedure paths an office defined in addition to the built-in ones shipped with the app.';

create table public.matter_events (
  id bigint generated always as identity primary key,
  office_id uuid not null references public.offices (id) on delete restrict,
  matter_id uuid not null,
  kind text not null check (kind ~ '^[a-z][a-z_]{2,63}$'),
  subject text check (subject is null or char_length(subject) <= 300),
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint matter_events_matter_fk foreign key (office_id, matter_id) references public.matters (office_id, id) on delete cascade
);
create index matter_events_matter_idx on public.matter_events (office_id, matter_id, created_at desc);
create index matter_events_office_idx on public.matter_events (office_id, created_at desc);
comment on table public.matter_events is 'Activity of a matter, written only by triggers; readable by whoever can open the matter. actor_id has no FK so history survives user deletion. Not the audit trail (audit_logs).';

------------------------------------------------------------------------------
-- 3. Rules (API callers). Trusted server code (postgres/service_role) is not restricted by
--    the guards, as elsewhere; CHECK constraints and the close rule apply to everyone.
------------------------------------------------------------------------------
-- Whether a matter is closed or archived, whatever the caller may read (reception keeps the
-- calendar without seeing matters). Reveals nothing but that flag.
create or replace function private.matter_is_closed(p_matter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matters m where m.id = p_matter and m.status in ('closed', 'archived'));
$$;
revoke all on function private.matter_is_closed(uuid) from public, anon;
grant execute on function private.matter_is_closed(uuid) to authenticated;

-- The workflow of a closed or archived matter is read-only.
create or replace function private.guard_open_matter()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_api_caller() and new.matter_id is not null and private.matter_is_closed(new.matter_id) then
    raise exception 'the matter is closed; reopen it before changing its workflow' using errcode = '55000';
  end if;
  return new;
end $$;

-- A matter is closed or archived only when nothing in its workflow is still open.
-- Security definer: counts every row, whatever the caller may read.
create or replace function private.guard_matter_close()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('closed', 'archived') and old.status in ('open', 'on_hold') then
    if exists (select 1 from public.appointments a where a.office_id = new.office_id and a.matter_id = new.id and a.status in ('scheduled', 'confirmed')) then
      raise exception 'finish or cancel the scheduled appointments before closing the matter' using errcode = '55000';
    end if;
    if exists (select 1 from public.matter_deadlines d where d.office_id = new.office_id and d.matter_id = new.id and d.completed_at is null) then
      raise exception 'complete the open deadlines before closing the matter' using errcode = '55000';
    end if;
    if exists (select 1 from public.matter_stages s where s.office_id = new.office_id and s.matter_id = new.id and s.status in ('pending', 'active')) then
      raise exception 'finish or skip the remaining stages before closing the matter' using errcode = '55000';
    end if;
  end if;
  return new;
end $$;

-- Stages: added as pending after the existing ones; pending -> active in order (one active at a
-- time), active -> completed with reference, date and every requirement done, pending/active ->
-- skipped with a reason. A finished stage never changes. Start and finish times are the server's.
create or replace function private.guard_matter_stages()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_api_caller() then return new; end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      raise exception 'a new stage starts as pending' using errcode = '22023';
    end if;
    new.started_at := null; new.finished_at := null; new.skip_reason := null;
    if exists (select 1 from public.matter_stages s where s.matter_id = new.matter_id and s.position >= new.position) then
      raise exception 'new stages are added after the existing ones' using errcode = '22023';
    end if;
    return new;
  end if;

  if old.status in ('completed', 'skipped') then
    raise exception 'a finished stage cannot be changed; add a follow-up note instead' using errcode = '55000';
  end if;
  new.started_at := old.started_at;
  new.finished_at := old.finished_at;
  if new.status = old.status then
    new.skip_reason := old.skip_reason;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended('maktabi.matter_stages:' || new.matter_id::text, 0));
    if exists (
      select 1 from public.matter_stages s
      where s.matter_id = new.matter_id and s.id <> new.id
        and (s.status = 'active' or (s.status = 'pending' and s.position < new.position))
    ) then
      raise exception 'finish the earlier stages first' using errcode = '55000';
    end if;
    new.started_at := now();
  elsif old.status = 'active' and new.status = 'completed' then
    if btrim(new.reference) = '' or new.stage_date is null or jsonb_path_exists(new.requirements, '$[*] ? (@.done != true)') then
      raise exception 'a stage is completed only with its reference, its date and every requirement done' using errcode = '23514';
    end if;
    new.finished_at := now();
  elsif new.status = 'skipped' then
    if char_length(btrim(coalesce(new.skip_reason, ''))) = 0 then
      raise exception 'a reason is required to skip a stage' using errcode = '23514';
    end if;
    new.skip_reason := btrim(new.skip_reason);
    new.finished_at := now();
  else
    raise exception 'a stage cannot move from % to %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end $$;

-- Deadlines: only completion can change, once; the time and the user are the server's.
create or replace function private.guard_matter_deadlines()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_api_caller() then return new; end if;
  if tg_op = 'INSERT' then
    new.completed_at := null; new.completed_by := null;
  elsif old.completed_at is not null then
    raise exception 'a completed deadline cannot be changed' using errcode = '55000';
  elsif new.completed_at is not null then
    new.completed_at := now(); new.completed_by := (select auth.uid());
  else
    new.completed_by := null;
  end if;
  return new;
end $$;

-- Appointments: reception keeps the calendar but does not record session outcomes or stages.
-- A recorded session is final, like a finished stage: corrections go in a follow-up note.
create or replace function private.guard_appointment_workflow()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_api_caller() then return new; end if;
  if tg_op = 'UPDATE' and old.outcome is not null
     and (new.outcome, new.status, new.starts_at) is distinct from (old.outcome, old.status, old.starts_at) then
    raise exception 'a recorded session cannot be changed; add a follow-up note instead' using errcode = '55000';
  end if;
  if private.current_app_role() = 'reception'
     and (case when tg_op = 'INSERT' then (new.outcome, new.stage_id) is distinct from (null::text, null::uuid)
               else (new.outcome, new.stage_id) is distinct from (old.outcome, old.stage_id) end) then
    raise exception 'reception cannot record session outcomes or stages' using errcode = '42501';
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- 4. Event log, written by triggers only (security definer: the caller has no INSERT on it).
------------------------------------------------------------------------------
create or replace function private.matter_event_matters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.matter_events (office_id, matter_id, kind, subject, actor_id) values (new.office_id, new.id, 'matter_created', left(new.title, 300), v_uid);
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.matter_events (office_id, matter_id, kind, actor_id) values (new.office_id, new.id,
      case
        when new.status = 'closed' then 'matter_closed'
        when new.status = 'archived' then 'matter_archived'
        when new.status = 'on_hold' then 'matter_on_hold'
        when old.status = 'on_hold' then 'matter_resumed'
        else 'matter_reopened'
      end, v_uid);
  end if;
  if new.assigned_lawyer_id is distinct from old.assigned_lawyer_id then
    insert into public.matter_events (office_id, matter_id, kind, subject, actor_id)
    select new.office_id, new.id, 'matter_reassigned', left(p.full_name, 300), v_uid
    from (select 1) one left join public.profiles p on p.id = new.assigned_lawyer_id;
  end if;
  return null;
end $$;

create or replace function private.matter_event_appointments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  if new.matter_id is null then return null; end if;
  if tg_op = 'INSERT' or old.matter_id is distinct from new.matter_id then
    v_kind := 'appointment_scheduled';
  elsif new.status is distinct from old.status and new.status = 'completed' then
    v_kind := case when new.outcome is not null then 'session_recorded' else 'appointment_completed' end;
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    v_kind := 'appointment_cancelled';
  elsif new.status is distinct from old.status and new.status = 'no_show' then
    v_kind := 'appointment_no_show';
  elsif new.status in ('scheduled', 'confirmed') and (old.status not in ('scheduled', 'confirmed') or new.starts_at is distinct from old.starts_at) then
    v_kind := 'appointment_rescheduled';
  else
    return null;
  end if;
  insert into public.matter_events (office_id, matter_id, kind, subject, actor_id)
  values (new.office_id, new.matter_id, v_kind, left(new.title, 300), (select auth.uid()));
  return null;
end $$;

-- One event per procedure added (statement level: a procedure is inserted in one statement).
create or replace function private.matter_event_procedures()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.matter_events (office_id, matter_id, kind, subject, actor_id)
  select distinct on (n.matter_id, n.procedure_name) n.office_id, n.matter_id, 'procedure_added', left(n.procedure_name, 300), (select auth.uid())
  from new_stages n
  order by n.matter_id, n.procedure_name, n.position;
  return null;
end $$;

create or replace function private.matter_event_stages()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  if new.status is distinct from old.status then
    v_kind := case new.status when 'active' then 'stage_started' when 'completed' then 'stage_completed' when 'skipped' then 'stage_skipped' else 'stage_updated' end;
  elsif (new.name, new.authority, new.reference, new.stage_date, new.details, new.requirements, new.document_ids, new.notes)
        is distinct from (old.name, old.authority, old.reference, old.stage_date, old.details, old.requirements, old.document_ids, old.notes) then
    v_kind := 'stage_updated';
  else
    return null;
  end if;
  insert into public.matter_events (office_id, matter_id, kind, subject, actor_id)
  values (new.office_id, new.matter_id, v_kind, left(new.name, 300), (select auth.uid()));
  return null;
end $$;

create or replace function private.matter_event_deadlines()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.matter_events (office_id, matter_id, kind, subject, actor_id) values (new.office_id, new.matter_id, 'deadline_added', left(new.title, 300), (select auth.uid()));
  elsif old.completed_at is null and new.completed_at is not null then
    insert into public.matter_events (office_id, matter_id, kind, subject, actor_id) values (new.office_id, new.matter_id, 'deadline_completed', left(new.title, 300), (select auth.uid()));
  end if;
  return null;
end $$;

create or replace function private.matter_event_notes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.matter_events (office_id, matter_id, kind, actor_id) values (new.office_id, new.matter_id, 'note_added', (select auth.uid()));
  return null;
end $$;

create or replace function private.matter_events_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'matter_events is append-only' using errcode = '42501';
end $$;

------------------------------------------------------------------------------
-- 5. Triggers.
------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['matter_stages', 'matter_deadlines', 'procedure_templates'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
  foreach t in array array['matter_stages', 'matter_deadlines', 'matter_notes', 'procedure_templates'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function private.stamp_actor(%L)', t || '_stamp_actor', t, 'created_by');
  end loop;
  foreach t in array array['matter_stages', 'matter_deadlines', 'matter_notes', 'appointments'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.guard_open_matter()', t || '_open_matter', t);
  end loop;
end $$;

create trigger matter_stages_immutable before update on public.matter_stages
  for each row execute function private.forbid_column_changes('id', 'office_id', 'matter_id', 'procedure_name', 'position', 'created_by', 'created_at');
create trigger matter_deadlines_immutable before update on public.matter_deadlines
  for each row execute function private.forbid_column_changes('id', 'office_id', 'matter_id', 'title', 'due_at', 'legal_basis', 'created_by', 'created_at');
create trigger procedure_templates_immutable before update on public.procedure_templates
  for each row execute function private.forbid_column_changes('id', 'office_id', 'created_by', 'created_at');

create trigger matter_stages_guard before insert or update on public.matter_stages for each row execute function private.guard_matter_stages();
create trigger matter_deadlines_guard before insert or update on public.matter_deadlines for each row execute function private.guard_matter_deadlines();
create trigger appointments_workflow_guard before insert or update on public.appointments for each row execute function private.guard_appointment_workflow();
create trigger matters_close_guard before update of status on public.matters for each row execute function private.guard_matter_close();

create trigger matter_stages_audit after insert or update or delete on public.matter_stages for each row execute function private.audit_row('matter_stage');
create trigger matter_deadlines_audit after insert or update or delete on public.matter_deadlines for each row execute function private.audit_row('matter_deadline');
create trigger matter_notes_audit after insert or update or delete on public.matter_notes for each row execute function private.audit_row('matter_note');
create trigger procedure_templates_audit after insert or update or delete on public.procedure_templates for each row execute function private.audit_row('procedure_template');

create trigger matters_events after insert or update of status, assigned_lawyer_id on public.matters for each row execute function private.matter_event_matters();
create trigger appointments_events after insert or update on public.appointments for each row execute function private.matter_event_appointments();
create trigger matter_stages_procedure_events after insert on public.matter_stages referencing new table as new_stages for each statement execute function private.matter_event_procedures();
create trigger matter_stages_events after update on public.matter_stages for each row execute function private.matter_event_stages();
create trigger matter_deadlines_events after insert or update on public.matter_deadlines for each row execute function private.matter_event_deadlines();
create trigger matter_notes_events after insert on public.matter_notes for each row execute function private.matter_event_notes();
create trigger matter_events_no_update before update on public.matter_events for each row execute function private.matter_events_immutable();
create trigger matter_events_no_truncate before truncate on public.matter_events for each statement execute function private.matter_events_immutable();

revoke all on function
  private.guard_open_matter(), private.guard_matter_close(), private.guard_matter_stages(), private.guard_matter_deadlines(),
  private.guard_appointment_workflow(), private.matter_event_matters(), private.matter_event_appointments(),
  private.matter_event_procedures(), private.matter_event_stages(), private.matter_event_deadlines(),
  private.matter_event_notes(), private.matter_events_immutable()
  from public, anon, authenticated;

------------------------------------------------------------------------------
-- 6. Row Level Security. The workflow follows the matter: whoever can open the matter
--    (private.can_access_matter: admin/employee of the office, or its lawyer) reads and adds
--    to it. Reception and client accounts have no access. Nothing is deleted.
------------------------------------------------------------------------------
alter table public.matter_stages enable row level security;
alter table public.matter_deadlines enable row level security;
alter table public.matter_notes enable row level security;
alter table public.procedure_templates enable row level security;
alter table public.matter_events enable row level security;

revoke all on public.matter_stages, public.matter_deadlines, public.matter_notes, public.procedure_templates, public.matter_events from anon;
revoke truncate, references, trigger on public.matter_stages, public.matter_deadlines, public.matter_notes, public.procedure_templates, public.matter_events from authenticated;
revoke delete on public.matter_stages, public.matter_deadlines from authenticated;
revoke update, delete on public.matter_notes from authenticated;
revoke insert, update, delete on public.matter_events from authenticated, service_role;

create policy matter_stages_select on public.matter_stages for select to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_stages_insert on public.matter_stages for insert to authenticated
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_stages_update on public.matter_stages for update to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id))
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));

create policy matter_deadlines_select on public.matter_deadlines for select to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_deadlines_insert on public.matter_deadlines for insert to authenticated
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_deadlines_update on public.matter_deadlines for update to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id))
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));

create policy matter_notes_select on public.matter_notes for select to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_notes_insert on public.matter_notes for insert to authenticated
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));

create policy matter_events_select on public.matter_events for select to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));

create policy procedure_templates_select on public.procedure_templates for select to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'));
create policy procedure_templates_insert on public.procedure_templates for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'));
create policy procedure_templates_update on public.procedure_templates for update to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'))
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'));
create policy procedure_templates_delete_admin on public.procedure_templates for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

------------------------------------------------------------------------------
-- 7. Progress of each matter for lists: the next scheduled appointment and the current stage
--    (the stage last started or finished; the latest note while the matter has no stages).
--    security_invoker: the caller's RLS applies to every table it reads.
------------------------------------------------------------------------------
create view public.matter_progress with (security_invoker = true) as
select
  m.id as matter_id,
  (select min(a.starts_at) from public.appointments a
    where a.office_id = m.office_id and a.matter_id = m.id and a.status in ('scheduled', 'confirmed')) as next_event_at,
  coalesce(
    (select s.name from public.matter_stages s
      where s.office_id = m.office_id and s.matter_id = m.id and s.status <> 'pending'
      order by greatest(s.started_at, s.finished_at) desc, s.position desc limit 1),
    (select left(n.body, 200) from public.matter_notes n
      where n.office_id = m.office_id and n.matter_id = m.id
        and not exists (select 1 from public.matter_stages s where s.office_id = m.office_id and s.matter_id = m.id)
      order by n.created_at desc limit 1)
  ) as current_stage
from public.matters m;
revoke all on public.matter_progress from anon, authenticated;
grant select on public.matter_progress to authenticated;

------------------------------------------------------------------------------
-- 8. Operations that change several rows at once, as the caller (SECURITY INVOKER: every
--    policy, guard and foreign key above applies).
------------------------------------------------------------------------------
-- Appends a procedure path (its stages, pending, in order) to a matter.
-- p_stages: [{name, authority, requirements: [text]}]
create or replace function public.append_procedure(p_matter uuid, p_name text, p_stages jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare v_office uuid; v_next integer; v_count integer;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 200 or not private.valid_template_stages(p_stages) then
    raise exception 'a procedure needs a name and stages with a name and an authority' using errcode = '22023';
  end if;
  select m.office_id into v_office from public.matters m where m.id = p_matter;
  if v_office is null then
    raise exception 'matter not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('maktabi.matter_stages:' || p_matter::text, 0));
  if exists (select 1 from public.matter_stages s where s.matter_id = p_matter and s.status in ('pending', 'active')) then
    raise exception 'finish or skip the current procedure before adding another' using errcode = '55000';
  end if;
  select coalesce(max(s.position) + 1, 0) into v_next from public.matter_stages s where s.matter_id = p_matter;
  insert into public.matter_stages (office_id, matter_id, procedure_name, position, name, authority, requirements)
  select v_office, p_matter, btrim(p_name), v_next + t.ord::integer - 1, btrim(t.stage ->> 'name'), btrim(t.stage ->> 'authority'),
    coalesce((select jsonb_agg(jsonb_build_object('title', btrim(r.value #>> '{}'), 'done', false) order by r.ord)
              from jsonb_array_elements(coalesce(t.stage -> 'requirements', '[]'::jsonb)) with ordinality as r(value, ord)), '[]'::jsonb)
  from jsonb_array_elements(p_stages) with ordinality as t(stage, ord)
  order by t.ord;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Saves a stage's data and its next appointment (a court session): p_next_at schedules or
-- moves it, null cancels the one still scheduled. Status changes are plain updates of
-- matter_stages.status (the guard checks them).
-- p_stage: {id, name, authority, reference, stage_date, details, requirements, document_ids, notes}
create or replace function public.save_stage(p_stage jsonb, p_next_at timestamptz default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_stage public.matter_stages; v_appointment uuid; v_title text;
begin
  update public.matter_stages set
    name = btrim(p_stage ->> 'name'),
    authority = btrim(p_stage ->> 'authority'),
    reference = btrim(coalesce(p_stage ->> 'reference', '')),
    stage_date = nullif(p_stage ->> 'stage_date', '')::date,
    details = coalesce(p_stage -> 'details', '{}'::jsonb),
    requirements = coalesce(p_stage -> 'requirements', '[]'::jsonb),
    document_ids = coalesce((select array_agg(d.value::uuid) from jsonb_array_elements_text(coalesce(p_stage -> 'document_ids', '[]'::jsonb)) as d(value)), '{}'::uuid[]),
    notes = coalesce(p_stage ->> 'notes', '')
  where id = (p_stage ->> 'id')::uuid
  returning * into v_stage;
  if not found then
    raise exception 'stage not found' using errcode = 'P0002';
  end if;

  v_title := left(v_stage.name || ' · ' || v_stage.authority, 300);
  select a.id into v_appointment from public.appointments a
   where a.stage_id = v_stage.id and a.status in ('scheduled', 'confirmed');
  if p_next_at is not null then
    if v_appointment is null then
      insert into public.appointments (matter_id, stage_id, title, appointment_type, starts_at)
      values (v_stage.matter_id, v_stage.id, v_title, 'court_session', p_next_at);
    else
      update public.appointments set starts_at = p_next_at, title = v_title where id = v_appointment;
    end if;
  elsif v_appointment is not null then
    update public.appointments set status = 'cancelled' where id = v_appointment;
  end if;
end $$;

-- Records a session's outcome and, optionally, schedules the next one (same matter, stage,
-- type and title). Returns the new appointment's id, or null.
create or replace function public.finish_session(p_appointment uuid, p_outcome text, p_next_at timestamptz default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_done public.appointments; v_next uuid;
begin
  if char_length(btrim(coalesce(p_outcome, ''))) = 0 then
    raise exception 'write the session outcome' using errcode = '22023';
  end if;
  update public.appointments set status = 'completed', outcome = btrim(p_outcome)
   where id = p_appointment and status in ('scheduled', 'confirmed')
  returning * into v_done;
  if not found then
    raise exception 'choose a scheduled appointment' using errcode = 'P0002';
  end if;
  if p_next_at is not null then
    if p_next_at <= v_done.starts_at then
      raise exception 'the next session must come after this one' using errcode = '22023';
    end if;
    insert into public.appointments (client_id, matter_id, stage_id, assigned_to, title, appointment_type, starts_at, location)
    values (v_done.client_id, v_done.matter_id, v_done.stage_id, v_done.assigned_to, v_done.title, v_done.appointment_type, p_next_at, v_done.location)
    returning id into v_next;
  end if;
  return v_next;
end $$;

revoke all on function public.append_procedure(uuid, text, jsonb), public.save_stage(jsonb, timestamptz), public.finish_session(uuid, text, timestamptz) from public, anon;
grant execute on function public.append_procedure(uuid, text, jsonb), public.save_stage(jsonb, timestamptz), public.finish_session(uuid, text, timestamptz) to authenticated;
comment on function public.append_procedure(uuid, text, jsonb) is 'Appends a procedure path to a matter as the caller (RLS and guards apply).';
comment on function public.save_stage(jsonb, timestamptz) is 'Saves a stage and schedules, moves or cancels its next court session as the caller (RLS and guards apply).';
comment on function public.finish_session(uuid, text, timestamptz) is 'Records a session outcome and schedules the next session as the caller (RLS and guards apply).';
