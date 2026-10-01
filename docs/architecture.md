# Architecture

The current architecture is maintained in [MAKTABI_ARCHITECTURE.md](MAKTABI_ARCHITECTURE.md). Implementation state is in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).

Updated 2026-10-01: production clients, cases and assignments use encrypted offline storage with a durable outbox and Supabase/RLS synchronization. Appointments, stages, deadlines, notes, templates and activity use Supabase directly and currently need a connection. Finance, documents and office settings remain in the user's encrypted vault, with legacy preservation and verified import mappings.

The old Batch 1/2 mock adapters are test fixtures, not production data sources. See [integration verification](verification/trial-integration-2026-10-01.md) for current evidence and release limits.
