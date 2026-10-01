-- Synthetic fixtures only. Every change is rolled back.
begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid(); requester uuid:=gen_random_uuid(); reception uuid:=gen_random_uuid();
  office_id uuid; client_id uuid:=gen_random_uuid(); operation_id uuid:=gen_random_uuid();
  payload jsonb; revision integer; source text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
  n integer; before_count integer; blocked boolean; result text;
begin
  insert into auth.users(id,email,aud,role,instance_id)
    select id,'test-'||id||'@phone.maktabi.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000'
    from unnest(array[owner_id,requester,reception]) id;
  insert into private.platform_admins values(owner_id);
  office_id:=public.svc_request_office(requester,'Integration Admin','+249900009801','TEMP Integration Request',null,null,null);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',requester,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  blocked:=false;
  begin perform public.log_login_success(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'pending login audit allowed'; end if;
  execute 'reset role';
  perform public.svc_review_office_request(owner_id,office_id,true);
  execute 'set local role authenticated';
  perform public.log_login_success();
  payload:=jsonb_build_object('displayName','Trial Client','kind','PERSON','phone','+249900009802','whatsapp','+249900009802');
  revision:=public.sync_client(gen_random_uuid(),office_id,client_id,0,payload);
  revision:=public.sync_client(operation_id,office_id,client_id,revision,payload||'{"status":"ARCHIVED"}'::jsonb);
  if (select status from public.clients where id=client_id)<>'archived' then raise exception 'client archive lost'; end if;
  if public.sync_client(operation_id,office_id,client_id,revision-1,payload||'{"status":"ARCHIVED"}'::jsonb)<>revision then raise exception 'archive retry changed revision'; end if;
  revision:=public.sync_client(gen_random_uuid(),office_id,client_id,revision,payload||'{"status":"ACTIVE"}'::jsonb);
  execute 'reset role';
  perform public.svc_add_member(requester,reception,'reception','Reception','+249900009803');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reception,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  blocked:=false;
  begin perform public.sync_client(gen_random_uuid(),office_id,client_id,revision,payload||'{"status":"ARCHIVED"}'::jsonb); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'reception archived client'; end if;
  blocked:=false;
  begin perform public.svc_consume_office_request_attempt(source); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'authenticated caller consumed service budget'; end if;
  execute 'reset role';
  update public.offices set status='suspended' where id=office_id;
  execute 'set local role authenticated';
  blocked:=false;
  begin perform public.log_login_success(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'suspended audit allowed'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  for n in 1..10 loop
    result:=public.svc_consume_office_request_attempt(source);
    if result is not null then raise exception 'attempt rejected early: %',result; end if;
  end loop;
  if public.svc_consume_office_request_attempt(source) is distinct from 'too_many' then raise exception 'source attempts not limited'; end if;
  execute 'reset role';
  select count(*) into before_count from private.office_request_attempts where created_at>now()-interval '1 day';
  insert into private.office_request_attempts(source_hash) select null from generate_series(1,100-before_count);
  execute 'set local role service_role';
  if public.svc_consume_office_request_attempt(null) is distinct from 'daily_limit' then raise exception 'global fallback missing'; end if;
  execute 'reset role';
end $test$;
select 'PASS: trial audit guards, client status sync/idempotency, role isolation and all-attempt throttling' as result;
rollback;
