-- Sudan-only defaults regression test. Run after changes to offices, clients identity,
-- payments or office numbering. One DO block ending in RAISE, so everything is rolled back.
-- Every check prints "name=ok"; the last entry is "failures=N" (expected: failures=0).
do $test$
declare
  r text := ''; fails int := 0; v text; n bigint;
  u_owner uuid := gen_random_uuid(); u_admin uuid := gen_random_uuid(); o uuid; c uuid;
begin
  -- column defaults
  select string_agg(column_name || '=' || column_default, ',' order by column_name) into v
    from information_schema.columns
   where table_schema = 'public' and ((table_name = 'offices' and column_name in ('country', 'default_currency', 'timezone')) or (table_name = 'payments' and column_name = 'currency'));
  if v !~ 'KW' and v ~ 'country=''SD''' and v ~ 'default_currency=''SDG''' and v ~ 'timezone=''Africa/Khartoum''' and v ~ 'currency=''SDG'''
  then r := r || 'defaults=ok; '; else r := r || 'defaults=FAIL(' || v || '); '; fails := fails + 1; end if;

  select numeric_scale::text into v from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'amount';
  if v = '2' then r := r || 'amountScale=ok; '; else r := r || 'amountScale=FAIL(' || v || '); '; fails := fails + 1; end if;

  -- no Kuwait-specific rules or values left
  select count(*) into n from pg_constraint where conname = 'clients_kuwait_civil_id';
  if n = 0 then r := r || 'kuwaitCivilIdGone=ok; '; else r := r || 'kuwaitCivilIdGone=FAIL; '; fails := fails + 1; end if;
  select string_agg(enumlabel, ',' order by enumsortorder) into v from pg_enum where enumtypid = 'public.payment_method'::regtype;
  if v !~ 'knet' and v ~ 'bankak' then r := r || 'paymentMethods=ok; '; else r := r || 'paymentMethods=FAIL(' || v || '); '; fails := fails + 1; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname in ('public', 'private') and (p.prosrc ~* 'kuwait' or pg_get_function_arguments(p.oid) ~ '''KW');
  if n = 0 then r := r || 'noKuwaitInFunctions=ok; '; else r := r || 'noKuwaitInFunctions=FAIL(' || n || '); '; fails := fails + 1; end if;

  -- an office created with the column defaults is Sudanese, and numbering uses the Sudan year
  insert into auth.users (id, email, aud, role, instance_id) values
    (u_owner, 'p249900000901@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_admin, 'p249900000902@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into private.platform_admins values (u_owner);
  o := public.svc_create_office(u_owner, u_admin, 'مدير', '+249900000902', 'Sudan test', 'مكتب اختبار', null);
  insert into public.offices (name) values ('Defaults only') returning country || '/' || default_currency || '/' || timezone into v;
  if v = 'SD/SDG/Africa/Khartoum' then r := r || 'officeDefaults=ok; '; else r := r || 'officeDefaults=FAIL(' || v || '); '; fails := fails + 1; end if;
  v := private.next_office_number(o, 'matter', 'M');
  if v = 'M-' || extract(year from now() at time zone 'Africa/Khartoum') || '-00001' then r := r || 'numberingYear=ok; '; else r := r || 'numberingYear=FAIL(' || v || '); '; fails := fails + 1; end if;

  -- the Sudanese national number is digits only
  begin
    insert into public.clients (office_id, full_name, id_type, id_country, civil_id) values (o, 'رقم صحيح', 'national_id', 'SD', '12345678901');
    r := r || 'nationalIdDigits=ok; ';
  exception when others then r := r || 'nationalIdDigits=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;
  foreach v in array array['123-456', '12 34', 'AB123', '١٢٣٤٥'] loop
    begin
      insert into public.clients (office_id, full_name, id_type, id_country, civil_id) values (o, 'رقم خاطئ', 'national_id', 'SD', v);
      r := r || 'nationalIdRejects(' || v || ')=FAIL(allowed); '; fails := fails + 1;
    exception when check_violation then r := r || 'nationalIdRejects(' || v || ')=ok; ';
    end;
  end loop;
  -- other document types keep their own formats (a passport may contain letters)
  begin
    insert into public.clients (office_id, full_name, id_type, civil_id) values (o, 'جواز', 'passport', 'P01234567');
    r := r || 'passportLetters=ok; ';
  exception when others then r := r || 'passportLetters=FAIL(' || sqlerrm || '); '; fails := fails + 1; end;

  -- payments default to the Sudanese pound, take two decimals and accept bankak
  insert into public.clients (office_id, full_name) values (o, 'دافع') returning id into c;
  insert into public.payments (office_id, client_id, amount, payment_method, paid_at) values (o, c, 1500.5, 'bankak', now())
    returning currency || '/' || payment_method || '/' || amount into v;
  if v = 'SDG/bankak/1500.50' then r := r || 'paymentDefaults=ok; '; else r := r || 'paymentDefaults=FAIL(' || v || '); '; fails := fails + 1; end if;

  raise exception 'TEST RESULTS (rolled back): %failures=%', r, fails;
end $test$;
