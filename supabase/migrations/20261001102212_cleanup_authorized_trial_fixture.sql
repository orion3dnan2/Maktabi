-- One-time cleanup of the synthetic smoke-test fixture explicitly authorized by the owner.
-- Resolve IDs from the unique fixture marker and synthetic login, never from generated IDs.
-- On fresh databases this is a no-op. No genuine legal/business data is deleted.
do $cleanup$
declare
  v_office uuid; v_user uuid; v_source text; v_created timestamptz;
begin
  select id into v_user from auth.users where email='p249949939614@phone.maktabi.invalid';
  select o.id,r.source_hash,r.created_at into v_office,v_source,v_created
    from public.offices o join private.office_requests r on r.office_id=o.id
    where o.name='TEMP Trial Integration a321d166-2f92-4307-ae85-3621692001e4'
      and r.requested_by=v_user and r.admin_phone='+249949939614'
    for update of o,r;
  if v_user is null and not exists(select 1 from public.offices where name='TEMP Trial Integration a321d166-2f92-4307-ae85-3621692001e4') then return; end if;
  if v_office is null or v_user is null then raise exception 'cleanup fixture identity mismatch'; end if;
  if (select count(*) from public.profiles where office_id=v_office)<>1 or not exists(select 1 from public.profiles where id=v_user and office_id=v_office) then raise exception 'unexpected fixture profiles'; end if;
  if exists(select 1 from public.office_members where office_id=v_office and user_id<>v_user)
    or exists(select 1 from public.clients where office_id=v_office)
    or exists(select 1 from public.matters where office_id=v_office)
    or exists(select 1 from public.sync_receipts where office_id=v_office)
    then raise exception 'unexpected business data; refuse fixture cleanup'; end if;
  if (select count(*) from private.office_request_attempts where source_hash is not distinct from v_source and created_at between v_created-interval '10 seconds' and v_created+interval '10 seconds')<>2 then raise exception 'ambiguous attempt counters'; end if;
  delete from private.office_request_attempts where source_hash is not distinct from v_source and created_at between v_created-interval '10 seconds' and v_created+interval '10 seconds';
  delete from auth.sessions where user_id=v_user;
  delete from public.office_members where office_id=v_office and user_id=v_user;
  -- The table lock and surrounding migration transaction keep other writes out;
  -- any failure rolls back both cleanup and trigger state.
  alter table public.audit_logs disable trigger audit_logs_no_update;
  delete from public.audit_logs where office_id=v_office;
  alter table public.audit_logs enable trigger audit_logs_no_update;
  delete from auth.users where id=v_user and email='p249949939614@phone.maktabi.invalid';
  delete from public.offices where id=v_office and name='TEMP Trial Integration a321d166-2f92-4307-ae85-3621692001e4';
  if exists(select 1 from auth.users where id=v_user) or exists(select 1 from public.offices where id=v_office) then raise exception 'fixture cleanup incomplete'; end if;
end $cleanup$;
