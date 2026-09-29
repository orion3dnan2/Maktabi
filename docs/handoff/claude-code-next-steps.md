# Claude Code — Next Steps

## Current status

- PR #10 (Phase 1 phone sign-in, roles, RLS, Expo SDK 57) is merged into `main`.
- Supabase project: `ngckrfvsjggpnaddivyq`.
- Migration history reconciled (branch `phase2/migration-reconciliation`, merged): the repository files match the live `supabase_migrations.schema_migrations` byte for byte, and all migrations replay in order on a clean PostgreSQL 17 (`supabase/tests/local/supabase_stub.sql`).
- **Phase 2 (branch `phase2/supabase-clients-matters`): Clients and Matters moved to Supabase.** Migration `20260929081219_phase2_clients_matters` is applied to the live project. The app reads and writes clients, matters and matter parties only through `apps/mobile/src/data/supabase/*`; RLS is the security boundary.

## Migration source of truth

The authoritative applied migration history is:

1. `20260927113413_maktabi_init`
2. `20260927114655_drop_superseded_draft_schema`
3. `20260927114753_core_schema_offices_profiles_legal_records`
4. `20260927114857_integrity_triggers_audit_and_auth_provisioning`
5. `20260927114928_row_level_security_policies`
6. `20260927114940_storage_legal_documents_bucket`
7. `20260928140727_client_role_enum`
8. `20260928140850_platform_owner_client_portal_access`
9. `20260928141155_svc_actor_info`
10. `20260928141547_fix_bootstrap_owner_delete`
11. `20260929081219_phase2_clients_matters` — `clients.whatsapp` (reception may edit it); `matter_parties` references a client instead of copying its name (exactly one of `client_id` / `display_name`, a client once per matter); `public.save_matter(p_matter, p_parties)`, SECURITY INVOKER, saves a matter and its parties in one transaction.
12. `20260929093954_sudan_only_defaults` — the app is Sudan-only (product decision 2026-09-29): office/payment defaults `SD`/`SDG`/`Africa/Khartoum`, payment amounts with two decimals, office numbering year in Khartoum time, the Kuwait civil-ID rule dropped, `clients_national_id_digits` (the Sudanese national number is digits only), `payment_method` value `knet` renamed to `bankak`, `private.bootstrap_office` defaults `SD`/`SDG`.
13. `20260929100948_sudanese_phone_numbers` — every stored phone number (clients phone/secondary/whatsapp, offices, profiles) must be Sudanese E.164: `^\+249[1-9][0-9]{8}$`.

Do not create replacement migration versions for these entries. New database changes must use new later migration versions only.

## What Phase 2 changed in the app

- `src/data/supabase/`: typed repositories (`database.types.ts` generated from the live schema), row/domain mappers, Arabic error mapping (`RepositoryError`, technical details kept on the error).
- Clients: list (non-archived), archived list, get, create/update (upsert by id, never sends `office_id` or `status`), archive/restore by status. No deletes anywhere.
- Matters: list/get/by client/active, create/update through `save_matter`, status change, assigned lawyer (admin reassigns; a lawyer's new matter is assigned to themselves — enforced by `guard_matters`). Client names are always joined from `clients`, never copied.
- Device vault (`src/data/localStore.ts`, snapshot version 2) now holds only matter workflows (appointments, documents, fees, receipts, expenses, deposits, stages, deadlines, notes, activity) and office settings, keyed by the server matter id. Every workflow write re-reads the matter from the server; closing a matter changes its server status first. Version-1 vaults keep their old client/matter records encrypted and unread under `legacy`.
- Dashboard: client and active-matter counts from Supabase, greeting from the signed-in user; sessions/deadlines/fees/activity from the device and labelled as such.
- Reception: no matter screens (RLS gives none), contact-only client edits. Role helpers in `src/auth/access.ts` mirror the database rules; the database enforces them.

## How it was verified

- `supabase/tests/phase1_access.sql`, `supabase/tests/phase2_clients_matters.sql` (44 checks, `failures=0`) and `supabase/tests/sudan_only.sql` (22 checks, `failures=0`) on the live project and on a fresh local replay.
- Live checks after the migration: columns, constraints, FKs, indexes, RLS enabled with unchanged policies, `save_matter` not SECURITY DEFINER, execute granted to `authenticated` only. Security advisors: only the four pre-existing intentional SECURITY DEFINER RPC warnings.
- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` (also with generated typed routes), `pnpm test` (domain 31, mobile 116), `pnpm build`.
- `supabase/tests/local/e2e/`: the exported web app in Chromium against the replayed database behind a real PostgREST 12 — 15 scenarios (CRUD, relationships, reload, new device, Office A/B isolation, lawyer and reception rules), each checked in the database. GoTrue is simulated by a small gateway; the live Supabase API host was not reachable from the build environment.

## Immediate next work

1. Sudan-only is decided and done: migrations 12–13; the national number is digits only with no fixed length; every phone number is Sudanese (+249), enforced by the shared rule in `packages/domain/src/phone.ts` (app), its identical copy in `manage-users` (redeployed as version 6), and database constraints. The identity enum still contains other document types (`civil_id`, `passport`, …) and the column is still named `civil_id`; renaming them is optional cleanup.
2. Move matter workflows to the existing Supabase tables (`appointments`, `documents` + Storage, `payments`, `tasks`) with the same repository pattern, then retire the device vault for them.
3. Offline/sync layer behind the domain repository interfaces (queue, idempotent writes with device UUIDs, conflict handling).
4. Duplicate detection by phone / similar name (national number is already unique per office).
5. Add migration replay + the SQL tests to CI (the local stub makes this possible without Docker).
6. Build hygiene: Turbo's `build` cache and Metro's cache do not key on `EXPO_PUBLIC_*`/`.env`; use `pnpm build --force` and `expo export --clear` until fixed.

## Authentication security

Public self-signup must remain disabled. Accounts should be created only through the trusted server-side `manage-users` flow according to the Phase 1 role model.

Verify in Supabase Dashboard: Authentication → Sign In / Providers (or Auth settings) → disable **Allow new users to sign up**.

Do not replace this control with a frontend-only restriction.

## Engineering rules

- Do not bypass RLS.
- Never place a `service_role` key in the mobile app.
- Screens never call Supabase directly for clients and matters; use `src/data/repositories.ts`.
- Do not hard-delete legal or business records; archive by status.
- Do not modify Sudan-specific defaults (currency, timezone, identity, payment methods) without explicit product approval.
- Run `supabase/tests/phase1_access.sql` and `supabase/tests/phase2_clients_matters.sql` after any change to permissions, clients, matters or parties, and `supabase/tests/sudan_only.sql` after any change to defaults, identity, phone numbers or payments.
- Update README and this handoff whenever architecture or migration state changes.
