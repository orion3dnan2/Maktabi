# Multi-tenant implementation — 2026-09-30

## Baseline and verified database
The reviewed application uses Supabase phone/password authentication and profiles.office_id for account routing. Office work uses a per-user encrypted vault with local mock-backed repositories. Those repositories seed fictional clients and matters. Platform administration and team accounts already use Supabase.

The linked project was inspected through database catalog queries (not inferred from the incomplete migration directory). Existing tables: offices, profiles, clients, matters, matter_parties, appointments, tasks, documents, payments, matter_notes, matter_events, matter_stages, matter_deadlines, procedure_templates, audit_logs. Existing matter_progress is a view. Existing tenant foreign keys, immutable-field triggers, audit triggers and role guards must be preserved. Historical base DDL predates the migrations checked into this repository; catalog snapshots are stored in docs/database.

## Target architecture
UI → hooks → typed repositories → encrypted operational store/outbox → sync → Supabase with RLS. Office is the tenant. Identity remains in profiles; office_members records membership independently, with active/suspended/invited status. Existing profiles.office_id selects the current office to preserve login and team management. Membership synchronization keeps legacy administrative actions compatible. Additional memberships are represented in the database; an office-switching UI is a later step.

Shared clients and matters use an encrypted local operational store and durable mutation outbox, synchronized to Supabase. They never fall back to fixtures. The newer MAKTABI_MASTER_VISION.md supersedes the earlier cache-only suggestion. UUIDs are generated once per form for retry-safe writes. Matter and party writes are transactional. Assignment changes retain historical rows. Platform ownership grants management of offices as SaaS entities, not access to legal records.

## Database changes and RLS strategy
Add office_members and matter_assignments; reuse all valid existing tables. Membership lookup validates the office status and active identity at request time, without trusting editable JWT metadata. Clients are visible to admins/employees/reception, and to lawyers through accessible cases or their own creation. Matters are visible to admins/employees and assigned/creating lawyers. Reception has no internal case access. Only admins manage assignments. Same-office composite foreign keys prevent forged client, case and assignee relationships. Existing actor stamping and immutable fields remain enforced.

## Migration strategy
No local data is deleted or silently imported. Preserve legacy vaults and backups. Explicit admin import previews local clients/cases; use a per-office/source mapping and stable import IDs, write transactionally, log outcomes, and retain original local workflows/finance/documents. Financial/document migration needs separate validation before transfer; a clients/cases import must never claim those modules were transferred. Duplicate case references must stop and request reconciliation rather than overwrite unrelated records. Fixture data remains test-only and new production workspaces start empty.

## Phases
1. Membership, permissions, shared clients/matters and assignments; database isolation tests and repository tests. First proof: admin creates a client/case, assigns a lawyer, another session sees it, another office cannot read or write it.
2. Explicit legacy import and demo removal validation.
3. Transfer appointments, tasks, notes, procedures, private Storage documents, finance, settings, notifications and audit services individually. Retain local functionality with clearly labeled scope until each module is transferred and tested.
4. Correct dashboard calculations using shared authoritative modules; actual hearings, tasks, deadlines, overdue installments and workload.
5. Platform overview and office details; subscriptions/billing later.

## Completed items
- Baseline and actual schema/policy/trigger inspection.
- Existing name greeting fix retained.
- Membership, shared clients/cases/parties/assignments, encrypted operational stores and sync implemented; nine additive migrations applied.
- 122 tests, authenticated SQL/RLS suite, real Auth/HTTP collaboration, and browser offline-save/reconnect proof passed. See IMPLEMENTATION_ROADMAP.md and verification/foundation.md for exact evidence and native release gates.

## Remaining items
- Native acceptance and genuine-data import/unlock validation remain release gates.
- Core phases 3–5 are not complete.

## Risks and release gates
- Existing local datasets may contain both fixtures and genuine work. Never guess which to migrate or delete them.
- Local finance/documents/workflows remain per-device during staged migration. Do not describe them as shared.
- Existing local vault unlock depends on the old password. A reset must not affect shared cloud clients/cases; legacy vault recovery must preserve original ciphertext.
- Verify RLS as authenticated roles and explicit direct queries, including suspended/invited users and platform owner. Service-role execution alone is not isolation evidence.
- Fresh-database reproduction needs historical schema reconstruction in addition to new additive migrations.
- No service role or credentials may be placed in mobile source or committed documents.

## Reference
Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
