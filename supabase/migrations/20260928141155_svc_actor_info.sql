-- Lets the manage-users Edge Function reject unauthorised callers before it
-- creates an auth user (service_role only).
create or replace function public.svc_actor_info(p_actor uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'platform_admin', private.is_platform_admin(p_actor),
    'role', (select p.role from public.profiles p join public.offices o on o.id = p.office_id
              where p.id = p_actor and p.is_active and o.status = 'active')
  );
$function$;
revoke all on function public.svc_actor_info(uuid) from public, anon, authenticated;
grant execute on function public.svc_actor_info(uuid) to service_role;
