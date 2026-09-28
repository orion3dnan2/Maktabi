-- PostgREST requests run with pg-safeupdate, which rejects DELETE without WHERE
-- even inside functions. Clear the remaining one-time codes with an explicit predicate.
create or replace function public.svc_bootstrap_owner(p_code_hash text, p_user uuid, p_full_name text, p_phone text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  lock table private.platform_admins in exclusive mode;
  if exists (select 1 from private.platform_admins) then return false; end if;
  delete from private.bootstrap_codes where code_hash = p_code_hash and expires_at > now();
  if not found then return false; end if;
  delete from private.bootstrap_codes where code_hash is not null;
  insert into private.platform_admins (user_id) values (p_user);
  update public.profiles set full_name = left(btrim(p_full_name), 200), phone = p_phone where id = p_user;
  return true;
end $function$;
revoke all on function public.svc_bootstrap_owner(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.svc_bootstrap_owner(text, uuid, text, text) to service_role;
