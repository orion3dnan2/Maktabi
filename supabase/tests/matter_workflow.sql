-- Matter workflow (slice 1) regression test: procedure stages, appointments linked to stages,
-- deadlines, notes, office templates, the event log and the matter_progress view.
-- Run in the SQL editor (or via MCP execute_sql) after any change to these tables, their
-- policies/guards, append_procedure(), save_stage() or finish_session(). Everything runs in
-- one DO block that ends with RAISE, so all test data is rolled back.
-- Read the result line: every check prints "name=ok"; any "FAIL" means the test failed.
-- The last entry is "failures=N" (expected: failures=0).
do $test$
declare
  u_owner uuid := gen_random_uuid(); u_adminA uuid := gen_random_uuid(); u_lawyerA uuid := gen_random_uuid();
  u_lawyerA2 uuid := gen_random_uuid(); u_empA uuid := gen_random_uuid(); u_recA uuid := gen_random_uuid();
  u_portal uuid := gen_random_uuid(); u_adminB uuid := gen_random_uuid();
  oA uuid; oB uuid; cA uuid; cB uuid; mA uuid; mA2 uuid; mB uuid;
  s1 uuid; s2 uuid; s3 uuid; ap1 uuid; ap2 uuid; ap3 uuid; dl uuid;
  r text := ''; fails int := 0; n bigint; t text; ts timestamptz; ok boolean; c text[]; checks text[];
  stage1 jsonb;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select id, 'p' || replace(id::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_owner, u_adminA, u_lawyerA, u_lawyerA2, u_empA, u_recA, u_portal, u_adminB]) id;
  insert into private.platform_admins values (u_owner);
  oA := public.svc_create_office(u_owner, u_adminA, 'مدير أ', '+249900000001', 'Office A', 'مكتب أ', null);
  oB := public.svc_create_office(u_owner, u_adminB, 'مدير ب', '+249900000002', 'Office B', 'مكتب ب', null);
  perform public.svc_add_member(u_adminA, u_lawyerA, 'lawyer', 'محامي أ', '+249900000003');
  perform public.svc_add_member(u_adminA, u_lawyerA2, 'lawyer', 'محامي أ٢', '+249900000004');
  perform public.svc_add_member(u_adminA, u_empA, 'employee', 'موظف أ', '+249900000005');
  perform public.svc_add_member(u_adminA, u_recA, 'reception', 'استقبال أ', '+249900000006');
  insert into public.clients (office_id, full_name, whatsapp) values (oA, 'موكل أ', '+249911000001') returning id into cA;
  insert into public.clients (office_id, full_name, whatsapp) values (oB, 'موكل ب', '+249911000002') returning id into cB;
  perform public.svc_link_client_login(u_adminA, u_portal, cA, '+249911000009');
  insert into public.matters (office_id, client_id, assigned_lawyer_id, matter_number, title, matter_type) values (oA, cA, u_lawyerA, 'A-1', 'قضية أ', 'civil') returning id into mA;
  insert into public.matters (office_id, client_id, assigned_lawyer_id, matter_number, title, matter_type) values (oA, cA, u_lawyerA2, 'A-2', 'قضية أ٢', 'civil') returning id into mA2;
  insert into public.matters (office_id, client_id, matter_number, title, matter_type) values (oB, cB, 'B-1', 'قضية ب', 'civil') returning id into mB;

  -------------------------------------------------------------- Office A admin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- a procedure path: three pending stages in order, requirements not done
  begin
    n := public.append_procedure(mA, 'التقاضي أمام أول درجة',
      '[{"name": "قيد الدعوى", "authority": "المحكمة", "requirements": ["عريضة الدعوى"]}, {"name": "الإعلان", "authority": "المحكمة"}, {"name": "الحكم", "authority": "المحكمة"}]');
    select id into s1 from public.matter_stages where matter_id = mA and position = 0;
    select id into s2 from public.matter_stages where matter_id = mA and position = 1;
    select id into s3 from public.matter_stages where matter_id = mA and position = 2;
    if n = 3 and s3 is not null
       and (select requirements from public.matter_stages where id = s1) = '[{"title": "عريضة الدعوى", "done": false}]'::jsonb
       and not exists (select 1 from public.matter_stages where matter_id = mA and status <> 'pending')
       and (select count(*) from public.matter_events where matter_id = mA and kind = 'procedure_added' and subject = 'التقاضي أمام أول درجة') = 1
      then r := r || 'A.appendProcedure=ok; '; else r := r || 'A.appendProcedure=FAIL(' || n || '); '; fails := fails + 1; end if;
  exception when others then r := r || 'A.appendProcedure=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;

  -- refused changes (label, statement, expected error)
  checks := array[
    ['A.appendWhilePending', format('select public.append_procedure(%L, %L, %L)', mA, 'x', '[{"name": "a", "authority": "b"}]'), '%finish or skip the current procedure%'],
    ['A.startOutOfOrder', format('update public.matter_stages set status = %L where id = %L', 'active', s2), '%finish the earlier stages first%'],
    ['A.completePending', format('update public.matter_stages set status = %L, reference = %L, stage_date = %L where id = %L', 'completed', '1', '2026-09-01', s1), '%cannot move from pending to completed%'],
    ['A.insertActiveStage', format('insert into public.matter_stages (matter_id, procedure_name, position, name, authority, status) values (%L, %L, 10, %L, %L, %L)', mA, 'x', 'x', 'x', 'active'), '%starts as pending%'],
    ['A.insertBeforeExisting', format('insert into public.matter_stages (matter_id, procedure_name, position, name, authority) values (%L, %L, 1, %L, %L)', mA, 'x', 'x', 'x'), '%after the existing ones%'],
    ['A.badRequirements', format('update public.matter_stages set requirements = %L where id = %L', '[{"title": ""}]', s1), '%matter_stages_requirements_check%'],
    ['A.badDetails', format('update public.matter_stages set details = %L where id = %L', '{"bench": 1}', s1), '%matter_stages_details_check%'],
    ['A.badProcedure', format('select public.append_procedure(%L, %L, %L)', mA2, 'x', '[{"name": "a"}]'), '%needs a name and stages%'],
    ['A.appendOtherOffice', format('select public.append_procedure(%L, %L, %L)', mB, 'x', '[{"name": "a", "authority": "b"}]'), '%matter not found%'],
    ['A.stageIntoOtherOffice', format('insert into public.matter_stages (office_id, matter_id, procedure_name, position, name, authority) values (%L, %L, %L, 0, %L, %L)', oB, mB, 'x', 'x', 'x'), '%row-level security%'],
    ['A.noteIntoOtherOffice', format('insert into public.matter_notes (office_id, matter_id, body) values (%L, %L, %L)', oB, mB, 'x'), '%row-level security%'],
    ['A.deadlineOnOtherOfficeMatter', format('insert into public.matter_deadlines (matter_id, title, due_at, legal_basis) values (%L, %L, now(), %L)', mB, 'x', 'x'), '%row-level security%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;

  -- start the first stage; completing it needs its reference, date and requirements
  update public.matter_stages set status = 'active', started_at = '2000-01-01' where id = s1;
  if exists (select 1 from public.matter_stages where id = s1 and status = 'active' and started_at > now() - interval '1 minute')
    then r := r || 'A.startFirst=ok; '; else r := r || 'A.startFirst=FAIL; '; fails := fails + 1; end if;
  begin update public.matter_stages set status = 'completed' where id = s1; r := r || 'A.completeWithoutRecord=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%completed only with%' then r := r || 'A.completeWithoutRecord=ok; '; else r := r || 'A.completeWithoutRecord=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;

  -- saving a stage schedules its court session, then moves it
  stage1 := jsonb_build_object('id', s1, 'name', 'قيد الدعوى', 'authority', 'المحكمة', 'reference', 'ق م/1234/2026', 'stage_date', '2026-09-20',
    'details', jsonb_build_object('bench', 'الدائرة الأولى'), 'requirements', '[{"title": "عريضة الدعوى", "done": true}]'::jsonb, 'document_ids', '[]'::jsonb, 'notes', 'تم القيد');
  begin
    perform public.save_stage(stage1, now() + interval '2 days');
    select id into ap1 from public.appointments where stage_id = s1 and status = 'scheduled';
    if ap1 is not null and exists (select 1 from public.appointments where id = ap1 and appointment_type = 'court_session' and matter_id = mA and title = 'قيد الدعوى · المحكمة')
       and exists (select 1 from public.matter_stages where id = s1 and reference = 'ق م/1234/2026' and details ->> 'bench' = 'الدائرة الأولى')
      then r := r || 'A.saveStage=ok; '; else r := r || 'A.saveStage=FAIL; '; fails := fails + 1; end if;
    perform public.save_stage(stage1, now() + interval '3 days');
    if (select count(*) from public.appointments where stage_id = s1 and status = 'scheduled') = 1
       and (select starts_at from public.appointments where id = ap1) > now() + interval '2 days 23 hours'
      then r := r || 'A.saveStageMoves=ok; '; else r := r || 'A.saveStageMoves=FAIL; '; fails := fails + 1; end if;
  exception when others then r := r || 'A.saveStage=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;

  -- a session outcome and the next session (same stage)
  begin
    ap2 := public.finish_session(ap1, 'تأجيل لإعلان الطرف الآخر', now() + interval '10 days');
    if exists (select 1 from public.appointments where id = ap1 and status = 'completed' and outcome = 'تأجيل لإعلان الطرف الآخر')
       and exists (select 1 from public.appointments where id = ap2 and status = 'scheduled' and stage_id = s1 and appointment_type = 'court_session')
      then r := r || 'A.finishSession=ok; '; else r := r || 'A.finishSession=FAIL; '; fails := fails + 1; end if;
  exception when others then r := r || 'A.finishSession=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;

  checks := array[
    ['A.finishTwice', format('select public.finish_session(%L, %L)', ap1, 'x'), '%choose a scheduled appointment%'],
    ['A.sessionFrozen', format('update public.appointments set outcome = %L where id = %L', 'x', ap1), '%recorded session cannot be changed%'],
    ['A.finishWithoutOutcome', format('select public.finish_session(%L, %L)', ap2, '  '), '%write the session outcome%'],
    ['A.nextBeforeSession', format('select public.finish_session(%L, %L, now())', ap2, 'x'), '%must come after this one%'],
    ['A.outcomeOnlyCompleted', format('insert into public.appointments (matter_id, title, starts_at, outcome) values (%L, %L, now(), %L)', mA, 'x', 'y'), '%appointments_outcome_completed%'],
    ['A.stageOfOtherMatter', format('insert into public.appointments (matter_id, stage_id, title, starts_at) values (%L, %L, %L, now())', mA2, s2, 'x'), '%appointments_stage_fk%'],
    ['A.secondOpenStageSession', format('insert into public.appointments (matter_id, stage_id, title, starts_at) values (%L, %L, %L, now())', mA, s1, 'x'), '%appointments_stage_open_uidx%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;

  -- complete, skip, start; finished stages are frozen and times are the server's
  begin
    update public.matter_stages set status = 'completed', finished_at = '2000-01-01' where id = s1;
    if exists (select 1 from public.matter_stages where id = s1 and status = 'completed' and finished_at > now() - interval '1 minute')
      then r := r || 'A.completeStage=ok; '; else r := r || 'A.completeStage=FAIL; '; fails := fails + 1; end if;
  exception when others then r := r || 'A.completeStage=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin update public.matter_stages set status = 'skipped' where id = s2; r := r || 'A.skipWithoutReason=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%reason is required%' then r := r || 'A.skipWithoutReason=ok; '; else r := r || 'A.skipWithoutReason=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  update public.matter_stages set status = 'skipped', skip_reason = '  غير لازمة  ' where id = s2;
  update public.matter_stages set status = 'active' where id = s3;
  if exists (select 1 from public.matter_stages where id = s2 and status = 'skipped' and skip_reason = 'غير لازمة' and finished_at is not null)
     and exists (select 1 from public.matter_stages where id = s3 and status = 'active')
    then r := r || 'A.skipAndStart=ok; '; else r := r || 'A.skipAndStart=FAIL; '; fails := fails + 1; end if;

  checks := array[
    ['A.finishedFrozen', format('update public.matter_stages set notes = %L where id = %L', 'x', s1), '%finished stage cannot be changed%'],
    ['A.backwards', format('update public.matter_stages set status = %L where id = %L', 'pending', s3), '%cannot move from active to pending%'],
    ['A.positionFixed', format('update public.matter_stages set position = 50 where id = %L', s3), '%column position cannot be changed%'],
    ['A.stageDelete', format('delete from public.matter_stages where id = %L', s3), '%permission denied%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;

  -- deadlines and notes
  insert into public.matter_deadlines (matter_id, title, due_at, legal_basis, completed_at)
  values (mA, 'مهلة الاستئناف', now() + interval '15 days', 'خمسة عشر يوماً من تاريخ إعلان الحكم', now()) returning id into dl;
  if exists (select 1 from public.matter_deadlines where id = dl and completed_at is null and completed_by is null and created_by = u_adminA)
    then r := r || 'A.addDeadline=ok; '; else r := r || 'A.addDeadline=FAIL; '; fails := fails + 1; end if;
  insert into public.matter_notes (matter_id, body) values (mA, 'تم التواصل مع الموكل');
  if exists (select 1 from public.matter_notes where matter_id = mA and created_by = u_adminA)
    then r := r || 'A.addNote=ok; '; else r := r || 'A.addNote=FAIL; '; fails := fails + 1; end if;

  checks := array[
    ['A.deadlineNeedsBasis', format('insert into public.matter_deadlines (matter_id, title, due_at, legal_basis) values (%L, %L, now(), %L)', mA, 'x', ' '), '%matter_deadlines_legal_basis_check%'],
    ['A.deadlineFrozen', format('update public.matter_deadlines set title = %L where id = %L', 'x', dl), '%column title cannot be changed%'],
    ['A.deadlineDelete', format('delete from public.matter_deadlines where id = %L', dl), '%permission denied%'],
    ['A.noteUpdate', format('update public.matter_notes set body = %L where matter_id = %L', 'x', mA), '%permission denied%'],
    ['A.noteDelete', format('delete from public.matter_notes where matter_id = %L', mA), '%permission denied%'],
    ['A.eventInsert', format('insert into public.matter_events (office_id, matter_id, kind) values (%L, %L, %L)', oA, mA, 'fake_event'), '%permission denied%'],
    ['A.eventUpdate', 'update public.matter_events set kind = ''fake_event''', '%permission denied%'],
    ['A.eventDelete', 'delete from public.matter_events', '%permission denied%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;

  -- progress view: next scheduled session and the stage last started
  select current_stage, next_event_at into t, ts from public.matter_progress where matter_id = mA;
  if t = 'الحكم' and ts = (select starts_at from public.appointments where id = ap2)
    then r := r || 'A.progress=ok; '; else r := r || 'A.progress=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;

  -- closing waits for appointments, deadlines and stages; then the workflow is read-only
  begin update public.matters set status = 'closed' where id = mA; r := r || 'A.closeWithSession=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%scheduled appointments%' then r := r || 'A.closeWithSession=ok; '; else r := r || 'A.closeWithSession=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  update public.appointments set status = 'cancelled' where id = ap2;
  begin update public.matters set status = 'closed' where id = mA; r := r || 'A.closeWithDeadline=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%open deadlines%' then r := r || 'A.closeWithDeadline=ok; '; else r := r || 'A.closeWithDeadline=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  update public.matter_deadlines set completed_at = '2000-01-01' where id = dl;
  if exists (select 1 from public.matter_deadlines where id = dl and completed_at > now() - interval '1 minute' and completed_by = u_adminA)
    then r := r || 'A.completeDeadline=ok; '; else r := r || 'A.completeDeadline=FAIL; '; fails := fails + 1; end if;
  begin update public.matter_deadlines set completed_at = null where id = dl; r := r || 'A.deadlineReopen=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%completed deadline cannot be changed%' then r := r || 'A.deadlineReopen=ok; '; else r := r || 'A.deadlineReopen=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  begin update public.matters set status = 'closed' where id = mA; r := r || 'A.closeWithStage=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%remaining stages%' then r := r || 'A.closeWithStage=ok; '; else r := r || 'A.closeWithStage=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  update public.matter_stages set status = 'skipped', skip_reason = 'انتهت بالصلح' where id = s3;
  begin
    update public.matters set status = 'closed' where id = mA;
    r := r || 'A.close=ok; ';
  exception when others then r := r || 'A.close=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  checks := array[
    ['A.closedNote', format('insert into public.matter_notes (matter_id, body) values (%L, %L)', mA, 'x'), '%matter is closed%'],
    ['A.closedAppointment', format('insert into public.appointments (matter_id, title, starts_at) values (%L, %L, now())', mA, 'x'), '%matter is closed%'],
    ['A.closedDeadline', format('insert into public.matter_deadlines (matter_id, title, due_at, legal_basis) values (%L, %L, now(), %L)', mA, 'x', 'x'), '%matter is closed%'],
    ['A.closedProcedure', format('select public.append_procedure(%L, %L, %L)', mA, 'x', '[{"name": "a", "authority": "b"}]'), '%matter is closed%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;
  -- ap2 (cancelled) belongs to the closed matter: reception, who cannot see matters, may not bring it back either.
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_recA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin update public.appointments set status = 'scheduled' where id = ap2; r := r || 'reception.reviveOnClosedMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%matter is closed%' then r := r || 'reception.reviveOnClosedMatter=ok; '; else r := r || 'reception.reviveOnClosedMatter=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- archiving follows the same rule
  insert into public.matter_deadlines (matter_id, title, due_at, legal_basis) values (mA2, 'مهلة', now() + interval '5 days', 'قرار المحكمة');
  begin update public.matters set status = 'archived' where id = mA2; r := r || 'A.archiveWithDeadline=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%open deadlines%' then r := r || 'A.archiveWithDeadline=ok; '; else r := r || 'A.archiveWithDeadline=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  -- reopening makes it writable again; a new court session for the portal check
  begin
    update public.matters set status = 'open' where id = mA;
    insert into public.appointments (matter_id, title, appointment_type, starts_at) values (mA, 'جلسة المرافعة', 'court_session', now() + interval '7 days') returning id into ap3;
    r := r || 'A.reopen=ok; ';
  exception when others then r := r || 'A.reopen=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  -- reassignment is logged with the new lawyer's name
  update public.matters set assigned_lawyer_id = u_adminA where id = mA2;
  update public.matters set assigned_lawyer_id = u_lawyerA2 where id = mA2;
  if (select count(*) from public.matter_events where matter_id = mA2 and kind = 'matter_reassigned' and subject in ('مدير أ', 'محامي أ٢')) = 2
    then r := r || 'A.reassignEvent=ok; '; else r := r || 'A.reassignEvent=FAIL; '; fails := fails + 1; end if;

  -- the event log has every step, by this user
  select string_agg(k, ',') into t from unnest(array['matter_created', 'procedure_added', 'stage_started', 'stage_updated', 'appointment_scheduled',
    'appointment_rescheduled', 'session_recorded', 'appointment_cancelled', 'stage_completed', 'stage_skipped', 'deadline_added',
    'deadline_completed', 'note_added', 'matter_closed', 'matter_reopened']) k
  where not exists (select 1 from public.matter_events e where e.matter_id = mA and e.kind = k);
  if t is null and (select actor_id from public.matter_events where matter_id = mA and kind = 'note_added') = u_adminA
    then r := r || 'A.events=ok; '; else r := r || 'A.events=FAIL(missing ' || coalesce(t, 'actor') || '); '; fails := fails + 1; end if;

  -- office procedure templates
  begin
    insert into public.procedure_templates (name, matter_types, stages) values ('مسار المكتب', '{civil,labour}', '[{"name": "تسوية ودية", "authority": "المكتب", "requirements": ["خطاب المطالبة"]}]');
    r := r || 'A.saveTemplate=ok; ';
  exception when others then r := r || 'A.saveTemplate=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  checks := array[
    ['A.templateNoAuthority', format('insert into public.procedure_templates (name, matter_types, stages) values (%L, %L, %L)', 'x', '{civil}', '[{"name": "a"}]'), '%procedure_templates_stages_check%'],
    ['A.templateNoType', format('insert into public.procedure_templates (name, matter_types, stages) values (%L, %L, %L)', 'x', '{}', '[{"name": "a", "authority": "b"}]'), '%procedure_templates_matter_types_check%'],
    ['A.templateDuplicate', format('insert into public.procedure_templates (name, matter_types, stages) values (%L, %L, %L)', 'مسار المكتب', '{civil}', '[{"name": "a", "authority": "b"}]'), '%procedure_templates_name_key%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;
  execute 'reset role';

  -------------------------------------------------------------- lawyer: own matters only
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_lawyerA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.matter_stages where matter_id = mA) = 3 and (select count(*) from public.matter_deadlines where matter_id = mA) = 1
     and (select count(*) from public.matter_events where matter_id = mA) > 10 and (select count(*) from public.procedure_templates) = 1
    then r := r || 'lawyer.readsOwn=ok; '; else r := r || 'lawyer.readsOwn=FAIL; '; fails := fails + 1; end if;
  select (select count(*) from public.matter_deadlines where matter_id = mA2) + (select count(*) from public.matter_events where matter_id = mA2)
       + (select count(*) from public.matter_progress where matter_id = mA2) into n;
  if n = 0 then r := r || 'lawyer.otherMatterHidden=ok; '; else r := r || 'lawyer.otherMatterHidden=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.matter_deadlines set completed_at = now() where matter_id = mA2; get diagnostics n = row_count;
  if n = 0 then r := r || 'lawyer.completeOtherDeadline=ok; '; else r := r || 'lawyer.completeOtherDeadline=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin insert into public.matter_notes (matter_id, body) values (mA2, 'x'); r := r || 'lawyer.noteOnOtherMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%row-level security%' then r := r || 'lawyer.noteOnOtherMatter=ok; '; else r := r || 'lawyer.noteOnOtherMatter=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  begin
    insert into public.matter_notes (matter_id, body) values (mA, 'ملاحظة المحامي');
    perform public.finish_session(ap3, 'حجزت للحكم', now() + interval '20 days');
    r := r || 'lawyer.worksOnOwn=ok; ';
  exception when others then r := r || 'lawyer.worksOnOwn=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  select id into ap3 from public.appointments where matter_id = mA and status = 'scheduled';
  execute 'reset role';

  -------------------------------------------------------------- employee: every matter of the office
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_empA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.matter_stages where matter_id = mA) = 3 and (select count(*) from public.matter_deadlines where matter_id = mA2) = 1
    then r := r || 'employee.readsAll=ok; '; else r := r || 'employee.readsAll=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';

  -------------------------------------------------------------- reception: no workflow access, no outcomes
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_recA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select (select count(*) from public.matter_stages) + (select count(*) from public.matter_deadlines) + (select count(*) from public.matter_notes)
       + (select count(*) from public.matter_events) + (select count(*) from public.procedure_templates) + (select count(*) from public.matter_progress) into n;
  if n = 0 then r := r || 'reception.readsNothing=ok; '; else r := r || 'reception.readsNothing=FAIL(' || n || '); '; fails := fails + 1; end if;
  checks := array[
    ['reception.addNote', format('insert into public.matter_notes (office_id, matter_id, body) values (%L, %L, %L)', oA, mA, 'x'), '%row-level security%'],
    ['reception.recordOutcome', format('update public.appointments set status = %L, outcome = %L where id = %L', 'completed', 'x', ap3), '%reception cannot record%'],
    ['reception.finishSession', format('select public.finish_session(%L, %L)', ap3, 'x'), '%reception cannot record%'],
    ['reception.saveTemplate', format('insert into public.procedure_templates (office_id, name, matter_types, stages) values (%L, %L, %L, %L)', oA, 'x', '{civil}', '[{"name": "a", "authority": "b"}]'), '%row-level security%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;
  execute 'reset role';

  -------------------------------------------------------------- client portal: sessions only through portal_overview()
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_portal, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select (select count(*) from public.matter_stages) + (select count(*) from public.matter_deadlines) + (select count(*) from public.matter_notes)
       + (select count(*) from public.matter_events) + (select count(*) from public.procedure_templates) + (select count(*) from public.matter_progress) into n;
  if n = 0 then r := r || 'portal.readsNothing=ok; '; else r := r || 'portal.readsNothing=FAIL(' || n || '); '; fails := fails + 1; end if;
  if exists (select 1 from jsonb_array_elements(public.portal_overview() -> 'appointments') a where (a ->> 'id')::uuid = ap3)
    then r := r || 'portal.seesSession=ok; '; else r := r || 'portal.seesSession=FAIL; '; fails := fails + 1; end if;
  begin insert into public.matter_notes (office_id, matter_id, body) values (oA, mA, 'x'); r := r || 'portal.addNote=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlerrm like '%row-level security%' then r := r || 'portal.addNote=ok; '; else r := r || 'portal.addNote=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if; end;
  execute 'reset role';

  -------------------------------------------------------------- office B: nothing of office A
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminB, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select (select count(*) from public.matter_stages) + (select count(*) from public.matter_deadlines) + (select count(*) from public.matter_notes)
       + (select count(*) from public.matter_events where office_id = oA) + (select count(*) from public.procedure_templates) + (select count(*) from public.matter_progress where matter_id = mA) into n;
  if n = 0 then r := r || 'B.seesNothingOfA=ok; '; else r := r || 'B.seesNothingOfA=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.matter_stages set notes = 'x' where matter_id = mA; get diagnostics n = row_count;
  if n = 0 then r := r || 'B.updateStageOfA=ok; '; else r := r || 'B.updateStageOfA=FAIL(' || n || '); '; fails := fails + 1; end if;
  checks := array[
    ['B.finishSessionOfA', format('select public.finish_session(%L, %L)', ap3, 'x'), '%choose a scheduled appointment%'],
    ['B.saveStageOfA', format('select public.save_stage(%L)', stage1), '%stage not found%'],
    ['B.appendToA', format('select public.append_procedure(%L, %L, %L)', mA2, 'x', '[{"name": "a", "authority": "b"}]'), '%matter not found%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;
  execute 'reset role';

  -------------------------------------------------------------- unauthenticated: nothing
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  checks := array[
    ['anon.readStages', 'select count(*) from public.matter_stages', '%permission denied%'],
    ['anon.readEvents', 'select count(*) from public.matter_events', '%permission denied%'],
    ['anon.readProgress', 'select count(*) from public.matter_progress', '%permission denied%'],
    ['anon.appendProcedure', format('select public.append_procedure(%L, %L, %L)', mA, 'x', '[{"name": "a", "authority": "b"}]'), '%permission denied%'],
    ['anon.finishSession', format('select public.finish_session(%L, %L)', ap3, 'x'), '%permission denied%']
  ];
  foreach c slice 1 in array checks loop
    begin execute c[2]; r := r || c[1] || '=FAIL(allowed); '; fails := fails + 1;
    exception when others then
      if sqlerrm like c[3] then r := r || c[1] || '=ok; '; else r := r || c[1] || '=FAIL(' || sqlerrm || '); '; fails := fails + 1; end if;
    end;
  end loop;
  execute 'reset role';

  -- the audit trail recorded the workflow writes
  select count(*) into n from public.audit_logs where office_id = oA and entity_type in ('matter_stage', 'matter_deadline', 'matter_note', 'procedure_template');
  if n > 0 then r := r || 'audit.recorded=ok; '; else r := r || 'audit.recorded=FAIL(0); '; fails := fails + 1; end if;

  raise exception 'TEST RESULTS (rolled back): %failures=%', r, fails;
end $test$;
