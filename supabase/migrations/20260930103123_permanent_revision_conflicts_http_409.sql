-- Domain revision conflicts are permanent for this command, not serialization failures.
-- PostgREST may retry custom 40001 indefinitely. PT409 returns HTTP 409 immediately.
do $migration$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.sync_client(uuid,uuid,uuid,integer,jsonb)',
  'public.sync_matter(uuid,uuid,uuid,integer,jsonb)',
  'private.apply_case_assignment(uuid,uuid,uuid,integer,jsonb)'
 ] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  execute replace(definition, '''40001''', '''PT409''');
 end loop;
end $migration$;
