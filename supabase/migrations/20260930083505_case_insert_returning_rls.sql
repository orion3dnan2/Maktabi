drop policy matters_select on public.matters;
create policy matters_select on public.matters for select to authenticated using(
 private.office_role(office_id) in ('admin','employee')
 or (private.office_role(office_id)='lawyer' and (
 created_by=auth.uid() or assigned_lawyer_id=auth.uid() or private.can_access_matter(id))));
