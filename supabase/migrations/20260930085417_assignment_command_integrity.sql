create function private.apply_case_assignment(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_revision integer; v_user uuid:=(p_data->>'userId')::uuid; v_primary boolean:=coalesce((p_data->>'isPrimary')::boolean,false);
v_remove boolean:=coalesce((p_data->>'remove')::boolean,false); v_receipt public.sync_receipts;
v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex');
begin
 if private.office_role(p_office) is distinct from 'admin' then raise exception 'admin only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
 select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
 if found then if v_receipt.request_hash<>v_hash or v_receipt.kind<>'assignment' then raise exception 'mutation id reused' using errcode='22023'; end if; return v_receipt.revision; end if;
 select revision into v_revision from public.matters where id=p_id and office_id=p_office for update;
 if v_revision is null then raise exception 'case access denied' using errcode='42501'; end if;
 if v_revision<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
 if v_remove then
  update public.matter_assignments set ended_at=now() where office_id=p_office and matter_id=p_id and user_id=v_user and ended_at is null;
  update public.matters set assigned_lawyer_id=case when assigned_lawyer_id=v_user then null else assigned_lawyer_id end where id=p_id returning revision into v_revision;
 else
  if not exists(select 1 from public.office_members where office_id=p_office and user_id=v_user and status='active' and (not v_primary or role in ('admin','lawyer'))) then raise exception 'invalid assignee' using errcode='23514'; end if;
  update public.matter_assignments set ended_at=now() where office_id=p_office and matter_id=p_id and ended_at is null and (user_id=v_user or (v_primary and is_primary));
  insert into public.matter_assignments(office_id,matter_id,user_id,is_primary) values(p_office,p_id,v_user,v_primary);
  update public.matters set assigned_lawyer_id=case when v_primary then v_user when assigned_lawyer_id=v_user then null else assigned_lawyer_id end where id=p_id returning revision into v_revision;
 end if;
 insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'assignment',v_hash,v_revision);
 return v_revision;
end $$;
revoke all on function private.apply_case_assignment(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function private.apply_case_assignment(uuid,uuid,uuid,integer,jsonb) to authenticated;

revoke insert,update on public.matter_assignments from authenticated;
create or replace function public.sync_assignment(p_operation uuid,p_office uuid,p_id uuid,p_base_revision integer,p_data jsonb)
returns integer language sql security invoker set search_path='' as $$
select private.apply_case_assignment(p_operation,p_office,p_id,p_base_revision,p_data)
$$;
revoke all on function public.sync_assignment(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_assignment(uuid,uuid,uuid,integer,jsonb) to authenticated;
