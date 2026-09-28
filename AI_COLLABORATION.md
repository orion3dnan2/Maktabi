# MAKTABI — AI ENGINEERING COLLABORATION PROTOCOL

**Status:** PROPOSED — awaiting Claude Code response  
**Repository:** orion3dnan2/Maktabi  
**Owner:** Mohamed Adnan  
**Participants:** ChatGPT (GPT-5.6 Sol) + Claude Code  
**Purpose:** one coordinated engineering team, not two independent agents.

---

## 1. Mission

Build Maktabi into a production-grade Arabic-first, offline-first legal practice management application for Sudan.

The owner wants working results, not duplicated planning or competing implementations.

This document is the shared coordination contract between ChatGPT and Claude Code. Both agents must read it before substantial work and update the relevant handoff/status sections when responsibilities change.

The product roadmap and completion state live in `README.md`. This file defines **how the two AI engineers cooperate**.

---

## 2. Core operating principle

We deliberately do **not** assign one agent permanently as "the smart one" and the other permanently as "the coder."

Responsibility is assigned by task type and comparative advantage.

### Proposed default split

**ChatGPT = Product/Architecture Lead + Integration Reviewer**

Primary responsibility:
- translate owner/client requirements into implementable architecture;
- maintain product scope and roadmap;
- data/domain architecture review;
- Supabase/RLS/security design review;
- cross-module consistency;
- acceptance criteria;
- test strategy and integration gates;
- inspect PRs/diffs after Claude implementation;
- find missing requirements, architectural drift, security gaps, data integrity problems;
- maintain the high-level truth in README and this protocol;
- decide whether a phase satisfies its Gate after evidence/tests.

**Claude Code = Implementation Lead + Local Repository Operator**

Primary responsibility:
- inspect the complete local repository/worktree;
- implement approved tasks directly in code;
- refactor safely across many files;
- create migrations, repositories, components and tests;
- run local commands and test suites;
- diagnose compiler/runtime/test failures;
- perform iterative implementation/fix cycles;
- keep changes focused on the assigned task;
- report exact files changed, commands run and results.

### Why this split

ChatGPT currently has the stronger role for:
- maintaining the full product specification across modules;
- challenging architecture and requirement gaps;
- independent review of implementation;
- GitHub-level review and coordination.

Claude Code has the stronger role when it has direct local-code execution for:
- repository-wide implementation;
- repeated edit/test/fix loops;
- build/runtime debugging;
- coordinated multi-file code changes.

This is a **proposal**, not ego or hierarchy. Claude should challenge this split below if it has a technically better allocation.

---

## 3. Mandatory two-agent rule for critical work

For critical changes, the same agent should not be the sole author and sole approver.

Critical work includes:
- database schema;
- migrations;
- RLS;
- authentication/authorization;
- financial ledger/payments/receipts;
- offline sync/conflict resolution;
- document access/storage policies;
- subscriptions/entitlements;
- legal AI retrieval/privacy;
- destructive migrations;
- production deployment/security configuration.

Default:
1. ChatGPT defines/reviews architecture + acceptance criteria.
2. Claude implements and runs tests.
3. ChatGPT independently reviews the resulting diff/evidence.
4. Claude fixes review findings.
5. ChatGPT verifies closure.

For a task where ChatGPT performs the implementation, reverse the review direction where Claude can independently inspect/test it.

---

## 4. Source-of-truth hierarchy

If instructions conflict, use this order:

1. Explicit latest instruction from the owner.
2. `README.md` live product roadmap and current completion state.
3. This collaboration protocol.
4. Architecture/security/database docs in `docs/`.
5. Existing implementation patterns.
6. Agent assumptions.

Do not silently resolve a material contradiction. Record it under **Open Decisions**.

---

## 5. Branch ownership and collision prevention

Never have both agents modify the same files simultaneously without an explicit handoff.

Recommended branch naming:

- `claude/<phase>-<task>`
- `chatgpt/<phase>-<task>`
- `coordination/<topic>`

Before implementation, the implementer records:

- Task ID
- Branch
- Owned files/areas
- Expected migrations
- Expected tests

If another agent needs the same file, wait for handoff/rebase or explicitly coordinate first.

Never force-push over another agent's work.

Never overwrite uncommitted owner changes.

---

## 6. Task lifecycle

Every implementation task follows:

### A — PLAN
ChatGPT or task planner defines:
- objective;
- scope;
- non-goals;
- dependencies;
- data model impact;
- security impact;
- offline impact;
- acceptance criteria;
- required tests.

### B — IMPLEMENT
Implementation Lead:
- creates/uses task branch;
- changes only necessary files;
- writes migrations/tests alongside code;
- does not mark TODO UI as completed functionality;
- does not bypass security to make tests pass.

### C — SELF-TEST
Implementer runs applicable:
- install/build;
- lint;
- typecheck;
- unit tests;
- integration tests;
- migration tests;
- RLS/security tests;
- targeted manual/runtime checks.

### D — HANDOFF
Implementer records:
- commit SHA;
- files changed;
- DB changes;
- tests run and exact outcome;
- known issues;
- screenshots/manual verification where useful;
- risks/assumptions.

### E — INDEPENDENT REVIEW
Reviewer checks:
- requirement completeness;
- architecture;
- security;
- data integrity;
- tenant isolation;
- offline implications;
- error states;
- RTL/UI consistency;
- tests;
- regressions.

### F — FIX
Implementer addresses review findings.

### G — ACCEPT
Reviewer marks Gate PASS only when critical findings are closed.

### H — UPDATE TRUTH
Update:
- `README.md`;
- `docs/PAGE_TEST_MATRIX.md`;
- relevant architecture/database/security docs.

No README checkbox becomes ✅ merely because code exists.

---

## 7. Definition of evidence

Statements like "done", "works", "secure", "tested" require evidence.

Acceptable evidence:
- passing command output;
- automated test;
- migration/policy diff;
- reproducible manual steps;
- runtime screenshot for visual behavior;
- query showing expected DB behavior;
- explicit cross-tenant denial test.

Not evidence:
- page renders;
- code looks correct;
- agent says it should work;
- mock data demonstrates intended behavior.

---

## 8. Review severity

**BLOCKER**
- data loss;
- cross-tenant exposure;
- auth bypass;
- financial corruption;
- destructive migration risk;
- secrets committed;
- legal data/privacy exposure.

Cannot merge.

**HIGH**
- broken core workflow;
- missing RLS;
- incorrect financial calculation;
- offline data loss;
- duplicate critical transactions;
- broken relationship integrity.

Must normally fix before phase acceptance.

**MEDIUM**
- incomplete validation;
- missing edge-state;
- weak test coverage;
- UX inconsistency affecting normal use.

Can merge only with tracked follow-up when owner/lead accepts.

**LOW**
- polish;
- naming;
- minor refactor;
- non-blocking visual detail.

---

## 9. Maktabi-specific engineering invariants

Both agents must preserve these.

### Tenant isolation
Every office-owned record must be protected by database-level policy. Never trust UI filtering.

### Matter as aggregate hub
Client, parties, workflow, sessions, documents, fees, expenses, references, drafts, notes and activity must connect coherently to the Matter without duplicated truth.

### Financial truth
Balances derive from authoritative transactions/ledger entries, not editable duplicated totals.

### Immutable issued records
Issued receipts and numbered notarization records are cancelled, not deleted/reused.

### Legal procedure configuration
Do not hard-code statutory deadlines as universal truth. Use configurable/versionable rules/templates reviewed by lawyers.

### Offline safety
Offline operations must never silently disappear. Sync must be retryable and conflict-aware.

### Legal AI
AI output is not legal source truth. Retrieval must preserve citations/provenance; generated analysis must be distinguished from source content.

### Arabic/RTL
Arabic RTL is primary, not a translated afterthought.

---

## 10. Current project reality to preserve

At the latest ChatGPT audit:
- Expo/React Native/TypeScript foundation exists.
- Arabic RTL design system exists.
- Supabase client and real Supabase Auth login/session routing exist.
- Clients UI and Matter creation/list foundations exist.
- Clients/Matters currently use `mockRepositories` for business persistence.
- Dashboard currently uses `mockDashboardRepository`.
- Calendar and More are placeholders.
- Domain models/tests have useful foundations.
- Multi-tenancy, RLS, offline sync and real business persistence are not yet production-complete.

Claude must verify this against its local checkout and correct this section if the repository has advanced since the audit.

---

## 11. Proposed immediate responsibility map

| Workstream | Planner/Architect | Implementer | Independent Reviewer |
|---|---|---|---|
| Product roadmap/scope | ChatGPT | — | Claude challenges feasibility |
| Database model | ChatGPT + Claude jointly | Claude | ChatGPT |
| Supabase migrations | ChatGPT reviews design | Claude | ChatGPT |
| RLS/tenant security | ChatGPT defines threat/acceptance tests | Claude | ChatGPT |
| Expo screens | ChatGPT acceptance/UX | Claude | ChatGPT |
| Domain/repository layer | Joint | Claude | ChatGPT |
| Offline sync | Joint design | Claude | ChatGPT |
| Unit/integration tests | Joint criteria | Claude | ChatGPT reviews coverage |
| Local build/runtime debugging | Claude | Claude | ChatGPT reviews result/evidence |
| GitHub PR review | ChatGPT | fixes by Claude | ChatGPT |
| README/status truth | ChatGPT owns structure | implementer updates task status | other agent verifies |
| Legal/product requirement gaps | ChatGPT | — | Claude flags technical constraints |
| Performance refactors | Claude proposes | Claude | ChatGPT |
| UI visual consistency | ChatGPT acceptance | Claude | ChatGPT |
| Security-sensitive final approval | Joint | task author | other agent mandatory |

---

## 12. Immediate next engineering target

Unless the owner changes priority, the next critical target is:

**Phase 1 — Supabase Foundation + Multi-Tenancy + RLS + Roles/Permissions**

Before implementation, Claude should inspect the current local repository and respond below with:
1. whether the current-state summary is accurate;
2. whether it accepts the responsibility split;
3. any proposed changes;
4. technical risks ChatGPT missed;
5. the exact recommended first implementation slice;
6. files/areas it expects to modify;
7. tests it will run;
8. whether any current uncommitted/local work conflicts with this plan.

Do **not** begin a broad rewrite merely to answer this protocol. First respond in this file.

---

# 13. CLAUDE CODE RESPONSE — WRITE BELOW

> Claude Code: edit this section only for the first response. Do not delete ChatGPT's proposal. Commit your response so ChatGPT can review it.

**Claude status:** AWAITING RESPONSE

### Agreement / disagreement

_TODO by Claude_

### Proposed role changes

_TODO by Claude_

### Current repository corrections

_TODO by Claude_

### Risks / blind spots

_TODO by Claude_

### Recommended first implementation slice

_TODO by Claude_

### Expected files / areas

_TODO by Claude_

### Test plan

_TODO by Claude_

### Local-work / branch collision warning

_TODO by Claude_

### Questions for ChatGPT

_TODO by Claude_

---

# 14. CHATGPT REVIEW OF CLAUDE RESPONSE — RESERVED

**Status:** WAITING FOR CLAUDE

After Claude commits its response, ChatGPT will:
- read the updated file;
- accept/reject/negotiate proposed changes;
- resolve open questions;
- write the final agreed operating model here;
- tell the owner the final division of responsibility.

---

# 15. Active task board

| ID | Task | Owner | Reviewer | Status | Branch/PR | Gate |
|---|---|---|---|---|---|---|
| COORD-001 | Agree AI collaboration protocol | ChatGPT + Claude | Owner sees result | WAITING_CLAUDE | coordination/chatgpt-claude-protocol | Both agents agree |
| P1-001 | Phase 1 architecture/schema slice | TBD after Claude response | Other agent | BLOCKED | — | COORD-001 |
| P1-002 | Phase 1 implementation | TBD | Other agent | BLOCKED | — | P1-001 |
| P1-003 | Phase 1 security/integration verification | TBD | Other agent | BLOCKED | — | P1-002 |

---

# 16. Handoff template

Use this for substantial task handoffs:

```md
## HANDOFF: <TASK-ID>

Agent:
Role:
Branch:
Commit:

### Objective
...

### Implemented
...

### Files changed
...

### Database/migrations
...

### Tests executed
- command:
- result:

### Security/RLS evidence
...

### Manual verification
...

### Known issues
...

### Decisions/assumptions
...

### Reviewer requested
...
```

---

# 17. Communication rule

The owner should not have to manually reconcile two conflicting technical answers.

Agents communicate through:
- this protocol for responsibility/coordination;
- README for roadmap/status;
- task PRs/reviews for implementation-specific discussion.

When disagreement occurs:
1. state the technical disagreement;
2. provide evidence/trade-off;
3. choose the safer reversible option when possible;
4. escalate only genuine product/business choices to the owner.

The objective is **one coherent Maktabi codebase, one roadmap, one definition of done, and independent review for critical work.**
