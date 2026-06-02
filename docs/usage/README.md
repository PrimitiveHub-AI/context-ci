# PrimitiveHub — User Documentation

> **Audience:** developers, security teams, and AI-agent runtimes
> consuming PrimitiveHub today.
> **Status:** v0.1 (Trust Contract v0.1, Context CI Top 10 v0.1,
> Context Policy v0.1).
> **Source of truth.** These pages are authoritative for end-user
> behavior; specs (`docs/*-v0.1.md`) are authoritative for wire
> formats; ADRs (`docs/decisions/*.md`) are authoritative for
> rationale.

---

## What is PrimitiveHub?

PrimitiveHub is a **Context Firewall for AI agents** — a control
plane that verifies, governs, attests, and gates every piece of
context an AI agent loads (instructions, skills, rules, MCP configs,
`AGENTS.md`, `CLAUDE.md`, anything).

The category is **Context CI**. The standard is the **Trust Contract**.
The threat taxonomy is the **Context CI Top 10**. The artifacts in
this documentation — CLI, library, GitHub Action, MCP server — are
**transports over the same contract**. None of them reinvents trust.

If you're trying to:

| Goal | Read |
|---|---|
| Scan an `AGENTS.md` / `CLAUDE.md` / `.cursorrules` once | [phub CLI § scan](./02-phub-cli.md#scan) |
| Discover + scan every context artifact in a project | [phub CLI § audit](./02-phub-cli.md#audit) |
| Suppress a false-positive cleanly + auditably | [Context Policy](./03-context-policy.md) |
| Pin every context artifact's digest + detect drift | [phub.lock](./04-phub-lock.md) |
| Run Context CI on every PR via GitHub Code Scanning | [GitHub Action](./05-github-action.md) |
| Expose verification to Claude Code / Cursor / Aider | [MCP server](./06-mcp-server.md) |
| Verify a Trust Bundle programmatically (Node, browser) | [verify library](./07-verify-library.md) |
| Wire all of the above together for a real project | [Recipes](./08-recipes.md) |
| Diagnose a confusing error | [Troubleshooting](./09-troubleshooting.md) |

---

## Pages

1. [Getting started](./01-getting-started.md) — install pre-launch
   from the monorepo + post-launch via npm.
2. [`phub` CLI](./02-phub-cli.md) — `scan` / `verify` / `init` /
   `audit` complete reference.
3. [Context Policy Language](./03-context-policy.md) — the
   `.primitivehub/policy.yaml` spec applied: per-file allows,
   severity overrides, glob matching, the FP-ledger discipline.
4. [`phub.lock`](./04-phub-lock.md) — the canonical lockfile for
   AI cognition, drift detection, the `--check-lock` /
   `--update-lock` / `--lock-only` workflow.
5. [GitHub Action](./05-github-action.md) — `primitivehub/phub-scan`
   composite Action. SARIF upload to Code Scanning, gating PRs.
6. [`@primitivehub/mcp-server`](./06-mcp-server.md) — Model Context
   Protocol server. `verify_bundle`, `scan_text`,
   `audit_workspace`, `check_lock` exposed to AI agents. Claude
   Code / Cursor / Aider integration.
7. [`@primitivehub/verify`](./07-verify-library.md) — the verifier
   reference implementation as an embeddable Node/browser library.
8. [Recipes](./08-recipes.md) — end-to-end workflows: a CI-gated
   project, a Claude Code workspace, a runtime-checking agent, an
   FP triage cycle.
9. [Troubleshooting](./09-troubleshooting.md) — every error message
   the v0.1 surface emits + how to fix it.

---

## Pre-launch posture

Per [ADR-0022](../decisions/0022-publishing-deferred-to-launch.md) the
npm packages (`@primitivehub/verify`, `@primitivehub/phub`,
`@primitivehub/mcp-server`) are **not yet on the public npm
registry**. Every page that mentions `npx @primitivehub/...` also
documents the **monorepo equivalent** using local builds + absolute
paths. Once the launch publish workflow fires, all `npx` examples
work without modification.

## Versioning

- **Trust Contract v0.1** — wire format. See [`docs/trust-contract-v0.1.md`](../trust-contract-v0.1.md).
- **Context CI Top 10 v0.1** — threat taxonomy + stable CCI-NNN
  IDs. See [`docs/context-ci-top-10-v0.1.md`](../context-ci-top-10-v0.1.md).
- **Context Policy Language v0.1** — policy file format. See
  [`docs/context-policy-v0.1.md`](../context-policy-v0.1.md).
- **phub.lock v0.1** — lockfile schema. See [ADR-0026](../decisions/0026-phub-lock-format-and-drift-detection.md).

Versioning + deprecation per [ADR-0015](../decisions/0015-trust-contract-versioning.md):
SemVer alignment, 12-month deprecation windows, conformance suites
as the executable contracts ([ADR-0021](../decisions/0021-conformance-suite-as-executable-contract.md)).

## License + provenance

Every published package is MIT-licensed. Launch-day publishes carry
[npm provenance attestations](https://docs.npmjs.com/generating-provenance-statements)
via Trusted Publishing.

## Reading order

If this is your first encounter:

1. [Getting started](./01-getting-started.md) — make the CLI work locally.
2. [`phub` CLI § scan](./02-phub-cli.md#scan) — scan one file.
3. [`phub` CLI § audit](./02-phub-cli.md#audit) — discover everything.
4. [Recipes § "A CI-gated project"](./08-recipes.md#a-ci-gated-project) — wire CI.
5. Branch out from there based on what you need.

If you're integrating an AI agent runtime: jump to [`@primitivehub/mcp-server`](./06-mcp-server.md).
