# Implementation roadmap

Authority: [MAKTABI_MASTER_VISION.md](MAKTABI_MASTER_VISION.md). Architecture: [MAKTABI_ARCHITECTURE.md](MAKTABI_ARCHITECTURE.md). Updated 2026-10-01.

**Current milestone:** office membership → shared clients → matters → assignments → RLS → offline sync. Implemented and verified on PostgreSQL, real HTTP sessions and the web app. Native release acceptance remains pending device validation. The full Master Vision is not complete.

## Completed
- Integrated cloud workflows, trial-office requests and the existing offline foundation; preserved the original product vision.
- Shared appointments/stages/deadlines/notes/templates/events with server permissions; pending office approval and platform request management.
- All 26 migrations present and clean replay verified; duplicate historical versions removed. Latest additive guard migration applied; manage-users v8 deployed.
- Client archive/restore synchronization, legacy financial mapping, preserved case/party types, bounded startup and late-write account isolation corrected.
- Public Auth signup disabled; timing mitigation and all-attempt request limits added. Build cache now includes Supabase variables/.env and clears Metro.
- Full Master Vision saved unchanged; normalized text compared against the supplied attachment.
- Actual Supabase schema, constraints, policies and triggers inspected; catalog snapshot and generated types saved.
- Nine additive migrations applied to the linked project and saved under their actual migration-history versions. Genuine office records were not migrated or deleted.
- Active/invited/suspended membership, creator stamps and trusted service-side active-admin checks; existing team management and role routing retained.
- Shared clients/cases/parties, primary/supporting assignments and assignment history with tenant RLS and audit integration.
- Encrypted native SQLite and web IndexedDB operational stores; atomic entity/outbox commit, user/office partitions, password-independent device keys.
- Ordered, idempotent sync, revision comparison, failed/conflict states, server preview and explicit discard confirmation. Permanent conflicts return PT409 / HTTP 409.
- Foreground/periodic retry, sync page, live refresh, central capabilities, authenticated-name greeting and empty production initialization.
- Sudanese phones/Arabic-digit normalization and national IDs; other identity types, existing case types/expert parties and structured details preserved.
- Bounded 24-hour offline membership lease, including Auth network-refresh failure; signout and known denial invalidate it. Denied repositories lock while encrypted drafts/outbox remain preserved.
- Optional admin-selected client/case import, deterministic mappings, duplicate reconciliation and original vault retention. Import planning is unit-tested; fixtures are never auto-uploaded.
- Legacy bridge preserves original data and recovers finance/documents for verified imported-case links; old local schedules/notes are retained under legacy, not automatically published to server workflows.
- React/lint errors fixed; background refresh preserves form drafts; cold startup offers explicit legacy vault unlock.

## In Progress / release gates
- Independent review of critical integration changes before production acceptance.
- Full live Auth office-request → approval test requires explicit permission after automatic approval review blocked creation of production test fixtures.
- Link EAS project, build and install preview APK; no native build was produced in this integration run.
- Verify SQLite + SecureStore, cold startup, airplane mode/reconnect and sharing on actual Android/iOS runtimes and two devices.
- Verify import/unlock UI on a backed-up genuine legacy dataset before office rollout.
- Finish [native acceptance](verification/foundation.md). Web tests/export alone are not production mobile acceptance.

## Missing
- Offline adapters for the now-shared procedures/stages/hearings/deadlines/notes; shared tasks/documents/finance/settings/notifications.
- Private Storage and offline document upload queue.
- Financial ledgers, reversals, immutable receipts/numbering and statements.
- Full shared office dashboard, workload and reliable financial/deadline reports.
- Full platform dashboard, office details, plans/subscriptions/usage/support/service activation.
- Multi-office switching and configurable granular permissions.

## Technical Debt
- Finance/documents/settings remain per-user JSON vaults during staged migration; server workflows have no offline adapter yet.
- Legacy vault recovery requires its original password/backup; older unscoped root-vault recovery needs a dedicated flow.
- The current details editor exposes string fields; structured fields are preserved by merge. Typed editing/removal needs a future contract.
- Legacy direct-table grants remain under RLS/audit; current app writes use revision-checked RPCs. Other API consumers must use that protocol.
- This first local adapter rewrites one scoped partition per transaction; optimize per-record changes before large-office rollout.
- Native store tests use node:sqlite on Node 24; align CI/test runtime with that requirement.
- Database replay/SQL tests are currently manual; CI integration is pending.
- Existing advisor warnings: deliberate auth-checked definer RPCs and disabled leaked-password protection; see verification notes.

## Blockers
- No external blocker prevents the implemented web/backend slice. Native runtime verification remains a release requirement.
- Legal-rule sources and financial semantics must be agreed before deadline automation/financial migration.

## Future Features
Sourced Sudanese legal workflows/deadlines; document capture/OCR; notary registers; library/citations; legal templates; grounded AI; WhatsApp; billing and reports. Core collaboration precedes these integrations.

## Acceptance Evidence
- **Current integration: 205 tests passed:** 169 mobile + 36 domain; mobile TypeScript and Expo lint passed with zero errors/warnings.
- 26 migrations replayed on PostgreSQL 18. Seven SQL suites passed; the new guard suite also passed on the linked project inside a rollback transaction.
- Android/iOS/Web exports and browser request-form validation passed. See [2026-10-01 report](verification/trial-integration-2026-10-01.md).
- The following real HTTP/offline-browser evidence belongs to the preceding foundation milestone (2026-09-30); it is not a claim that the new live trial-request flow passed:
- Authenticated PostgreSQL/RLS suite passed with rollback: isolation, roles, suspended/invited membership, creator stamps, assignments/history/revocation, idempotency, conflicts and existing-data compatibility.
- Real Auth/HTTP suite passed: office admin creates client/case; assigned lawyer and employee read them; reception cannot read internal cases; other office/platform-only owner cannot read/write legal data; retries do not duplicate; stale writes return HTTP 409.
- Browser login/shared lists passed. Offline client save showed one pending mutation; reconnect reduced it to zero; scoped database query confirmed revision 1 and normalized phone/identity.
- Android/iOS/Web Expo export passed. Bundles are not native runtime evidence.
- Temporary HTTP/browser users, offices, clients and cases cleaned up; remaining counts verified zero. Network restored, test tab closed and verification Metro stopped.
