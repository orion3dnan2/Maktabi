-- Align sync with deployed identity constraints and stamp trusted membership actors.
CREATE OR REPLACE FUNCTION public.sync_client(p_operation uuid, p_office uuid, p_id uuid, p_base_revision integer, p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_revision integer; v_hash text:=encode(sha256(convert_to(p_data::text || p_office::text || p_id::text || p_base_revision::text,'UTF8')),'hex'); v_receipt public.sync_receipts;
begin
  if private.office_role(p_office) is null or p_office is distinct from private.current_office_id() then raise exception 'office access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation::text,0));
  select * into v_receipt from public.sync_receipts where user_id=auth.uid() and operation_id=p_operation;
  if found then
    if v_receipt.request_hash<>v_hash or v_receipt.kind<>'client' then raise exception 'mutation id reused' using errcode='22023'; end if;
    return v_receipt.revision;
  end if;
  if length(trim(coalesce(p_data->>'displayName','')))=0 or p_data->>'kind' not in ('PERSON','ORGANIZATION') or length(coalesce(p_data->>'phone',''))<7 then raise exception 'invalid client fields' using errcode='22023'; end if;
  if nullif(btrim(p_data->>'nationalId'),'') is not null and exists(select 1 from public.clients where id=p_id and office_id=p_office and id_type is not null and id_type<>'national_id') then raise exception 'existing non-national identity is preserved; identity changes require a dedicated form' using errcode='22023'; end if;
  select revision into v_revision from public.clients where id=p_id and office_id=p_office for update;
  if coalesce(v_revision,0)<>p_base_revision then raise exception 'revision conflict' using errcode='40001'; end if;
  if v_revision is null then
    insert into public.clients(id,office_id,full_name,client_type,phone,whatsapp,email,address,contact_person,registration_number,civil_id,id_type,notes)
    values(p_id,p_office,trim(p_data->>'displayName'),case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,p_data->>'phone',p_data->>'whatsapp',nullif(p_data->>'email',''),p_data->>'address',p_data->>'contactPerson',nullif(btrim(p_data->>'registration'),''),nullif(btrim(p_data->>'nationalId'),''),case when nullif(btrim(p_data->>'nationalId'),'') is not null then 'national_id'::public.identity_document_type end,p_data->>'notes') returning revision into v_revision;
  else
    update public.clients set full_name=trim(p_data->>'displayName'),client_type=case when p_data->>'kind'='PERSON' then 'individual'::public.client_type else 'organization'::public.client_type end,
    phone=p_data->>'phone',whatsapp=p_data->>'whatsapp',email=nullif(p_data->>'email',''),address=p_data->>'address',contact_person=p_data->>'contactPerson',registration_number=p_data->>'registration',civil_id=case when id_type is null or id_type='national_id' then nullif(btrim(p_data->>'nationalId'),'') else civil_id end,
    id_type=case when id_type is null or id_type='national_id' then case when nullif(btrim(p_data->>'nationalId'),'') is not null then 'national_id'::public.identity_document_type end else id_type end,notes=p_data->>'notes'
    where id=p_id and office_id=p_office returning revision into v_revision;
    if not found then raise exception 'client update denied' using errcode='42501'; end if;
  end if;
  insert into public.sync_receipts(office_id,operation_id,entity_id,kind,request_hash,revision) values(p_office,p_operation,p_id,'client',v_hash,v_revision);
  return v_revision;
end $function$;

CREATE OR REPLACE FUNCTION public.svc_add_member(p_actor uuid, p_user uuid, p_role app_role, p_full_name text, p_phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_office uuid;
begin
  select p.office_id into v_office
    from public.profiles p join public.offices o on o.id = p.office_id
   where p.id = p_actor and p.role = 'admin' and p.is_active and o.status = 'active'
     and exists(select 1 from public.office_members m where m.office_id=p.office_id and m.user_id=p_actor and m.status='active' and m.role='admin');
  if v_office is null then raise exception 'only an active office admin can add members' using errcode = '42501'; end if;
  if p_role is null or p_role = 'client' then raise exception 'invalid staff role' using errcode = '22023'; end if;
  update public.profiles
     set office_id = v_office, role = p_role, is_active = true, full_name = left(btrim(p_full_name), 200), phone = p_phone
   where id = p_user and office_id is null;
  if not found then raise exception 'user already belongs to an office' using errcode = '23505'; end if;
  update public.office_members set created_by=p_actor where office_id=v_office and user_id=p_user;
  insert into public.audit_logs(office_id,user_id,action,entity_type,entity_id,metadata)
  values(v_office,p_actor,'member_added','office_member',p_user,jsonb_build_object('role',p_role));
  return v_office;
end $function$;

CREATE OR REPLACE FUNCTION public.svc_create_office(p_actor uuid, p_admin uuid, p_admin_name text, p_admin_phone text, p_name text, p_name_ar text, p_phone text, p_country character DEFAULT 'SD'::bpchar, p_currency character DEFAULT 'SDG'::bpchar, p_timezone text DEFAULT 'Africa/Khartoum'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_office uuid;
begin
  if not private.is_platform_admin(p_actor) then
    raise exception 'platform owner only' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_admin and p.office_id is not null) then
    raise exception 'user already belongs to an office' using errcode = '23505';
  end if;
  insert into public.offices (name, name_ar, phone, country, default_currency, timezone)
  values (btrim(p_name), nullif(btrim(coalesce(p_name_ar, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''), p_country, p_currency, p_timezone)
  returning id into v_office;
  update public.profiles
     set office_id = v_office, role = 'admin', is_active = true, full_name = left(btrim(p_admin_name), 200), phone = p_admin_phone
   where id = p_admin;
  if not found then raise exception 'admin profile not found' using errcode = 'P0002'; end if;
  update public.office_members set created_by=p_actor where office_id=v_office and user_id=p_admin;
  perform private.write_audit(v_office, 'office_created', 'office', v_office, jsonb_build_object('admin_user_id', p_admin, 'by_platform_admin', p_actor));
  return v_office;
end $function$
