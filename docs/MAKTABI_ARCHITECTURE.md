# Maktabi architecture

Product authority: [MAKTABI_MASTER_VISION.md](MAKTABI_MASTER_VISION.md). This supersedes any older cloud-only recommendation. Case-centric, Sudan-first, Arabic RTL, mobile-first.

## Current architecture
Expo 57 / React Native / TypeScript / Expo Router. Supabase Auth uses phone-derived internal email and a server-only manage-users function. Profiles select one office; office_members is authoritative for staff access. Platform owners are recorded separately. Clients, matters and assignment history use an encrypted operational store and Supabase sync. Appointments, stages, deadlines, notes, templates and events use the server workflow repository and currently require connectivity. Finance/documents/settings remain in password-encrypted per-user JSON vaults with empty production initialization and session-bound repository writes. All 27 applied migrations (including authorized smoke-fixture cleanup) are present and replayed on a clean PostgreSQL 18 test database. Team/account management is online. Greeting uses the authenticated name. Public office requests remain pending until platform-owner approval; pending offices cannot access legal records or write login audit events.

## Target and data architecture
UI → hooks → repositories → encrypted local operational database + durable outbox → sync service → Supabase PostgreSQL/RLS → other devices. Matter is central; clients link through primary client and additional parties. Preserve domain types and existing screens. UUID entity IDs are created before sync. Server revision and updated_at provide compare-and-swap, not blanket last-write-wins.

## Offline architecture
Native SQLite stores encrypted records and outbox operations atomically; device keys live in SecureStore, independent of the login password. Partition by office AND authenticated user so one account cannot reuse another account's broader cached permissions. Web uses IndexedDB and Web Crypto; web device keys remain browser-local and do not provide the OS keystore guarantees of native SecureStore. Do not claim security against browser-origin compromise. Preserve the legacy vault separately; never delete it on cloud migration or password reset.

## Sync architecture
Clients, matters and assignments are the first slice. Persist local mutation and queue entry in one transaction before sending. Replay dependent clients before matters, then assignments. Server mutation IDs are idempotent; network loss after commit must not cause duplicates. Compare base revision inside a row lock. Version mismatch creates an explicit conflict; forbidden/invalid operations are marked failed and not silently retried. A conflict blocks subsequent operations for that entity. Pull authorized server rows and retain pending local drafts. Reconcile removed access, and never republish cached rows from another user. Sync on foreground, refresh and bounded periodic retry. Show pending/failed/conflict counts. Financial/legal irreversible changes later require purpose-built append/reversal commands.

## Multi-tenant architecture
office_id on office data and composite same-office foreign keys. office_members is membership state with active/suspended/invited values. Profiles retain the currently selected office for backward-compatible login; a synchronization trigger adapts current team management. No platform-owner bypass for legal records. Office switching is a separate future feature.

## Permissions model
Central role-to-capability map in mobile and matching server RLS. Admin manages assignment/team/settings; lawyers access assigned/created cases and their clients; employees collaborate within the office; reception handles clients/contact details without internal legal cases. Client portal uses an explicit projection. See PERMISSION_MATRIX.md. Never trust user-editable JWT metadata.

## Security model
RLS and live membership validation on every server operation. Security-invoker public mutation RPCs; narrow private definer helpers validate membership and apply admin assignment commands/history atomically. Direct authenticated assignment ledger writes are revoked. Immutable tenant/creator IDs and audit triggers. Publishable key in frontend, service role only on trusted server. Documents later use private Storage policies and upload queues. Authenticated user boundaries persist into encrypted offline storage. Offline access requires previously verified membership and a bounded authorization lease; revocation can only be learned when online. The initial lease is 24 hours, never grants new permissions, and queued writes are always reauthorized by the server. Auth network refresh failure can use that lease; permission denial cannot. Signout invalidates the lease. Explicit denial locks the shared repository and invalidates cached access. Encrypted drafts/outbox and legacy ciphertext remain preserved for later authorized recovery, without exposing records through the denied session.

## Module relationships
Office → membership → clients → matters → assignments → stages/hearings/deadlines/tasks/documents/notes/financial ledgers. Client statements aggregate matter ledgers. Dashboard aggregates authoritative entities. Platform statistics never read legal case content without explicit office membership. Legal rules, templates, plans and future granular permissions are configuration rather than screen constants.

## Migration strategy
Additive schema changes, no drops of office work. Export schema/type snapshots. Existing local data is not auto-uploaded because fixtures and real data may coexist. Explicit admin import must preview and select records, create deterministic per-office source mappings, reject duplicate references requiring reconciliation, retain original datasets, and record results. Local workflow/financial/document transfer is separate from a clients/cases import. Existing local functionality remains clearly labeled until its typed sync adapter is implemented and tested.

## Architecture drift and decisions
- Reject a cloud-only repository replacement: the 2026-09-30 Master Vision requires local creation/edit/read and sync.
- Replace production fixture initialization with empty operational data, retain fixtures for tests.
- Do not key the new shared-data database to the user password. Legacy vaults require their original credentials for recovery only.
- Do not mirror the whole office as one overwriteable JSON blob; first-slice records and outbox are independently versioned.
- Scope of this milestone is foundation + clients/cases/assignments. Full finance, Storage, legal deadline automation, AI, WhatsApp and billing remain later phases.
- Revision conflicts use SQLSTATE PT409 / HTTP 409. Do not raise custom 40001 for application conflicts: [Supabase documents indefinite PostgREST retries](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). This was reproduced through real HTTP and corrected in an additive migration.
- Client phone numbers follow the existing Sudan-only schema and are normalized before enqueueing. Optional national IDs map to id_type=national_id; existing passports/other identities are preserved and cannot be silently replaced by the national-ID form. Login retains its existing phone normalization.
- Existing database case types and expert-party roles are represented in the domain instead of being downgraded to OTHER. Structured details outside the string-field editor are preserved on partial updates.
