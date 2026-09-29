-- E2E seed (local replica only): platform owner, Office A (admin, lawyer, reception), Office B (admin).
do $$
declare
  u_owner uuid := '00000000-0000-4000-8000-0000000000aa';
  u_adminA uuid := '00000000-0000-4000-8000-000000000011';
  u_lawyerA uuid := '00000000-0000-4000-8000-000000000012';
  u_recA uuid := '00000000-0000-4000-8000-000000000013';
  u_adminB uuid := '00000000-0000-4000-8000-000000000021';
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (u_owner, 'p249900000099@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_adminA, 'p249900000011@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_lawyerA, 'p249900000012@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_recA, 'p249900000013@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_adminB, 'p249900000021@phone.maktabi.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into private.platform_admins values (u_owner);
  perform public.svc_create_office(u_owner, u_adminA, 'سامية الأمين', '+249900000011', 'Office A', 'مكتب أ للمحاماة', null);
  perform public.svc_create_office(u_owner, u_adminB, 'بشير النور', '+249900000021', 'Office B', 'مكتب ب للمحاماة', null);
  perform public.svc_add_member(u_adminA, u_lawyerA, 'lawyer', 'خالد عثمان', '+249900000012');
  perform public.svc_add_member(u_adminA, u_recA, 'reception', 'منى حسن', '+249900000013');
end $$;
select p.full_name, p.role, o.name_ar from public.profiles p left join public.offices o on o.id = p.office_id order by p.phone;
