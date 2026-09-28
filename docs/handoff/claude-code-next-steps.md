# Claude Code — Next Steps

## Current status

- PR #10 (Phase 1 phone sign-in, roles, RLS, Expo SDK 57) has been merged into `main`.
- Supabase project: `ngckrfvsjggpnaddivyq`.
- The database migration history and the repository migration filenames have now been reconciled on branch `phase2/migration-reconciliation`.
- The repository now restores the six previously missing migrations from the live Supabase migration history and uses the exact live version numbers for the four Phase 1 migrations.

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

Do not create replacement migration versions for these entries. New database changes must use new later migration versions only.

## Immediate next work

1. Validate the restored migration files against the live Supabase migration history.
2. Ensure a fresh database can replay the migrations in order without manual intervention.
3. Run the Phase 1 RLS regression SQL test.
4. Start Phase 2 by moving Clients and Matters from local encrypted repositories to Supabase, preserving office isolation and RLS.
5. Keep Dashboard and Calendar derived from the same authoritative repositories instead of duplicating state.
6. Add migration/database checks to CI so repository/database drift is caught automatically.

## Authentication security

Public self-signup must remain disabled. Accounts should be created only through the trusted server-side `manage-users` flow according to the Phase 1 role model.

The Supabase connector available in ChatGPT does not expose the Auth dashboard setting for toggling public signup, so verify in Supabase Dashboard:

Authentication → Sign In / Providers (or Auth settings) → disable **Allow new users to sign up**.

Do not replace this control with a frontend-only restriction.

## Engineering rules

- Do not bypass RLS.
- Never place a `service_role` key in the mobile app.
- Do not move Clients or Matters to cloud persistence until migration replay is verified.
- Do not modify Sudan-specific defaults (currency, timezone, identity, payment methods) without explicit product approval.
- Update README and this handoff whenever architecture or migration state changes.
