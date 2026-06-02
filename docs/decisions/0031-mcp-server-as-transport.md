# ADR-0031: `@primitivehub/mcp-server` as the MCP transport layer

**Status:** Accepted
**Date:** 2026-06-02
**Related:** ADR-0015 (Trust Contract versioning), ADR-0018 (Context
Policy Language), ADR-0020 (verify as reference implementation),
ADR-0022 (publishing deferred to launch), ADR-0023 (phub CLI +
detector parity), ADR-0024 (SARIF + GitHub Action), ADR-0025 (active
posture + phub audit), ADR-0026 (phub.lock + drift detection),
ADR-0030 (FP resolution + AV-vendor parallel),
`docs/execution-plan.md` Gate G-D,
`packages/mcp-server/`

## Context

`@primitivehub/verify` (ADR-0020) is the reference verifier. `phub`
(ADR-0023) is the CLI surface humans use. The GitHub Action (ADR-0024)
is the CI surface. Each is a transport over Trust Contract v0.1
primitives — none reinvent trust.

**The audience missing from this list is the AI agent at runtime.**
Claude Code, Cursor, Aider, and every future agent runtime need a
programmatic way to call the same primitives without spawning a CLI
subprocess and parsing its output. The standard answer (early 2026)
is the Model Context Protocol (MCP) — a JSON-RPC wire format with
broad host support and an official TypeScript SDK.

Gate G-D in `docs/execution-plan.md` defines this surface:
- `@primitivehub/mcp-server` published to npm
- `claude mcp add primitivehub` is one line
- Three worked examples (Claude Code, Cursor, Aider)
- **Zero custom trust logic in MCP package — provable by code review**

The last criterion is load-bearing. Every prior surface added zero
trust logic (passing through the verify + phub primitives); the MCP
server MUST hold the same line. This ADR locks the discipline before
the code lands.

## Decision

### 1. Ship `packages/mcp-server/` as a pure transport layer

The package exposes four tools, each a thin wrapper over an existing
primitive:

| MCP tool | Delegates to | ADR |
|---|---|---|
| `verify_bundle` | `verifyBundle()` from `@primitivehub/verify` | 0020 |
| `scan_text` | `runScan()` from `@primitivehub/phub` | 0023 |
| `audit_workspace` | `runAudit()` from `@primitivehub/phub` | 0025 |
| `check_lock` | `runAudit()` w/ `lockMode: "check"` from `@primitivehub/phub` | 0026 |

Every tool's behavior is determined by its delegate. New verify
behaviors (e.g. v0.2 unstubbing signature verification) appear in
`verify_bundle` automatically. New scanner detectors (T3/T4/T6..T10)
appear in `scan_text` and `audit_workspace` automatically via phub's
detector registry. **Adding behavior to the primitive ratchets the MCP
server forward; no parallel code-path in this package needs to keep up.**

### 2. Three load-bearing rules

1. **Zero custom trust logic.** If a tool needs validation logic the
   delegate doesn't provide, the answer is "not yet shipped" — not
   "we'll re-implement it here." The MCP server's correctness is
   transitively the verify + phub primitives' correctness.
2. **Schema-stable tool surface.** Adding tools is additive. Renaming
   or removing a tool requires a SemVer major bump on this package.
   Tool input schemas may only grow new optional fields (not remove
   or rename existing fields) without a major bump.
3. **No state retention.** Every tool call is stateless. No caching,
   no queuing, no per-session memory. The agent's conversation is the
   only stateful context; this server is a function.

### 3. stdio is the only v0.1 transport

MCP supports stdio, SSE, and HTTP transports. v0.1 ships stdio only:
- It's the lowest-friction host integration (every MCP host supports
  it; no port allocation, no TLS, no auth surface).
- It's the only transport that runs locally by default — matches the
  "verification is always offline" property of phub + verify.
- SSE and HTTP introduce server-lifecycle concerns (port binding,
  graceful shutdown, multi-tenancy) that aren't load-bearing for v0.1.

v0.2 may add SSE / HTTP transports for browser-based agents that can't
spawn stdio child processes. The `buildServer()` programmatic export
already supports any SDK-provided transport; only the binary entry
point is stdio-specific.

### 4. The MCP SDK is a justified runtime dep

`@modelcontextprotocol/sdk` is the official TypeScript SDK for MCP.
Hand-rolling the JSON-RPC + capability-negotiation surface is not
viable — the protocol is substantial, the spec is moving, and the
SDK absorbs that complexity. Adding the dep is the right trade.

This is the first phub-stack package with a non-trivial runtime dep
(verify and phub are zero-dep + yaml). The carve-out is documented
here so future audits know it was deliberate.

### 5. Inherit ADR-0022 publish discipline

Same three-lock model (`workflow_dispatch` + `LAUNCH-CONFIRMED` input
+ `environment: launch` reviewer gate). Same launch-day playbook in
ADR-0022. The package name `@primitivehub/mcp-server` (scoped) is
chosen for brand consistency.

## Alternatives considered

1. **Hand-rolled MCP server (zero deps).** Rejected. The MCP spec
   covers capability negotiation, multiple transport types, error
   semantics; the official SDK absorbs the complexity. Hand-rolling
   would burn engineering time on protocol plumbing that the SDK
   already battle-tested.

2. **Re-implement the verify + scan logic in this package** so a
   single `npm install @primitivehub/mcp-server` is all an agent host
   needs. Rejected. Two implementations to keep in sync; bug surface
   doubles; the "MCP server is the trust authority" claim becomes
   technically true (a second implementation exists) and that's worse
   than "the MCP server is the wire format for the existing trust
   authority." The reference-implementation discipline (ADR-0020,
   ADR-0023) requires a single source.

3. **Ship `verify_before_load` in v0.1** as a composite of `check_lock`
   + `verify_bundle`. Considered. Rejected for v0.1 because the
   semantics of "refuse to load unattested content" need spec-level
   nailing-down (what counts as attestation? rekor:* lock entries
   only? registry:* too?) and that lives in ADR-0029. v0.1 exposes
   the primitives an agent needs to *build* `verify_before_load`; the
   composite ships when ADR-0029 lands.

4. **`@primitivehub/mcp` (drop `-server` suffix).** Considered.
   Rejected because `@primitivehub/mcp-client` is a v0.2+ candidate
   (a Node SDK for hosts that want a typed client wrapper); having
   `mcp-server` opens the namespace cleanly. Cost: one extra word
   in `npx @primitivehub/mcp-server`.

5. **HTTP transport in v0.1.** Considered. Rejected — adds port
   allocation, optional TLS, auth-surface decisions that need their
   own ADR. stdio is the default for every MCP host and covers the
   Gate G-D acceptance criteria (Claude Code, Cursor, Aider all
   register stdio servers).

6. **Skip the worked examples — let users copy from MCP docs.**
   Rejected. Gate G-D explicitly requires three worked examples;
   the examples are also the smoke test (they double as a manual
   integration check that the binary registers cleanly).

## Consequences

### Positive

- **Trust chain has one source.** Every surface PrimitiveHub ships
  reads from the same verify + phub primitives. An audit team can
  read those packages and inherit assurance for the CLI, the GitHub
  Action, AND the MCP server.
- **MCP server inherits future work for free.** When verify v0.2
  unstubs signature verification, `verify_bundle` improves with no
  changes to this package. When phub's detector roster expands,
  `scan_text` and `audit_workspace` surface the new detectors
  automatically.
- **`claude mcp add primitivehub` is the demo** that makes the
  paper concrete. "Your AI agent can now ask PrimitiveHub to verify
  every primitive before loading it" in one line of host config.
- **Zero-state design is testable.** Every test is a pure
  (input, output) pair. No fixtures-with-time-sensitive-state.
- **Composability with the audit/lock work.** The MCP server's
  `check_lock` + `verify_bundle` pair is the building block for
  ADR-0029's `verify_before_load` — agents can already build it
  themselves today by calling both tools in sequence.

### Negative

- **One non-trivial runtime dep** (`@modelcontextprotocol/sdk`).
  Documented + justified. The phub-stack's zero-deps narrative gets
  an asterisk; ADR-0022 publish-gating + npm provenance attestation
  mitigate supply-chain risk.
- **The discipline rules are enforced by code review** (no
  programmatic test for "this tool doesn't have custom trust logic").
  Mitigation: the rules are small enough to remember; the directory
  layout (`src/tools/*.ts` with one delegate per file) makes review
  obvious; CI dry-run + tarball-size budget catches accidental
  bundle bloat.
- **stdio-only in v0.1** leaves browser-based agents on the
  sidelines until v0.2 SSE/HTTP transports.

### Neutral

- **The "MCP gate" naming clash.** Other ecosystems use "MCP" for
  things like Apple's Mobile Connectivity Protocol. Disambiguated by
  the `primitivehub` brand prefix in every surface.
- **MCP spec is moving.** The SDK's `^1.0.0` major-version pin
  protects against minor-version drift; major SDK bumps will require
  this package's own version bump.

## Implementation

`packages/mcp-server/`:
- `bin/primitivehub-mcp.js` — shebang entry; delegates to `runStdio()`
- `src/server.ts` — `buildServer()`, `runStdio()`, tool registration
- `src/tools/verify-bundle.ts` — `verify_bundle` wrapper
- `src/tools/scan-text.ts` — `scan_text` wrapper
- `src/tools/audit-workspace.ts` — `audit_workspace` wrapper
- `src/tools/check-lock.ts` — `check_lock` wrapper
- `src/index.ts` — programmatic exports
- `examples/claude-code.json` — `~/.claude.json` snippet
- `examples/cursor-mcp.json` — `.cursor/mcp.json` snippet
- `examples/aider.conf.yml` — `~/.aider.conf.yml` snippet
- `test/tools.test.ts` — 16 in-process tool tests
- `test/server.test.ts` — 6 JSON-RPC tests via `InMemoryTransport`
- 22/22 passing

## What ships in subsequent PRs

- **ADR-0029 / `verify_before_load`** — composite tool that calls
  `check_lock` then `verify_bundle` and refuses-by-default for
  unattested content. The MCP runtime gate.
- **SSE / HTTP transports** — for browser-based agent hosts.
- **`@primitivehub/mcp-client`** — typed Node SDK for hosts that want
  to consume the MCP server without speaking JSON-RPC by hand.
- **Marketplace listings + integration testing** with each of the
  three worked-example hosts (Claude Code, Cursor, Aider). The
  examples in this PR are config snippets; a follow-up PR adds CI
  that spawns each host against the local server.

## References

- `packages/mcp-server/` — the implementation
- `packages/mcp-server/examples/` — host configs
- `docs/execution-plan.md` Gate G-D — Acceptance criteria
- ADR-0020 — verify as reference implementation
- ADR-0023 — phub CLI + detector parity
- ADR-0025 — Active surfaces + phub audit
- ADR-0026 — phub.lock + drift detection
- ADR-0022 — publishing deferred to launch
- [Model Context Protocol](https://modelcontextprotocol.io/) — protocol spec
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — official SDK
