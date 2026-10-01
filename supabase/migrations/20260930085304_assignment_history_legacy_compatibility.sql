create function private.sync_primary_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.assigned_lawyer_id is not distinct from old.assigned_lawyer_id then return new; end if;
 update public.matter_assignments set ended_at=now()
 where office_id=new.office_id and matter_id=new.id and is_primary and ended_at is null
 and (new.assigned_lawyer_id is null or user_id<>new.assigned_lawyer_id);
 if new.assigned_lawyer_id is not null and not exists(select 1 from public.matter_assignments where matter_id=new.id and user_id=new.assigned_lawyer_id and is_primary and ended_at is null) then
  update public.matter_assignments set ended_at=now() where matter_id=new.id and user_id=new.assigned_lawyer_id and ended_at is null;
  insert into public.matter_assignments(office_id,matter_id,user_id,is_primary,assigned_by)
  values(new.office_id,new.id,new.assigned_lawyer_id,true,auth.uid());
 end if;
 return new;
end $$;
revoke all on function private.sync_primary_assignment() from public;
create trigger matters_primary_assignment after insert or update of assigned_lawyer_id on public.matters for each row execute function private.sync_primary_assignment();
