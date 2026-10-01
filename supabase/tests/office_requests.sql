-- Trial office requests regression test (طلبات المكاتب التجريبية).
-- Run in the SQL editor (or via MCP execute_sql) after any change to office requests,
-- office statuses or the platform owner functions. Everything runs in one DO block that
-- ends with RAISE, so all test data is rolled back.
-- Read the result line: every check prints "name=ok"; any "FAIL" means the test failed.
-- Refusals must fail with the expected SQLSTATE, not just any error. The svc_* calls
-- run as service_role, like the manage-users Edge Function.
-- The last entry is "failures=N" (expected: failures=0).
do $test$
declare
  u_owner uuid := gen_random_uuid(); u_adminA uuid := gen_random_uuid();
  u_req1 uuid := gen_random_uuid(); u_req2 uuid := gen_random_uuid(); u_req3 uuid := gen_random_uuid();
  u_req4 uuid := gen_random_uuid(); u_req5 uuid := gen_random_uuid();
  u uuid; oA uuid; o1 uuid; o2 uuid; o3 uuid;
  src text := repeat('a', 64); r text := ''; fails int := 0; n bigint; j jsonb; t text; i int;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select id, 'p' || replace(id::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_owner, u_adminA, u_req1, u_req2, u_req3, u_req4, u_req5]) id;
  insert into private.platform_admins values (u_owner);
  oA := public.svc_create_office(u_owner, u_adminA, 'مدير أ', '+249900000001', 'Office A', 'مكتب أ', null);

  -------------------------------------------------------------- request (manage-users, service role)
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  o1 := public.svc_request_office(u_req1, 'طالب أول', '+249900000011', 'مكتب تجريبي', '+249900000111', 'الخرطوم بحري', src);
  j := public.svc_actor_info(u_req1);
  if j->>'role' is null and not (j->>'platform_admin')::boolean then r := r || 'svc.pendingActorHasNoRole=ok; '; else r := r || 'svc.pendingActorHasNoRole=FAIL(' || j || '); '; fails := fails + 1; end if;
  begin perform public.svc_add_member(u_req1, u_req4, 'lawyer', 'x', '+249900000014'); r := r || 'svc.pendingAdminAddsMember=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'svc.pendingAdminAddsMember=ok; '; else r := r || 'svc.pendingAdminAddsMember=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_request_office(u_req1, 'x', '+249900000011', 'مكتب آخر', null, null, null); r := r || 'svc.secondOfficeForUser=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '23505' then r := r || 'svc.secondOfficeForUser=ok; '; else r := r || 'svc.secondOfficeForUser=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  select o.status::text into t from public.offices o where o.id = o1;
  if t = 'pending' then r := r || 'svc.pendingOffice=ok; '; else r := r || 'svc.pendingOffice=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  select count(*) into n from public.profiles p where p.id = u_req1 and p.office_id = o1 and p.role = 'admin' and p.is_active and p.phone = '+249900000011';
  if n = 1 then r := r || 'svc.requesterIsAdmin=ok; '; else r := r || 'svc.requesterIsAdmin=FAIL; '; fails := fails + 1; end if;
  select count(*) into n from private.office_requests q
   where q.office_id = o1 and q.requested_by = u_req1 and q.decision is null and q.note = 'الخرطوم بحري'
     and q.admin_name = 'طالب أول' and q.admin_phone = '+249900000011' and q.source_hash = src;
  if n = 1 then r := r || 'svc.requestRecorded=ok; '; else r := r || 'svc.requestRecorded=FAIL; '; fails := fails + 1; end if;
  select count(*) into n from public.audit_logs a where a.office_id = o1 and a.action = 'office_requested';
  if n = 1 then r := r || 'audit.requested=ok; '; else r := r || 'audit.requested=FAIL(' || n || '); '; fails := fails + 1; end if;

  -------------------------------------------------------------- requester before approval: nothing
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_req1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.my_access();
  if j->'office'->>'status' = 'pending' and j->>'role' = 'admin' then r := r || 'pending.myAccess=ok; '; else r := r || 'pending.myAccess=FAIL(' || coalesce(j::text, 'null') || '); '; fails := fails + 1; end if;
  select count(*) into n from public.offices;
  if n = 0 then r := r || 'pending.readsNoOffice=ok; '; else r := r || 'pending.readsNoOffice=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin insert into public.clients (office_id, full_name) values (o1, 'x'); r := r || 'pending.insertClient=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.insertClient=ok; '; else r := r || 'pending.insertClient=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin insert into public.clients (full_name) values ('x'); r := r || 'pending.insertClientDefault=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate in ('42501', '23502') then r := r || 'pending.insertClientDefault=ok; '; else r := r || 'pending.insertClientDefault=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  update public.offices set status = 'active' where id = o1; get diagnostics n = row_count;
  if n = 0 then r := r || 'pending.selfActivate=ok; '; else r := r || 'pending.selfActivate=FAIL(updated); '; fails := fails + 1; end if;
  begin perform count(*) from private.office_requests; r := r || 'pending.readRequestsTable=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.readRequestsTable=ok; '; else r := r || 'pending.readRequestsTable=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform * from public.platform_list_office_requests(); r := r || 'pending.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.listRequests=ok; '; else r := r || 'pending.listRequests=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_review_office_request(u_req1, o1, true); r := r || 'pending.svcReview=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.svcReview=ok; '; else r := r || 'pending.svcReview=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_request_office(u_req1, 'x', '+249900000011', 'x', null, null, null); r := r || 'pending.svcRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.svcRequest=ok; '; else r := r || 'pending.svcRequest=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_office_request_limit(null); r := r || 'pending.svcLimit=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'pending.svcLimit=ok; '; else r := r || 'pending.svcLimit=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  select o.status::text into t from public.offices o where o.id = o1;
  if t = 'pending' then r := r || 'pending.stillPending=ok; '; else r := r || 'pending.stillPending=FAIL(' || t || '); '; fails := fails + 1; end if;

  -------------------------------------------------------------- anon and another office's admin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform * from public.platform_list_office_requests(); r := r || 'anon.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'anon.listRequests=ok; '; else r := r || 'anon.listRequests=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_review_office_request(u_owner, o1, true); r := r || 'anon.svcReview=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'anon.svcReview=ok; '; else r := r || 'anon.svcReview=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_request_office(gen_random_uuid(), 'x', '+249900000019', 'x', null, null, null); r := r || 'anon.svcRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'anon.svcRequest=ok; '; else r := r || 'anon.svcRequest=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform * from public.platform_list_office_requests(); r := r || 'adminA.listRequests=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'adminA.listRequests=ok; '; else r := r || 'adminA.listRequests=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  select count(*) into n from public.offices o where o.id = o1;
  if n = 0 then r := r || 'adminA.cannotSeeRequestedOffice=ok; '; else r := r || 'adminA.cannotSeeRequestedOffice=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';
  -- only the platform owner may decide, even through the trusted path
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  begin perform public.svc_review_office_request(u_adminA, o1, true); r := r || 'adminA.svcReview=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'adminA.svcReview=ok; '; else r := r || 'adminA.svcReview=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';

  -------------------------------------------------------------- platform owner lists, then approves
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.platform_list_office_requests() q
   where q.office_id = o1 and q.status = 'pending' and q.decision is null and q.admin_name = 'طالب أول'
     and q.admin_phone = '+249900000011' and q.office_phone = '+249900000111' and q.note = 'الخرطوم بحري';
  if n = 1 then r := r || 'owner.listsRequest=ok; '; else r := r || 'owner.listsRequest=FAIL(' || n || '); '; fails := fails + 1; end if;
  select count(*) into n from public.platform_list_offices() o where o.id = o1;
  if n = 0 then r := r || 'owner.officesHidePending=ok; '; else r := r || 'owner.officesHidePending=FAIL; '; fails := fails + 1; end if;
  begin perform public.platform_set_office_status(o1, 'active'); r := r || 'owner.setStatusSkipsReview=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.setStatusSkipsReview=ok; '; else r := r || 'owner.setStatusSkipsReview=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.platform_set_office_status(oA, 'pending'); r := r || 'owner.setStatusToPending=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.setStatusToPending=ok; '; else r := r || 'owner.setStatusToPending=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  -- the decision itself is not callable from the app, only through manage-users
  begin perform public.svc_review_office_request(u_owner, o1, true); r := r || 'owner.svcReviewDirect=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '42501' then r := r || 'owner.svcReviewDirect=ok; '; else r := r || 'owner.svcReviewDirect=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  -- owner's profile edits after the request do not change what the owner sees
  update public.profiles set full_name = 'اسم معدّل' where id = u_req1;

  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  begin perform public.svc_review_office_request(u_owner, oA, true); r := r || 'owner.reviewNonRequest=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = 'P0002' then r := r || 'owner.reviewNonRequest=ok; '; else r := r || 'owner.reviewNonRequest=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin u := public.svc_review_office_request(u_owner, o1, true);
    if u = u_req1 then r := r || 'owner.approve=ok; '; else r := r || 'owner.approve=FAIL(requester ' || coalesce(u::text, 'null') || '); '; fails := fails + 1; end if;
  exception when others then r := r || 'owner.approve=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin perform public.svc_review_office_request(u_owner, o1, true); r := r || 'owner.approveTwice=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.approveTwice=ok; '; else r := r || 'owner.approveTwice=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_review_office_request(u_owner, o1, false); r := r || 'owner.rejectApproved=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.rejectApproved=ok; '; else r := r || 'owner.rejectApproved=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  select count(*) into n from public.offices o join private.office_requests q on q.office_id = o.id
   where o.id = o1 and o.status = 'active' and q.decision = 'approved' and q.decided_by = u_owner and q.decided_at is not null
     and q.admin_name = 'طالب أول';
  if n = 1 then r := r || 'db.approvalRecorded=ok; '; else r := r || 'db.approvalRecorded=FAIL; '; fails := fails + 1; end if;
  select count(*) into n from public.audit_logs a where a.office_id = o1 and a.action = 'office_request_approved' and a.user_id = u_owner;
  if n = 1 then r := r || 'audit.approved=ok; '; else r := r || 'audit.approved=FAIL(' || n || '); '; fails := fails + 1; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.platform_list_offices() o where o.id = o1 and o.status = 'active';
  if n = 1 then r := r || 'owner.approvedOfficeListed=ok; '; else r := r || 'owner.approvedOfficeListed=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';

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

  -------------------------------------------------------------- rejection is final
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  o2 := public.svc_request_office(u_req2, 'طالب ثانٍ', '+249900000012', 'مكتب ثانٍ', null, null, src);
  begin u := public.svc_review_office_request(u_owner, o2, false);
    if u = u_req2 then r := r || 'owner.reject=ok; '; else r := r || 'owner.reject=FAIL(requester); '; fails := fails + 1; end if;
  exception when others then r := r || 'owner.reject=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin perform public.svc_review_office_request(u_owner, o2, false); r := r || 'owner.rejectTwice=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.rejectTwice=ok; '; else r := r || 'owner.rejectTwice=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  begin perform public.svc_review_office_request(u_owner, o2, true); r := r || 'owner.approveRejected=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.approveRejected=ok; '; else r := r || 'owner.approveRejected=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.platform_set_office_status(o2, 'active'); r := r || 'owner.activateRejectedDirectly=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '22023' then r := r || 'owner.activateRejectedDirectly=ok; '; else r := r || 'owner.activateRejectedDirectly=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  select count(*) into n from public.platform_list_office_requests() q where q.office_id = o2 and q.status = 'rejected' and q.decision = 'rejected';
  if n = 1 then r := r || 'owner.listsRejected=ok; '; else r := r || 'owner.listsRejected=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_req2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.my_access();
  if j->'office'->>'status' = 'rejected' then r := r || 'rejected.myAccess=ok; '; else r := r || 'rejected.myAccess=FAIL(' || coalesce(j::text, 'null') || '); '; fails := fails + 1; end if;
  begin insert into public.clients (full_name) values ('x'); r := r || 'rejected.createClient=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate in ('42501', '23502') then r := r || 'rejected.createClient=ok; '; else r := r || 'rejected.createClient=FAIL(' || sqlstate || '); '; fails := fails + 1; end if; end;
  execute 'reset role';

  -------------------------------------------------------------- limits
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  -- per source: two requests so far from src; the third is allowed, the fourth refused
  if public.svc_office_request_limit(src) is null then r := r || 'limit.allowsThird=ok; '; else r := r || 'limit.allowsThird=FAIL; '; fails := fails + 1; end if;
  o3 := public.svc_request_office(u_req3, 'طالب ثالث', '+249900000013', 'مكتب ثالث', null, null, src);
  t := public.svc_office_request_limit(src);
  if t = 'too_many' then r := r || 'limit.perSource=ok; '; else r := r || 'limit.perSource=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  begin perform public.svc_request_office(u_req4, 'طالب رابع', '+249900000014', 'مكتب رابع', null, null, src); r := r || 'limit.perSourceEnforced=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '54000' and sqlerrm like '%too_many%' then r := r || 'limit.perSourceEnforced=ok; '; else r := r || 'limit.perSourceEnforced=FAIL(' || sqlstate || ' ' || sqlerrm || '); '; fails := fails + 1; end if; end;
  if public.svc_office_request_limit(repeat('b', 64)) is null then r := r || 'limit.otherSource=ok; '; else r := r || 'limit.otherSource=FAIL; '; fails := fails + 1; end if;
  execute 'reset role';
  update private.office_requests set created_at = now() - interval '2 days' where source_hash = src;
  execute 'set local role service_role';
  if public.svc_office_request_limit(src) is null then r := r || 'limit.dayWindow=ok; '; else r := r || 'limit.dayWindow=FAIL; '; fails := fails + 1; end if;
  -- whole queue: one undecided request so far (o3); fill it to 20
  execute 'reset role';
  for i in 1..19 loop
    u := gen_random_uuid();
    insert into auth.users (id, email, aud, role, instance_id) values (u, 'p' || replace(u::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
    perform public.svc_request_office(u, 'طالب', '+24990000' || lpad((100 + i)::text, 4, '0'), 'مكتب', null, null, null);
  end loop;
  execute 'set local role service_role';
  t := public.svc_office_request_limit(null);
  if t = 'queue_full' then r := r || 'limit.queueFull=ok; '; else r := r || 'limit.queueFull=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  begin perform public.svc_request_office(u_req5, 'طالب خامس', '+249900000015', 'مكتب خامس', null, null, null); r := r || 'limit.queueFullEnforced=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '54000' and sqlerrm like '%queue_full%' then r := r || 'limit.queueFullEnforced=ok; '; else r := r || 'limit.queueFullEnforced=FAIL(' || sqlstate || ' ' || sqlerrm || '); '; fails := fails + 1; end if; end;
  execute 'reset role';
  -- whole day: decide the queue, then fill the day to 30 requests
  update private.office_requests set decision = 'rejected', decided_at = now() where decision is null;
  update private.office_requests set created_at = now() where created_at < now() - interval '1 day';
  select count(*) into n from private.office_requests where created_at > now() - interval '1 day';
  for i in 1..(30 - n) loop
    u := gen_random_uuid();
    insert into auth.users (id, email, aud, role, instance_id) values (u, 'p' || replace(u::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
    perform public.svc_request_office(u, 'طالب', '+24991000' || lpad(i::text, 4, '0'), 'مكتب', null, null, null);
    update private.office_requests set decision = 'rejected', decided_at = now() where requested_by = u;
  end loop;
  execute 'set local role service_role';
  t := public.svc_office_request_limit(repeat('c', 64));
  if t = 'daily_limit' then r := r || 'limit.daily=ok; '; else r := r || 'limit.daily=FAIL(' || coalesce(t, 'null') || '); '; fails := fails + 1; end if;
  begin perform public.svc_request_office(u_req5, 'طالب خامس', '+249900000015', 'مكتب خامس', null, null, repeat('c', 64)); r := r || 'limit.dailyEnforced=FAIL(allowed); '; fails := fails + 1;
  exception when others then if sqlstate = '54000' and sqlerrm like '%daily_limit%' then r := r || 'limit.dailyEnforced=ok; '; else r := r || 'limit.dailyEnforced=FAIL(' || sqlstate || ' ' || sqlerrm || '); '; fails := fails + 1; end if; end;
  execute 'reset role';

  raise exception 'TEST RESULTS (rolled back): %failures=%', r, fails;
end $test$;
