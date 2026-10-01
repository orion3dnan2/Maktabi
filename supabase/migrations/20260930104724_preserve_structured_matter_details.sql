-- The mobile details editor exposes string fields. Preserve existing structured fields on partial updates.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.sync_matter(uuid,uuid,uuid,integer,jsonb)'::regprocedure) into definition;
 execute replace(definition, 'details=p_data->''details''', 'details=details || (p_data->''details'')');
end $migration$;
