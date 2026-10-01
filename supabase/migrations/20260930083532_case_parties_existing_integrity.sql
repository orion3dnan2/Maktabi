create or replace function public.sync_matter(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_revision integer; v_client uuid; v_party jsonb; v_receipt public.sync_receipts;
v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex');
begin
 if private.office_role(p_office) not in ('admin','employee','lawyer') or private.office_role(p_office) is null or p_office is distinct from private.current_office_id() then raise exception 'case access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
 select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
 if found then if v_receipt.request_hash<>v_hash or v_receipt.kind<>'matter' then raise exception 'mutation id reused' using errcode='22023'; end if; return v_receipt.revision; end if;
 if length(trim(coalesce(p_data->>'title','')))=0 or length(trim(coalesce(p_data->>'reference','')))=0 or length(trim(coalesce(p_data->>'authority','')))=0
 or p_data->>'status' not in ('ACTIVE','ON_HOLD','CLOSED','ARCHIVED') or p_data->>'type' not in ('CRIMINAL','CIVIL','PERSONAL_STATUS','LABOUR','SPECIAL_COURT','COMMERCIAL_REGISTRY','LAND_REGISTRY','NOTARIZATION','OTHER')
 or jsonb_typeof(p_data->'details')<>'object'
 or (select count(*) from jsonb_array_elements(p_data->'parties') p where (p->>'isPrimary')::boolean and p->>'role'='CLIENT' and p->>'clientId' is not null)<>1 then raise exception 'invalid case fields' using errcode='22023'; end if;
 select (p->>'clientId')::uuid into v_client from jsonb_array_elements(p_data->'parties') p where (p->>'isPrimary')::boolean;
 if not exists(select 1 from public.clients where office_id=p_office and id=v_client) then raise exception 'client access denied' using errcode='42501'; end if;
 select revision into v_revision from public.matters where id=p_id and office_id=p_office for update;
 if coalesce(v_revision,0)<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
 if v_revision is null then
  insert into public.matters(id,office_id,client_id,matter_number,title,matter_type,court_name,status,opened_at,details,description)
  values(p_id,p_office,v_client,trim(p_data->>'reference'),trim(p_data->>'title'),lower(p_data->>'type')::public.matter_type,p_data->>'authority',
   (case p_data->>'status' when 'ACTIVE' then 'open' else lower(p_data->>'status') end)::public.matter_status,(p_data->>'openedAt')::date,p_data->'details',p_data->>'notes') returning revision into v_revision;
 else
  update public.matters set client_id=v_client,matter_number=trim(p_data->>'reference'),title=trim(p_data->>'title'),matter_type=lower(p_data->>'type')::public.matter_type,court_name=p_data->>'authority',
  status=(case p_data->>'status' when 'ACTIVE' then 'open' else lower(p_data->>'status') end)::public.matter_status,opened_at=(p_data->>'openedAt')::date,details=p_data->'details',description=p_data->>'notes'
  where id=p_id and office_id=p_office returning revision into v_revision;
  if not found then raise exception 'case update denied' using errcode='42501'; end if;
 end if;
 delete from public.matter_parties where matter_id=p_id and office_id=p_office;
 for v_party in select value from jsonb_array_elements(p_data->'parties') loop
  if v_party->>'clientId' is not null and not exists(select 1 from public.clients where id=(v_party->>'clientId')::uuid and office_id=p_office) then raise exception 'party client access denied' using errcode='42501'; end if;
  insert into public.matter_parties(id,office_id,matter_id,client_id,display_name,party_role,is_primary)
  values((v_party->>'id')::uuid,p_office,p_id,(v_party->>'clientId')::uuid,case when v_party->>'clientId' is null then v_party->>'displayName' else null end,lower(v_party->>'role')::public.party_role,coalesce((v_party->>'isPrimary')::boolean,false));
 end loop;
 insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'matter',v_hash,v_revision);
 return v_revision;
end $$;
revoke all on function public.sync_matter(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_matter(uuid,uuid,uuid,integer,jsonb) to authenticated;
