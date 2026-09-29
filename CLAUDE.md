# MAKTABI — Claude Code Operating Instructions

Read `AI_COLLABORATION.md` and `README.md` before substantial work.

## AI Council policy

Maktabi uses two complementary council mechanisms; do not confuse their jobs.

### 1. hex/claude-council — engineering cross-check
Use the Claude Code plugin command `/claude-council:ask` for:
- architecture decisions with meaningful trade-offs;
- security/RLS/auth reviews;
- debugging dead ends after normal investigation;
- database/offline-sync design;
- independent review of critical diffs.

Prefer Codex as the independent external engineering seat when its CLI is available.

Examples:
```
/claude-council:status
/claude-council:ask --providers=codex --roles=security --file=AI_COLLABORATION.md "Review the proposed RLS design. Find cross-tenant failure modes."
/claude-council:ask --providers=codex --debate --agents "Pressure-test this architecture before implementation."
```

Do NOT send secrets, .env files, credentials, client legal documents, or production data to external providers.

### 2. TorpedoD/claude-council — decision council
This is a separate Skill for high-stakes product/strategy decisions. Its own specification says it is not for routine coding/debugging. Invoke it only when the owner explicitly requests a council/stress-test or when a genuinely consequential, non-obvious decision needs multiple reasoning lenses.

## Normal execution path
Council is not a substitute for repository inspection. For routine implementation:
1. inspect the relevant code;
2. implement the smallest coherent slice;
3. run tests/typecheck/lint;
4. report evidence;
5. request independent review for critical work per `AI_COLLABORATION.md`.

## Critical gate
For auth, RLS, migrations, financial records, offline sync, document access, subscriptions, legal-AI privacy, destructive changes, or production security:
- implementation by one agent;
- independent review by another;
- unresolved BLOCKER/HIGH findings prevent acceptance.

Council output is advisory evidence, not authority. Repository tests, security invariants, owner requirements, and reproducible evidence win over model consensus.
