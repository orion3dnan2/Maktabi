#!/bin/sh
# Recreates the e2e database: Supabase stub, every migration in order, then seed.sql.
# Connection from the usual PG* variables (PGHOST, PGPORT, PGUSER); the user must be a superuser.
set -e
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../../.." && pwd)
psql -d postgres -qc "drop database if exists e2e with (force)" -c "create database e2e"
psql -d e2e -v ON_ERROR_STOP=1 -q -f "$repo/supabase/tests/local/supabase_stub.sql" >/dev/null 2>&1
psql -d postgres -qc "alter role authenticator password 'e2e-authenticator'"
for f in "$repo"/supabase/migrations/*.sql; do psql -d e2e -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f"; exit 1; }; done
psql -d e2e -v ON_ERROR_STOP=1 -q -f "$here/seed.sql" >/dev/null
psql -d e2e -Atc "select count(*) || ' seeded profiles' from public.profiles"
