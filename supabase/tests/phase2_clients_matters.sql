-- Phase 2 access regression test: Clients and Matters in Supabase.
-- Run in the SQL editor (or via MCP execute_sql) after any change to clients, matters,
-- matter_parties, their policies/guards, or save_matter(). Everything runs in one DO block
-- that ends with RAISE, so all test data is rolled back.
-- Read the result line: every check prints "name=ok"; any "FAIL" means the test failed.
-- The last entry is "failures=N" (expected: failures=0).
do $test$
declare
  u_owner uuid := gen_random_uuid(); u_adminA uuid := gen_random_uuid(); u_lawyerA uuid := gen_random_uuid();
  u_lawyerA2 uuid := gen_random_uuid(); u_recA uuid := gen_random_uuid(); u_portal uuid := gen_random_uuid();
  u_adminB uuid := gen_random_uuid();
  oA uuid; oB uuid;
  cA1 uuid := gen_random_uuid(); cA2 uuid := gen_random_uuid(); cB uuid; mB uuid;
  mA1 uuid := gen_random_uuid(); mA2 uuid := gen_random_uuid(); mL uuid := gen_random_uuid();
  pOpp uuid; r text := ''; fails int := 0; n bigint; t text; ok boolean;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  select id, 'p' || replace(id::text, '-', '') || '@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
  from unnest(array[u_owner, u_adminA, u_lawyerA, u_lawyerA2, u_recA, u_portal, u_adminB]) id;
  insert into private.platform_admins values (u_owner);
  oA := public.svc_create_office(u_owner, u_adminA, 'مدير أ', '+249900000001', 'Office A', 'مكتب أ', null);
  oB := public.svc_create_office(u_owner, u_adminB, 'مدير ب', '+249900000002', 'Office B', 'مكتب ب', null);
  perform public.svc_add_member(u_adminA, u_lawyerA, 'lawyer', 'محامي أ', '+249900000003');
  perform public.svc_add_member(u_adminA, u_lawyerA2, 'lawyer', 'محامي أ٢', '+249900000004');
  perform public.svc_add_member(u_adminA, u_recA, 'reception', 'استقبال أ', '+249900000005');
  insert into public.clients (office_id, full_name, whatsapp) values (oB, 'موكل ب', '+249911111111') returning id into cB;
  insert into public.matters (office_id, client_id, matter_number, title, matter_type) values (oB, cB, 'B-1', 'قضية ب', 'civil') returning id into mB;

  -------------------------------------------------------------- Office A admin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- create own clients (office_id comes from the session default)
  begin
    insert into public.clients (id, client_type, full_name, phone, whatsapp) values (cA1, 'individual', 'أمجد الطيب', '+249912000001', '+249912000001');
    insert into public.clients (id, client_type, full_name, whatsapp, contact_person, email, address) values (cA2, 'organization', 'شركة روافد', '+249912000002', 'سلمى', 'office@example.test', 'الخرطوم');
    r := r || 'A.createClients=ok; ';
  exception when others then r := r || 'A.createClients=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  select count(*) into n from public.clients where office_id = oA;
  if n = 2 then r := r || 'A.readOwnClients=ok; '; else r := r || 'A.readOwnClients=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.clients set phone = '+249912000009', whatsapp = '+249912000009' where id = cA1; get diagnostics n = row_count;
  if n = 1 then r := r || 'A.updateOwnClient=ok; '; else r := r || 'A.updateOwnClient=FAIL(' || n || '); '; fails := fails + 1; end if;
  -- other office's data is invisible and unchangeable
  select count(*) into n from public.clients where id = cB;
  if n = 0 then r := r || 'A.readClientB=ok; '; else r := r || 'A.readClientB=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.clients set full_name = 'x' where id = cB; get diagnostics n = row_count;
  if n = 0 then r := r || 'A.updateClientB=ok; '; else r := r || 'A.updateClientB=FAIL(' || n || '); '; fails := fails + 1; end if;
  select count(*) into n from public.matters where id = mB;
  if n = 0 then r := r || 'A.readMatterB=ok; '; else r := r || 'A.readMatterB=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.matters set title = 'x' where id = mB; get diagnostics n = row_count;
  if n = 0 then r := r || 'A.updateMatterB=ok; '; else r := r || 'A.updateMatterB=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin insert into public.clients (office_id, full_name) values (oB, 'حقن'); r := r || 'A.insertClientIntoB=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.insertClientIntoB=ok; '; end;
  -- create a matter with an opponent and an additional client, atomically
  begin
    perform public.save_matter(
      jsonb_build_object('id', mA1, 'client_id', cA1, 'matter_number', 'MK-2026-001', 'title', 'مطالبة بقيمة توريد', 'matter_type', 'civil', 'court_name', 'محكمة أم درمان', 'status', 'open', 'opened_at', '2026-09-01', 'details', '{}'::jsonb),
      jsonb_build_array(jsonb_build_object('client_id', cA2, 'party_role', 'client'), jsonb_build_object('display_name', 'الطرف المقابل', 'party_role', 'opponent')));
    r := r || 'A.createMatter=ok; ';
  exception when others then r := r || 'A.createMatter=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  select count(*) into n from public.matter_parties where matter_id = mA1;
  if n = 2 then r := r || 'A.matterParties=ok; '; else r := r || 'A.matterParties=FAIL(' || n || '); '; fails := fails + 1; end if;
  select mp.id into pOpp from public.matter_parties mp where mp.matter_id = mA1 and mp.party_role = 'opponent';
  select count(*) into n from public.matters m join public.clients c on c.office_id = m.office_id and c.id = m.client_id where m.id = mA1 and c.full_name = 'أمجد الطيب';
  if n = 1 then r := r || 'A.matterClientJoin=ok; '; else r := r || 'A.matterClientJoin=FAIL(' || n || '); '; fails := fails + 1; end if;
  -- update: rename, drop the additional client, keep the opponent, add a witness
  begin
    perform public.save_matter(
      jsonb_build_object('id', mA1, 'client_id', cA1, 'matter_number', 'MK-2026-001', 'title', 'مطالبة معدلة', 'matter_type', 'civil', 'court_name', 'محكمة أم درمان', 'status', 'open', 'opened_at', '2026-09-01', 'details', '{}'::jsonb),
      jsonb_build_array(jsonb_build_object('id', pOpp, 'display_name', 'الطرف المقابل', 'party_role', 'opponent'), jsonb_build_object('display_name', 'شاهد', 'party_role', 'witness')));
    select count(*) into n from public.matter_parties where matter_id = mA1;
    select title into t from public.matters where id = mA1;
    if n = 2 and t = 'مطالبة معدلة' and exists (select 1 from public.matter_parties where id = pOpp) and not exists (select 1 from public.matter_parties where matter_id = mA1 and client_id = cA2)
      then r := r || 'A.updateMatter=ok; '; else r := r || 'A.updateMatter=FAIL(' || n || ',' || t || '); '; fails := fails + 1; end if;
  exception when others then r := r || 'A.updateMatter=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  -- status change: closing stamps closed_at, reopening clears it
  update public.matters set status = 'closed' where id = mA1;
  select count(*) into n from public.matters where id = mA1 and closed_at is not null;
  update public.matters set status = 'open' where id = mA1;
  if n = 1 and exists (select 1 from public.matters where id = mA1 and closed_at is null) then r := r || 'A.changeStatus=ok; '; else r := r || 'A.changeStatus=FAIL; '; fails := fails + 1; end if;
  -- cross-office relationship attacks
  begin perform public.save_matter(jsonb_build_object('id', gen_random_uuid(), 'client_id', cB, 'matter_number', 'X-1', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'A.attachMatterToClientB=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.attachMatterToClientB=ok; '; end;
  begin insert into public.matters (client_id, matter_number, title) values (cB, 'X-2', 'x');
    r := r || 'A.insertMatterWithClientB=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.insertMatterWithClientB=ok; '; end;
  begin perform public.save_matter(jsonb_build_object('id', mA2, 'client_id', cA1, 'matter_number', 'MK-2026-002', 'title', 'x', 'matter_type', 'civil', 'status', 'open'),
      jsonb_build_array(jsonb_build_object('client_id', cB, 'party_role', 'client')));
    r := r || 'A.partyWithClientB=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.partyWithClientB=ok; '; end;
  begin perform public.save_matter(jsonb_build_object('id', mB, 'client_id', cA1, 'matter_number', 'MK-HIJACK', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'A.overwriteMatterB=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.overwriteMatterB=ok; '; end;
  -- integrity rules
  begin perform public.save_matter(jsonb_build_object('id', mA2, 'client_id', cA1, 'matter_number', 'MK-2026-001', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'A.duplicateReference=FAIL(allowed); '; fails := fails + 1;
  exception when unique_violation then r := r || 'A.duplicateReference=ok; ';
    when others then r := r || 'A.duplicateReference=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin perform public.save_matter(jsonb_build_object('id', mA2, 'client_id', cA1, 'matter_number', 'MK-2026-002', 'title', 'x', 'matter_type', 'civil', 'status', 'open'),
      jsonb_build_array(jsonb_build_object('client_id', cA1, 'party_role', 'client')));
    r := r || 'A.primaryAlsoParty=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.primaryAlsoParty=ok; '; end;
  begin perform public.save_matter(jsonb_build_object('id', mA2, 'client_id', cA2, 'matter_number', 'MK-2026-002', 'title', 'x', 'matter_type', 'civil', 'status', 'open'),
      jsonb_build_array(jsonb_build_object('id', pOpp, 'display_name', 'مسروق', 'party_role', 'opponent')));
    r := r || 'A.stealPartyFromOtherMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'A.stealPartyFromOtherMatter=ok; '; end;
  if exists (select 1 from public.matter_parties where id = pOpp and matter_id = mA1 and display_name = 'الطرف المقابل') then r := r || 'A.partyUntouched=ok; ';
  else r := r || 'A.partyUntouched=FAIL; '; fails := fails + 1; end if;
  begin insert into public.matter_parties (matter_id, client_id, display_name, party_role) values (mA1, cA2, 'نسخة من اسم العميل', 'client');
    r := r || 'A.partyCopiesClientName=FAIL(allowed); '; fails := fails + 1;
  exception when check_violation then r := r || 'A.partyCopiesClientName=ok; ';
    when others then r := r || 'A.partyCopiesClientName=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  -- archive (no hard delete needed)
  update public.clients set status = 'archived' where id = cA2; get diagnostics n = row_count;
  if n = 1 then r := r || 'A.archiveClient=ok; '; else r := r || 'A.archiveClient=FAIL(' || n || '); '; fails := fails + 1; end if;
  update public.clients set status = 'active' where id = cA2;
  execute 'reset role';

  -------------------------------------------------------------- Office B admin sees none of A
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_adminB, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; ok := n = 1;
  select count(*) into n from public.matters; ok := ok and n = 1;
  select count(*) into n from public.matter_parties; ok := ok and n = 0;
  if ok then r := r || 'B.seesOnlyOwn=ok; '; else r := r || 'B.seesOnlyOwn=FAIL; '; fails := fails + 1; end if;
  update public.matters set title = 'x' where id = mA1; get diagnostics n = row_count;
  if n = 0 then r := r || 'B.updateMatterA=ok; '; else r := r || 'B.updateMatterA=FAIL(' || n || '); '; fails := fails + 1; end if;
  execute 'reset role';

  -------------------------------------------------------------- lawyers: own matters only, self-assignment only
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_lawyerA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.matters;
  if n = 0 then r := r || 'lawyer.unassignedHidden=ok; '; else r := r || 'lawyer.unassignedHidden=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin perform public.save_matter(jsonb_build_object('id', gen_random_uuid(), 'client_id', cA1, 'assigned_lawyer_id', u_lawyerA2, 'matter_number', 'L-0', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'lawyer.assignOther=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'lawyer.assignOther=ok; '; end;
  begin perform public.save_matter(jsonb_build_object('id', mL, 'client_id', cA1, 'assigned_lawyer_id', u_lawyerA, 'matter_number', 'L-1', 'title', 'قضية المحامي', 'matter_type', 'labour', 'status', 'open'), '[]');
    select count(*) into n from public.matters where id = mL;
    if n = 1 then r := r || 'lawyer.createOwn=ok; '; else r := r || 'lawyer.createOwn=FAIL(' || n || '); '; fails := fails + 1; end if;
  exception when others then r := r || 'lawyer.createOwn=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  begin update public.matters set assigned_lawyer_id = u_lawyerA2 where id = mL;
    r := r || 'lawyer.reassign=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'lawyer.reassign=ok; '; end;
  execute 'reset role';

  -------------------------------------------------------------- reception: clients' contact details only, no matters
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_recA, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.clients set whatsapp = '+249912000077' where id = cA1; get diagnostics n = row_count;
  if n = 1 then r := r || 'reception.editContact=ok; '; else r := r || 'reception.editContact=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin update public.clients set full_name = 'x' where id = cA1; r := r || 'reception.editName=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'reception.editName=ok; '; end;
  begin update public.clients set status = 'archived' where id = cA1; r := r || 'reception.archive=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'reception.archive=ok; '; end;
  select count(*) into n from public.matters;
  if n = 0 then r := r || 'reception.readMatters=ok; '; else r := r || 'reception.readMatters=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin perform public.save_matter(jsonb_build_object('id', gen_random_uuid(), 'client_id', cA1, 'matter_number', 'R-1', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'reception.createMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'reception.createMatter=ok; '; end;
  execute 'reset role';

  -------------------------------------------------------------- client portal account: no office CRUD
  perform public.svc_link_client_login(u_adminA, u_portal, cA1, '+249900000006');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u_portal, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.clients; ok := n = 0;
  select count(*) into n from public.matters; ok := ok and n = 0;
  select count(*) into n from public.matter_parties; ok := ok and n = 0;
  if ok then r := r || 'portal.readNothing=ok; '; else r := r || 'portal.readNothing=FAIL; '; fails := fails + 1; end if;
  begin insert into public.clients (full_name) values ('x'); r := r || 'portal.createClient=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'portal.createClient=ok; '; end;
  update public.clients set full_name = 'x' where id = cA1; get diagnostics n = row_count;
  if n = 0 then r := r || 'portal.updateClient=ok; '; else r := r || 'portal.updateClient=FAIL(' || n || '); '; fails := fails + 1; end if;
  begin perform public.save_matter(jsonb_build_object('id', gen_random_uuid(), 'client_id', cA1, 'matter_number', 'P-1', 'title', 'x', 'matter_type', 'civil', 'status', 'open'), '[]');
    r := r || 'portal.createMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'portal.createMatter=ok; '; end;
  update public.matters set title = 'x' where id = mA1; get diagnostics n = row_count;
  if n = 0 then r := r || 'portal.updateMatter=ok; '; else r := r || 'portal.updateMatter=FAIL(' || n || '); '; fails := fails + 1; end if;
  execute 'reset role';

  -------------------------------------------------------------- unauthenticated: no business table access
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin perform count(*) from public.clients; r := r || 'anon.readClients=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.readClients=ok; '; end;
  begin perform count(*) from public.matters; r := r || 'anon.readMatters=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.readMatters=ok; '; end;
  begin perform count(*) from public.matter_parties; r := r || 'anon.readParties=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.readParties=ok; '; end;
  begin perform public.save_matter(jsonb_build_object('id', gen_random_uuid(), 'client_id', cA1, 'title', 'x', 'matter_type', 'civil'), '[]');
    r := r || 'anon.saveMatter=FAIL(allowed); '; fails := fails + 1;
  exception when others then r := r || 'anon.saveMatter=ok; '; end;
  execute 'reset role';

  -- audit trail recorded the business writes
  select count(*) into n from public.audit_logs where office_id = oA and entity_type in ('client', 'matter');
  if n > 0 then r := r || 'audit.recorded=ok; '; else r := r || 'audit.recorded=FAIL(0); '; fails := fails + 1; end if;

  raise exception 'TEST RESULTS (rolled back): %failures=%', r, fails;
end $test$;
