-- Phase 1 access regression test. Run in the SQL editor (or via MCP execute_sql).
-- Everything happens inside one DO block that ends with RAISE, so all test data is
-- rolled back. Read the result line: any "ALLOWED!" is a failure.
-- Expected (2026-09-28): client.* reads = 0 except profiles=1, every client write denied,
-- portal.matters=1 portal.appts=1 portal.payments=1, lawyer.clients=1 lawyer.matters=1,
-- adminA.matters_of_B=0, adminB.clients=1, owner.list_offices=2, owner.offices_table=0,
-- adminB_after_suspend.clients=0, stray.clients=0, anon.* denied.
do $test$
declare
  u_owner uuid := gen_random_uuid(); u_adminA uuid := gen_random_uuid(); u_lawyerA uuid := gen_random_uuid();
  u_empA uuid := gen_random_uuid(); u_client uuid := gen_random_uuid(); u_adminB uuid := gen_random_uuid(); u_stray uuid := gen_random_uuid();
  oA uuid; oB uuid; cA uuid; cA2 uuid; cB uuid; mA1 uuid; mA2 uuid; mB1 uuid;
  r text := ''; n bigint; j jsonb;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select id, 'p' || replace(id::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_owner, u_adminA, u_lawyerA, u_empA, u_client, u_adminB, u_stray]) id;
  insert into private.platform_admins values (u_owner);
  oA := public.svc_create_office(u_owner, u_adminA, 'مدير أ', '+249900000001', 'Office A', 'مكتب أ', '+249900000100');
  oB := public.svc_create_office(u_owner, u_adminB, 'مدير ب', '+249900000002', 'Office B', null, null);
  perform public.svc_add_member(u_adminA, u_lawyerA, 'lawyer', 'محامي أ', '+249900000003');
  perform public.svc_add_member(u_adminA, u_empA, 'employee', 'موظف أ', '+249900000004');
  insert into public.clients (office_id, full_name) values (oA, 'موكل أ') returning id into cA;
  insert into public.clients (office_id, full_name) values (oA, 'موكل آخر') returning id into cA2;
  insert into public.clients (office_id, full_name) values (oB, 'موكل ب') returning id into cB;
  perform public.svc_link_client_login(u_empA, u_client, cA, '+249900000005');
  insert into public.matters (office_id, client_id, assigned_lawyer_id, matter_number, title, matter_type) values (oA, cA, u_lawyerA, 'M-1', 'قضية الموكل', 'civil') returning id into mA1;
  insert into public.matters (office_id, client_id, matter_number, title, matter_type) values (oA, cA2, 'M-2', 'قضية أخرى', 'civil') returning id into mA2;
  insert into public.matters (office_id, client_id, matter_number, title, matter_type) values (oB, cB, 'M-3', 'قضية ب', 'civil') returning id into mB1;
  insert into public.appointments (office_id, matter_id, title, appointment_type, starts_at, status) values
    (oA, mA1, 'جلسة', 'court_session', now() + interval '2 days', 'scheduled'),
    (oA, mA1, 'اجتماع داخلي', 'internal_meeting', now() + interval '2 days', 'scheduled'),
    (oA, mA2, 'جلسة أخرى', 'court_session', now() + interval '3 days', 'scheduled');
  insert into public.payments (office_id, client_id, matter_id, amount, currency, payment_type, payment_method, payment_status) values
    (oA, cA, mA1, 100, 'SDG', 'legal_fee', 'cash', 'completed'),
    (oA, cA2, mA2, 50, 'SDG', 'legal_fee', 'cash', 'completed');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.my_access(); r := r || 'client.role=' || (j->>'role') || '; ';
  select count(*) into n from public.clients; r := r || 'client.clients=' || n || '; ';
  select count(*) into n from public.matters; r := r || 'client.matters=' || n || '; ';
  select count(*) into n from public.appointments; r := r || 'client.appts=' || n || '; ';
  select count(*) into n from public.payments; r := r || 'client.payments=' || n || '; ';
  select count(*) into n from public.profiles; r := r || 'client.profiles=' || n || '; ';
  select count(*) into n from public.offices; r := r || 'client.offices=' || n || '; ';
  begin insert into public.clients (office_id, full_name) values (oA, 'x'); r := r || 'client.insertClient=ALLOWED!; '; exception when others then r := r || 'client.insertClient=denied; '; end;
  begin insert into public.appointments (office_id, title, appointment_type, starts_at, status) values (oA, 'x', 'other', now(), 'scheduled'); r := r || 'client.insertAppt=ALLOWED!; '; exception when others then r := r || 'client.insertAppt=denied; '; end;
  begin insert into public.tasks (office_id, assigned_to, title) values (oA, u_client, 'x'); r := r || 'client.insertTask=ALLOWED!; '; exception when others then r := r || 'client.insertTask=denied; '; end;
  begin update public.profiles set client_id = cA2 where id = u_client; r := r || 'client.changeLink=ALLOWED!; '; exception when others then r := r || 'client.changeLink=denied; '; end;
  begin update public.profiles set role = 'admin' where id = u_client; r := r || 'client.changeRole=ALLOWED!; '; exception when others then r := r || 'client.changeRole=denied; '; end;
  begin perform public.svc_add_member(u_client, u_stray, 'admin', 'x', null); r := r || 'client.svc=ALLOWED!; '; exception when others then r := r || 'client.svc=denied; '; end;
  begin perform * from public.platform_list_offices(); r := r || 'client.platform=ALLOWED!; '; exception when others then r := r || 'client.platform=denied; '; end;
  j := public.portal_overview();
  r := r || 'portal.matters=' || jsonb_array_length(j->'matters') || ' portal.appts=' || jsonb_array_length(j->'appointments') || ' portal.payments=' || jsonb_array_length(j->'payments') || '; ';
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_lawyerA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; r := r || 'lawyer.clients=' || n || '; ';
  select count(*) into n from public.matters; r := r || 'lawyer.matters=' || n || '; ';
  begin perform public.portal_overview(); r := r || 'lawyer.portal=ALLOWED!; '; exception when others then r := r || 'lawyer.portal=denied; '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.matters where office_id = oB; r := r || 'adminA.matters_of_B=' || n || '; ';
  begin perform * from public.platform_list_offices(); r := r || 'adminA.platform=ALLOWED!; '; exception when others then r := r || 'adminA.platform=denied; '; end;
  begin update public.profiles set role = 'client' where id = u_lawyerA; r := r || 'adminA.makeClientRole=ALLOWED!; '; exception when others then r := r || 'adminA.makeClientRole=denied; '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminB, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; r := r || 'adminB.clients=' || n || '; ';
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.platform_list_offices(); r := r || 'owner.list_offices=' || n || '; ';
  select count(*) into n from public.offices; r := r || 'owner.offices_table=' || n || '; ';
  perform public.platform_set_office_status(oB, 'suspended');
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminB, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; r := r || 'adminB_after_suspend.clients=' || n || '; ';
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_stray, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; r := r || 'stray.clients=' || n || '; ';
  execute 'reset role';

  execute 'set local role anon';
  begin perform public.portal_overview(); r := r || 'anon.portal=ALLOWED!; '; exception when others then r := r || 'anon.portal=denied; '; end;
  begin perform public.my_access(); r := r || 'anon.my_access=ALLOWED!; '; exception when others then r := r || 'anon.my_access=denied; '; end;
  execute 'reset role';

  raise exception 'TEST RESULTS (rolled back): %', r;
end $test$;
