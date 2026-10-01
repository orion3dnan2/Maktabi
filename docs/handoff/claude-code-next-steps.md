# Engineering handoff — 2026-10-01 integration

## Integrated source

Integration branch: `codex/integrate-trial-release`.
- Existing offline foundation preserved in `b84d51b`.
- `origin/claude/determined-newton-5a1kyb` merged in `7336f4a`.
- `origin/claude/youthful-babbage-5kkk9r` merged in `c18e509`.
- Integration corrections follow those commits. This document supersedes the older cloud-only handoff.

Supabase project: `ngckrfvsjggpnaddivyq`. All 26 applied migration versions are present, including the nine offline-foundation migrations and the two trial-office migrations. Four obsolete duplicate 2026092817* files were removed after comparing them with the canonical applied versions. Do not recreate them. A clean PostgreSQL 18 replay using `supabase/tests/local/supabase_stub.sql` passed.

Latest migration: `20261001095602_trial_integration_guards.sql`, applied on the project. Edge function `manage-users`: **version 8, ACTIVE**, `verify_jwt=false`. Public request/bootstrap actions are intentional; account-management actions still validate the caller and use service-only SQL contracts.

## Data architecture

- UI → `src/data/repositories.ts`.
- Clients/matters/parties/assignments use `sharedRepositories` and the encrypted SQLite/IndexedDB operational store, durable outbox, revision-aware RPCs, tenant RLS and scoped cached access.
- Appointments/stages/deadlines/notes/templates/events use the server workflow repository. They currently need a connection.
- Financial entries/documents/settings remain in each user's encrypted legacy vault. A locked vault is labeled in the dashboard. No shared financial ledger or Storage upload queue is claimed.
- Version-1 vaults retain their original records under `legacy`. Explicitly imported case links recover the existing financial/document workflow. Original local schedules/notes remain preserved in legacy data; this release does not upload them automatically.
- Local repositories bind to the unlocked vault session: a late write from a prior account cannot persist into the next account.
- The dashboard uses the authenticated name, cached clients/cases, server schedules/activity, and explicitly local finance. Unavailable server schedule counts show an unavailable state.

## Corrections after merge

Preserved existing case types and expert parties; repaired Windows Vitest alias resolution; restored client archive/restore through sync; maintained legacy import after snapshot upgrade; bounded saved-session startup; actually executes the lazy login-audit RPC; pending accounts receive their specific access message.

The additive SQL patch denies pending/suspended login-audit writes and counts all valid public office-request attempts (including duplicate phones/Auth failures): 100/day global, 10/day per source, plus existing successful-request limits. The source fallback is still the global budget when a trustworthy IP header is unavailable. Responses are padded to at least two seconds as a timing mitigation, not a constant-time guarantee.

Turbo build inputs now include public Supabase variables and .env files; the mobile build clears Metro's cache.

## Verification

See [current integration evidence](../verification/trial-integration-2026-10-01.md).
- 169 mobile + 36 domain tests passed.
- Mobile TypeScript and Expo lint passed.
- Android/iOS/Web exports passed; no native APK was built by this integration run.
- Clean migration replay and all seven SQL test scripts passed locally.
- New SQL guard tests also passed against the linked project in a rolled-back transaction.
- Browser request form/navigation and required-field validation passed.
- General Auth signup was disabled and saved; screenshot in verification.
- Leaked-password protection remains disabled: project is Free, UI requires Pro.
- Full live Auth request → approval smoke test was blocked by automatic approval review before execution. No live office/account was created by that attempt.

## Remaining release work

1. Independently review critical integration/auth/sync changes before production acceptance (repository collaboration policy).
2. With explicit permission, run the disposable live request/account test, approve only its exact office, then remove only the recorded synthetic fixtures. The prepared script is `apps/mobile/scripts/verify-trial-api.mjs`; its manifest contains a temporary password and must be protected and removed. Do not run it against production without that permission.
3. Link EAS to the existing project (`eas init` if no projectId), build preview APK, and verify Android cold start, SQLite/SecureStore, offline edits, reconnect, two users/devices and the office-approval flow.
4. Validate legacy import against a backed-up genuine dataset.
5. Add database replay/SQL checks to CI; implement shared finance/documents and offline server workflows as separate slices.

## Rules retained

Keep Sudan phone/currency/timezone decisions. Never put service_role in mobile. Preserve RLS and office membership checks. Never silently overwrite revision conflicts or upload demo fixtures. Never delete genuine office/legal records. Update README/roadmap/handoff with changes. The Master Vision is unchanged.
