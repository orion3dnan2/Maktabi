-- Row Level Security. Every decision follows: auth.uid() -> profiles -> (office_id, role) -> policy.
-- Helpers are wrapped in (select ...) so Postgres evaluates them once per statement, not per row.
-- Policies are TO authenticated only; anon has no table privileges at all.

alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.matters enable row level security;
alter table public.matter_parties enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- Table privileges: anon gets nothing; authenticated never gets TRUNCATE/REFERENCES/TRIGGER.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated, service_role;
revoke insert, delete on public.offices, public.profiles from authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------- offices
create policy offices_select on public.offices for select to authenticated
  using (id = (select private.current_office_id()));
create policy offices_update_admin on public.offices for update to authenticated
  using (id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin')
  with check (id = (select private.current_office_id()));

-- ---------------------------------------------------------------- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or office_id = (select private.current_office_id()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin'))
  with check (id = (select auth.uid()) or (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin'));

-- ---------------------------------------------------------------- clients
create policy clients_select on public.clients for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee', 'reception')
      or ((select private.current_app_role()) = 'lawyer' and (created_by = (select auth.uid()) or private.lawyer_can_see_client(id)))
    )
  );
create policy clients_insert on public.clients for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) is not null);
create policy clients_update on public.clients for update to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee', 'reception')
      or ((select private.current_app_role()) = 'lawyer' and (created_by = (select auth.uid()) or private.lawyer_can_see_client(id)))
    )
  )
  with check (office_id = (select private.current_office_id()));
create policy clients_delete_admin on public.clients for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

-- ---------------------------------------------------------------- matters (reception has no access)
create policy matters_select on public.matters for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or ((select private.current_app_role()) = 'lawyer' and (assigned_lawyer_id = (select auth.uid()) or created_by = (select auth.uid())))
    )
  );
create policy matters_insert on public.matters for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'));
create policy matters_update on public.matters for update to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or ((select private.current_app_role()) = 'lawyer' and (assigned_lawyer_id = (select auth.uid()) or created_by = (select auth.uid())))
    )
  )
  with check (office_id = (select private.current_office_id()));
create policy matters_delete_admin on public.matters for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

-- ---------------------------------------------------------------- matter_parties (follow matter access)
create policy matter_parties_select on public.matter_parties for select to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_parties_insert on public.matter_parties for insert to authenticated
  with check (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));
create policy matter_parties_update on public.matter_parties for update to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id))
  with check (office_id = (select private.current_office_id()));
create policy matter_parties_delete on public.matter_parties for delete to authenticated
  using (office_id = (select private.current_office_id()) and private.can_access_matter(matter_id));

-- ---------------------------------------------------------------- appointments
create policy appointments_select on public.appointments for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee', 'reception')
      or ((select private.current_app_role()) = 'lawyer' and (
        assigned_to = (select auth.uid()) or created_by = (select auth.uid())
        or (matter_id is not null and private.can_access_matter(matter_id))))
    )
  );
create policy appointments_insert on public.appointments for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) is not null);
create policy appointments_update on public.appointments for update to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee', 'reception')
      or ((select private.current_app_role()) = 'lawyer' and (
        assigned_to = (select auth.uid()) or created_by = (select auth.uid())
        or (matter_id is not null and private.can_access_matter(matter_id))))
    )
  )
  with check (office_id = (select private.current_office_id()));
create policy appointments_delete_admin on public.appointments for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

-- ---------------------------------------------------------------- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or assigned_to = (select auth.uid()) or created_by = (select auth.uid())
      or ((select private.current_app_role()) = 'lawyer' and matter_id is not null and private.can_access_matter(matter_id))
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    office_id = (select private.current_office_id())
    and ((select private.current_app_role()) in ('admin', 'employee', 'lawyer') or assigned_to = (select auth.uid()))
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or assigned_to = (select auth.uid()) or created_by = (select auth.uid())
      or ((select private.current_app_role()) = 'lawyer' and matter_id is not null and private.can_access_matter(matter_id))
    )
  )
  with check (
    office_id = (select private.current_office_id())
    and ((select private.current_app_role()) in ('admin', 'employee', 'lawyer') or assigned_to = (select auth.uid()))
  );
create policy tasks_delete_admin on public.tasks for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

-- ---------------------------------------------------------------- documents (reception has no access)
create policy documents_select on public.documents for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or ((select private.current_app_role()) = 'lawyer' and (
        uploaded_by = (select auth.uid())
        or (matter_id is not null and private.can_access_matter(matter_id))
        or (matter_id is null and client_id is not null and private.lawyer_can_see_client(client_id))))
    )
  );
create policy documents_insert on public.documents for insert to authenticated
  with check (office_id = (select private.current_office_id()) and (select private.current_app_role()) in ('admin', 'employee', 'lawyer'));
create policy documents_update on public.documents for update to authenticated
  using (
    office_id = (select private.current_office_id())
    and ((select private.current_app_role()) in ('admin', 'employee') or ((select private.current_app_role()) = 'lawyer' and uploaded_by = (select auth.uid())))
  )
  with check (office_id = (select private.current_office_id()));
create policy documents_delete_admin on public.documents for delete to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');

-- ---------------------------------------------------------------- payments (no reception; no deletes)
create policy payments_select on public.payments for select to authenticated
  using (
    office_id = (select private.current_office_id())
    and (
      (select private.current_app_role()) in ('admin', 'employee')
      or ((select private.current_app_role()) = 'lawyer' and matter_id is not null and private.can_access_matter(matter_id))
    )
  );
create policy payments_insert on public.payments for insert to authenticated
  with check (
    office_id = (select private.current_office_id())
    and (select private.current_app_role()) in ('admin', 'employee')
    and (matter_id is null or private.can_access_matter(matter_id))
  );
create policy payments_update_admin on public.payments for update to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin')
  with check (office_id = (select private.current_office_id()));

-- ---------------------------------------------------------------- audit_logs (admins read their office; nobody writes)
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (office_id = (select private.current_office_id()) and (select private.current_app_role()) = 'admin');
