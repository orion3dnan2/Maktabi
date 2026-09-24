# Architecture

The mobile UI depends on domain repository interfaces, never directly on an HTTP API. Batch 1 injects an in-memory mock repository. The intended evolution is:

`React Native UI → domain services → repositories → local SQLite → sync engine → API → PostgreSQL`

Future local adapters should use `expo-sqlite`; authentication secrets should use platform secure storage. Tenant/office identifiers are present on aggregate roots to prepare for isolation, but tenant enforcement, encryption, RBAC enforcement, audit logging, backup, and synchronization are **not implemented** and must not be represented as complete.

Financial concepts remain separate: fee payments, third-party expenses, and client-trust entries. Receipts are cancelled rather than deleted, and replacement receipts receive a new identifier and number.
