# Local end-to-end check (Phase 2: clients and matters)

Runs the exported web app in Chromium against a **local replica**: every migration in
`supabase/migrations` replayed on plain PostgreSQL 17 (with `../supabase_stub.sql`), served by a
real PostgREST 12, so row-level security, guard triggers, foreign keys and `save_matter` behave as
in the Supabase project. Nothing is sent to the live project.

What is simulated: `gateway.cjs` stands in for the Supabase API gateway. It proxies `/rest/v1` to
PostgREST and replaces GoTrue with a minimal password sign-in for the four seeded accounts
(`seed.sql`), signing HS256 JWTs with the same throwaway secret as `postgrest.conf`. Edge
Functions (`manage-users`) are not part of this check.

## Requirements

PostgreSQL 17 server and `psql` (superuser), PostgREST 12, Node 22, Playwright with Chromium
(`npm i -g playwright`; not a repository dependency).

## Run

```sh
# 1. database (uses PGHOST / PGPORT / PGUSER)
supabase/tests/local/e2e/reset.sh
# 2. PostgREST (adjust db-uri to your server, or set PGRST_DB_URI)
postgrest supabase/tests/local/e2e/postgrest.conf
# 3. web build pointed at the gateway
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 \
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e_local \
  npx expo export --platform web --output-dir /tmp/maktabi-e2e-dist --clear
# 4. gateway (serves the app and the API on http://localhost:54321)
DIST=/tmp/maktabi-e2e-dist node supabase/tests/local/e2e/gateway.cjs
# 5. scenarios (optional screenshot directory)
node supabase/tests/local/e2e/scenarios.cjs /tmp/maktabi-e2e-shots
```

The scenarios need a freshly reset database. They cover: sign-in and role routing, dashboard
counts, client create/edit/search/archive/restore, matter create/edit with a lawyer, an additional
client and an opponent, client names joined from the client record, reload and sign-in on a new
device, Office B isolation (lists and direct links), duplicate identity numbers, a lawyer's
assigned matters, and reception's contact-only access. Each scenario also checks the rows written
to the database.
