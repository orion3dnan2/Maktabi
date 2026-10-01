-- Trial office requests regression test (طلبات المكاتب التجريبية).
-- Run in the SQL editor (or via MCP execute_sql) after any change to office requests,
-- office statuses or the platform owner functions. Everything runs in one DO block that
-- ends with RAISE, so all test data is rolled back.
-- Read the result line: every check prints "name=ok"; any "FAIL" means the test failed.
-- The last entry is "failures=N" (expected: failures=0).
do $test$
declare
  u_owner uuid := gen_random_uuid(); u_adminA uuid := gen_random_uuid();
  u_req1 uuid := gen_random_uuid(); u_req2 uuid := gen_random_uuid(); u_req3 uuid := gen_random_uuid(); u_req4 uuid := gen_random_uuid(); u_req5 uuid := gen_random_uuid();
  u uuid; oA uuid; o1 uuid; o2 uuid;
  src text := repeat('a', 64); r text := ''; fails int := 0; n bigint; j jsonb; t text; i int;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select id, 'p' || replace(id::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_owner, u_adminA, u_req1, u_req2, u_req3, u_req4, u_req5]) id;
  insert into private.platform_admins values (u_owner);
  oA := public.svc_create_office(u_owner, u_adminA, 'مدير أ', '+249900000001', 'Office A', 'مكتب أ', null);

  -------------------------------------------------------------- request (manage-users, service role)
  o1 := public.svc_request_office(u_req1, 'طالب أول', '+249900000011', 'مكتب تجريبي', '+249900000111', 'الخرطوم بحري', src);
  select o.status::text into t from public.offices o where o.id = o1;
  if t = 'pending' then r := r || 'svc.pendingOffice=ok; '; else r := r || 'svc.pendingOffice=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  select count(*) into n from public.profiles p where p.id = u_req1 and p.office_id = o1 and p.role = 'admin' and p.is_active and p.phone = '+249900000011';
  if n = 1 then r := r || 'svc.requesterIsAdmin=ok; '; else r := r || 'svc.requesterIsAdmin=FAIL; '; fails := fails + 1; end if;
  select count(*) into n from private.office_requests q where q.office_id = o1 and q.requested_by = u_req1 and q.decision is null and q.note = 'الخرطوم بحري';
  if n = 1 then r := r || 'svc.requestRecorded=ok; '; else r := r || 'svc.requestRecorded=FAIL; '; fails := fails + 1; end if;
  select count(*) into n from public.audit_logs a where a.office_id = o1 and a.action = 'office_requested';
  if n = 1 then r := r || 'audit.requested=ok; '; else r := r || 'audit.requested=FAIL(' || n || '); '; fails := fails + 1; end if;
  j := public.svc_actor_info(u_req1);
  if j->>'role' is null and not (j->>'platform_admin')::boolean then r := r || 'svc.pendingActorHasNoRole=ok; '; else r := r || 'svc.pendingActorHasNoRole=FAIL(' || j || '); '; fails := fails + 1; end if;
  begin perform public.svc_add_member(u_req1, u_req4, 'lawyer', 'x', '+249900000014'); r := r || 'svc.pendingAdminAddsMember=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'svc.pendingAdminAddsMember=ok; '; end;
  begin perform public.svc_request_office(u_req1, 'x', '+249900000011', 'مكتب آخر', null, null, null); r := r || 'svc.secondOfficeForUser=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'svc.secondOfficeForUser=ok; '; end;

  -------------------------------------------------------------- requester before approval: nothing
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_req1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.my_access();
  if j->'office'->>'status' = 'pending' and j->>'role' = 'admin' then r := r || 'pending.myAccess=ok; '; else r := r || 'pending.myAccess=FAIL(' || coalesce(j::text, 'null') || '); '; fails := fails + 1; end if;
  select count(*) into n from public.offices;
  if n = 0 then r := r || 'pending.readsNoOffice=ok; '; else r := r || 'pending.readsNoOffice=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin insert into public.clients (office_id, full_name) values (o1, 'x'); r := r || 'pending.insertClient=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.insertClient=ok; '; end;
  begin insert into public.clients (full_name) values ('x'); r := r || 'pending.insertClientDefault=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.insertClientDefault=ok; '; end;
  update public.offices set status = 'active' where id = o1; get diagnostics n = row_count;
  if n = 0 then r := r || 'pending.selfActivate=ok; '; else r := r || 'pending.selfActivate=FAIL(updated); '; fails := fails + 1; end if;
  begin perform count(*) from private.office_requests; r := r || 'pending.readRequestsTable=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.readRequestsTable=ok; '; end;
  begin perform * from public.platform_list_office_requests(); r := r || 'pending.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.listRequests=ok; '; end;
  begin perform public.platform_review_office_request(o1, true); r := r || 'pending.approveSelf=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.approveSelf=ok; '; end;
  begin perform public.svc_request_office(u_req1, 'x', '+249900000011', 'x', null, null, null); r := r || 'pending.svcRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.svcRequest=ok; '; end;
  begin perform public.svc_office_request_limit(null); r := r || 'pending.svcLimit=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'pending.svcLimit=ok; '; end;
  execute 'reset role';
  select o.status::text into t from public.offices o where o.id = o1;
  if t = 'pending' then r := r || 'pending.stillPending=ok; '; else r := r || 'pending.stillPending=FAIL(' || t || '); '; fails := fails + 1; end if;

  -------------------------------------------------------------- anon and another office's admin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform * from public.platform_list_office_requests(); r := r || 'anon.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.listRequests=ok; '; end;
  begin perform public.platform_review_office_request(o1, true); r := r || 'anon.review=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.review=ok; '; end;
  begin perform public.svc_request_office(gen_random_uuid(), 'x', '+249900000019', 'x', null, null, null); r := r || 'anon.svcRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.svcRequest=ok; '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform * from public.platform_list_office_requests(); r := r || 'adminA.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'adminA.listRequests=ok; '; end;
  begin perform public.platform_review_office_request(o1, true); r := r || 'adminA.review=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'adminA.review=ok; '; end;
  select count(*) into n from public.offices o where o.id = o1;
  if n = 0 then r := r || 'adminA.cannotSeeRequestedOffice=ok; '; else r := r || 'adminA.cannotSeeRequestedOffice=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';

  -------------------------------------------------------------- platform owner approves
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.platform_list_office_requests() q
   where q.office_id = o1 and q.status = 'pending' and q.decision is null and q.admin_name = 'طالب أول'
     and q.admin_phone = '+249900000011' and q.office_phone = '+249900000111' and q.note = 'الخرطوم بحري';
  if n = 1 then r := r || 'owner.listsRequest=ok; '; else r := r || 'owner.listsRequest=FAIL(' || n || '); '; fails := fails + 1; end if;
  select count(*) into n from public.platform_list_offices() o where o.id = o1;
  if n = 0 then r := r || 'owner.officesHidePending=ok; '; else r := r || 'owner.officesHidePending=FAIL; '; fails := fails + 1; end if;
  begin perform public.platform_set_office_status(o1, 'active'); r := r || 'owner.setStatusSkipsReview=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.setStatusSkipsReview=ok; '; end;
  begin perform public.platform_set_office_status(oA, 'pending'); r := r || 'owner.setStatusToPending=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.setStatusToPending=ok; '; end;
  begin perform public.platform_review_office_request(oA, true); r := r || 'owner.reviewNonRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.reviewNonRequest=ok; '; end;
  begin perform public.platform_review_office_request(o1, true); r := r || 'owner.approve=ok; ';
  exception when others then r := r || 'owner.approve=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin perform public.platform_review_office_request(o1, true); r := r || 'owner.approveTwice=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.approveTwice=ok; '; end;
  begin perform public.platform_review_office_request(o1, false); r := r || 'owner.rejectApproved=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.rejectApproved=ok; '; end;
  select count(*) into n from public.platform_list_offices() o where o.id = o1 and o.status = 'active';
  if n = 1 then r := r || 'owner.approvedOfficeListed=ok; '; else r := r || 'owner.approvedOfficeListed=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';
  select count(*) into n from public.offices o join private.office_requests q on q.office_id = o.id
   where o.id = o1 and o.status = 'active' and q.decision = 'approved' and q.decided_by = u_owner and q.decided_at is not null;
  if n = 1 then r := r || 'db.approvalRecorded=ok; '; else r := r || 'db.approvalRecorded=FAIL; '; fails := fails + 1; end if;

  -- the approved requester now works in its own office only
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_req1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into public.clients (full_name) values ('موكل تجريبي'); r := r || 'approved.createClient=ok; ';
  exception when others then r := r || 'approved.createClient=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  select count(*) into n from public.clients c where c.office_id = o1;
  if n = 1 then r := r || 'approved.readsOwnClient=ok; '; else r := r || 'approved.readsOwnClient=FAIL(' || n || '); '; fails := fails + 1; end if;
  select count(*) into n from public.offices;
  if n = 1 then r := r || 'approved.seesOnlyOwnOffice=ok; '; else r := r || 'approved.seesOnlyOwnOffice=FAIL(' || n || '); '; fails := fails + 1; end if;
  execute 'reset role';

  -------------------------------------------------------------- rejection
  o2 := public.svc_request_office(u_req2, 'طالب ثانٍ', '+249900000012', 'مكتب ثانٍ', null, null, src);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.platform_review_office_request(o2, false); r := r || 'owner.reject=ok; ';
  exception when others then r := r || 'owner.reject=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin perform public.platform_review_office_request(o2, false); r := r || 'owner.rejectTwice=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.rejectTwice=ok; '; end;
  begin perform public.platform_set_office_status(o2, 'active'); r := r || 'owner.activateRejectedDirectly=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'owner.activateRejectedDirectly=ok; '; end;
  select count(*) into n from public.platform_list_office_requests() q where q.office_id = o2 and q.status = 'rejected' and q.decision = 'rejected';
  if n = 1 then r := r || 'owner.listsRejected=ok; '; else r := r || 'owner.listsRejected=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_req2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.my_access();
  if j->'office'->>'status' = 'rejected' then r := r || 'rejected.myAccess=ok; '; else r := r || 'rejected.myAccess=FAIL(' || coalesce(j::text, 'null') || '); '; fails := fails + 1; end if;
  begin insert into public.clients (full_name) values ('x'); r := r || 'rejected.createClient=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'rejected.createClient=ok; '; end;
  execute 'reset role';
  -- a rejected request can still be approved later (e.g. rejected by mistake)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.platform_review_office_request(o2, true); r := r || 'owner.approveRejected=ok; ';
  exception when others then r := r || 'owner.approveRejected=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  execute 'reset role';

  -------------------------------------------------------------- limits
  -- per source: two requests so far from src; the third is allowed, the fourth refused
  if public.svc_office_request_limit(src) is null then r := r || 'limit.allowsThird=ok; '; else r := r || 'limit.allowsThird=FAIL; '; fails := fails + 1; end if;
  perform public.svc_request_office(u_req3, 'طالب ثالث', '+249900000013', 'مكتب ثالث', null, null, src);
  t := public.svc_office_request_limit(src);
  if t = 'too_many' then r := r || 'limit.perSource=ok; '; else r := r || 'limit.perSource=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  begin perform public.svc_request_office(u_req4, 'طالب رابع', '+249900000014', 'مكتب رابع', null, null, src); r := r || 'limit.perSourceEnforced=FAIL(allowed); '; fails := fails + 1;
  exception when sqlstate '54000' then r := r || 'limit.perSourceEnforced=ok; ';
    when others then r := r || 'limit.perSourceEnforced=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  if public.svc_office_request_limit(repeat('b', 64)) is null then r := r || 'limit.otherSource=ok; '; else r := r || 'limit.otherSource=FAIL; '; fails := fails + 1; end if;
  update private.office_requests set created_at = now() - interval '2 days' where source_hash = src;
  if public.svc_office_request_limit(src) is null then r := r || 'limit.dayWindow=ok; '; else r := r || 'limit.dayWindow=FAIL; '; fails := fails + 1; end if;
  -- whole queue: one undecided request so far (u_req3); fill it to 20
  for i in 1..19 loop
    u := gen_random_uuid();
    insert into auth.users (id, email, aud, role, instance_id) values (u, 'p' || replace(u::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
    perform public.svc_request_office(u, 'طالب', '+24990000' || lpad((100 + i)::text, 4, '0'), 'مكتب', null, null, null);
  end loop;
  t := public.svc_office_request_limit(null);
  if t = 'queue_full' then r := r || 'limit.queueFull=ok; '; else r := r || 'limit.queueFull=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  begin perform public.svc_request_office(u_req5, 'طالب خامس', '+249900000015', 'مكتب خامس', null, null, null); r := r || 'limit.queueFullEnforced=FAIL(allowed); '; fails := fails + 1;
  exception when sqlstate '54000' then r := r || 'limit.queueFullEnforced=ok; ';
    when others then r := r || 'limit.queueFullEnforced=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;

  select count(*) into n from public.audit_logs a where a.action in ('office_request_approved', 'office_request_rejected') and a.office_id in (o1, o2);
  if n = 3 then r := r || 'audit.decisions=ok; '; else r := r || 'audit.decisions=FAIL(' || n || '); '; fails := fails + 1; end if;

  raise exception 'TEST RESULTS (rolled back): %failures=%', r, fails;
end $test$;
