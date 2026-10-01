-- Preserve all matter types already supported by the deployed database.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.sync_matter(uuid,uuid,uuid,integer,jsonb)'::regprocedure) into definition;
 execute replace(definition,
 '''CRIMINAL'',''CIVIL'',''PERSONAL_STATUS'',''LABOUR'',''SPECIAL_COURT'',''COMMERCIAL_REGISTRY'',''LAND_REGISTRY'',''NOTARIZATION'',''OTHER''',
 '''CRIMINAL'',''CIVIL'',''COMMERCIAL'',''PERSONAL_STATUS'',''LABOUR'',''ADMINISTRATIVE'',''REAL_ESTATE'',''SPECIAL_COURT'',''COMMERCIAL_REGISTRY'',''LAND_REGISTRY'',''NOTARIZATION'',''CONSULTATION'',''OTHER''');
end $migration$;
