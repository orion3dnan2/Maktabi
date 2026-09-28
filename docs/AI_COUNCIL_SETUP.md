# Maktabi AI Council Setup

Verified 2026-09-29.

Maktabi should use **hex/claude-council** as the coding council and keep **TorpedoD/claude-council** as a separate decision skill.

## Why two councils

**hex/claude-council** is purpose-built for Claude Code engineering cross-checks. It can query multiple coding/model providers and supports Codex CLI using existing subscription authentication when the `codex` executable is on PATH. It also supports roles, debate, file context, agents, async jobs, and a status command.

**TorpedoD/claude-council** is a five-lens decision framework (Red Team, First Principles, Expansionist, Outsider, Executor). Its SKILL.md explicitly says not to use it for factual questions, routine coding help, debugging, or single-domain technical questions. It is useful for consequential product/strategy decisions, not as Maktabi's default coding orchestrator.

They can coexist because the Hex plugin uses namespaced commands such as `/claude-council:ask`, while the Torpedo skill uses `/claude-council`.

## Install on the Windows PC that runs Claude Code

### A. Hex engineering council (recommended default)

Inside Claude Code:

```
/plugin marketplace add hex/claude-marketplace
/plugin install claude-council
/claude-council:status
```

For the intended Claude + Codex workflow, install/login to Codex CLI on the same PC and make sure `codex` is on PATH. The current Hex release auto-discovers the Codex CLI and prefers the CLI provider over the OpenAI API sibling when both are configured.

After that, verify:

```
/claude-council:status
/claude-council:ask --providers=codex "Read CLAUDE.md and AI_COLLABORATION.md. Identify the highest-risk assumption in the current implementation plan."
```

### B. Torpedo decision skill

From PowerShell:

```powershell
npx skills add TorpedoD/claude-council
```

Restart Claude Code, then verify:

```
/claude-council
```

Its journal feature requires `jq`. If `jq` is absent, install it before relying on journal/meta-analysis.

## Maktabi operating pattern

Routine coding stays with Claude Code and the repository workflow. Use Hex + Codex for independent engineering review at important gates. Use Torpedo only for high-stakes, non-obvious decisions.

Recommended critical review:

```
/claude-council:ask --providers=codex --roles=security --debate --agents --file=AI_COLLABORATION.md "Review the current uncommitted diff against Maktabi's invariants. Focus on tenant isolation, auth/RLS bypasses, data integrity, destructive migration risk, and missing tests. Return BLOCKER/HIGH/MEDIUM/LOW findings with file evidence."
```

## Security rule

Never include secrets, `.env`, API/service-role keys, production database dumps, private legal documents, client PII, or credentials in council prompts. External council providers receive the context sent to them.

## Source projects

- Hex: https://github.com/hex/claude-council
- TorpedoD: https://github.com/TorpedoD/claude-council
