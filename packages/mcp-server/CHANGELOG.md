# Changelog

All notable changes to `@primitivehub/mcp-server` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version tracks Trust Contract spec version (for `verify_bundle`) and
Context CI Top 10 version (for `scan_text` / `audit_workspace`);
`0.1.x` of this package is conformant to both v0.1.

## [0.1.5] — 2026-10-17

**Security (P0) — `audit_workspace` fails closed on an incomplete walk.**
Requires `@primitivehub/phub@^0.1.6`.

### Fixed
- **PH-20261017-01 (P0) — incomplete-audit bypass.** `audit_workspace` returned
  `isError:false` / `scanClean:true` on a truncated walk (e.g. `max_files:1`
  with a malicious file past the cap) because it trusted `runAudit`'s exitCode
  (findings/drift only). It now consumes phub's shared `auditCoverage()`
  contract: `isError` is set and the payload surfaces `coverageComplete` +
  `coverage` whenever the walk didn't examine the whole tree. An agent can no
  longer read a clean verdict from an audit that didn't look at everything.

## [0.1.4] — 2026-10-16

**Security hardening (adversarial red-team, 2026-10-16).** Requires
`@primitivehub/phub@^0.1.4` + `@primitivehub/verify@^0.1.2`.

### Fixed
- **R14 — `scan_text` fail-safe on unknown detector.** An unknown
  `detectors` id previously ran zero detectors and returned a clean,
  non-error result. The tool now surfaces `UnknownDetectorError` as
  `isError` instead of reporting a zero-detector scan as clean.

### Changed
- Inherits phub@0.1.4's red-team fixes end-to-end: `verify_before_load`
  carries the new posture-tier `PATH_UNASSESSED` reason (R05) and the
  hardened `--require-attestation` semantics (R01); `audit_workspace`
  inherits the truncated-audit fail-closed behavior (R04).

## [0.1.3] — 2026-10-16

**Security hardening (external assessment PH-SEC-003).** Requires
`@primitivehub/phub@^0.1.3` + `@primitivehub/verify@^0.1.2`.

### Changed
- **Honest scope for `verify_before_load` (PH-SEC-003):** documented as an
  **opt-in verification API** — registering the MCP server does NOT
  interpose on agent file reads; real enforcement needs the host to mediate
  reads. Removed the "every agent MUST consult before reading" over-claim.
- Inherits verify's fail-closed `valid` + the `inspected` field; the
  `scan_text` doc now states all ten detectors (CCI-001…010) run.

## [0.1.1] — 2026-10-04

Tracks `@primitivehub/phub@0.1.1`. No tool code changed — `verify_before_load`
shipped in 0.1.0 and remains a pure transport (ADR-0031).

### Changed
- **`verify_before_load` now reports a `tier` on every reason** — `block`
  (tamper / drift / live scanner finding / demanded-but-absent
  attestation) vs `posture` (unsealed). Inherited automatically from
  `verifyBeforeLoad` in `@primitivehub/phub`; agents can branch on the
  low-FP signal, not just the `safe` boolean. Requires
  `@primitivehub/phub@^0.1.1`.
- **README** now documents the shipped `verify_before_load` tool (it was
  still marked "planned") and fixes its ADR-0029 link.

## [0.1.0] — 2026-07-21

The v0.1 launch release — a pure transport layer over `@primitivehub/verify`
and `@primitivehub/phub` (ADR-0031). Five tools; published to npm at launch
([ADR-0045](../../docs/decisions/0045-product-first-public-launch-and-distribution-repo.md),
product-first).

### Added (PR 5.7.5 — MCP runtime gate, ADR-0029)
- **`verify_before_load`** tool — the composite runtime gate. Combines
  `check_lock` + scanner verdict + optional `verify_bundle` into one
  call. Returns `{safe, reasons[], checks}`. Refuses-by-default for
  drift, unattested artifacts (`requireAttestation: true`), scanner
  findings, missing locks, and invalid bundles. Eight stable refusal
  codes (`LOCK_MISSING`, `PATH_NOT_IN_LOCK`, `PATH_DIGEST_MISMATCH`,
  `PATH_FLAGGED_BY_SCANNER`, `PATH_UNATTESTED`, …) plus
  `BUNDLE_<code>` for every `VerificationErrorCode` from the verify
  library.
- Tool count is now **5** (was 4). Per ADR-0031 § 2 rule #2 the
  surface is additive — no breaking changes to existing tools.
- Trust-decision logic lives in `@primitivehub/phub` (exported as
  `verifyBeforeLoad`) per ADR-0031 § 2 rule #1. The MCP wrapper is
  pure transport.

### Added — initial Gate G-D release (2026-06-02)

Per [ADR-0031](../../docs/decisions/0031-mcp-server-as-transport.md)
the v0.1 server is a pure transport layer over existing primitives.
Zero custom trust logic; every tool delegates.

- **`verify_bundle`** — wraps `@primitivehub/verify`'s `verifyBundle`.
  Accepts a Trust Bundle as a JSON string OR a pre-parsed object.
  Levels: `structural` / `policy` / `full` (steps 3-6 stubbed per
  verify v0.1).
- **`scan_text`** — runs the full Context CI Top 10 detector roster
  (CCI-001…010) over arbitrary text. Wraps phub's `runScan`. Honors
  `--policy` / `--strict` / `--allow-fail` / `--detector`.
- **`audit_workspace`** — active-surface tool. Walks + classifies +
  scans every agent-context artifact under a root path. Wraps phub's
  `runAudit`. Output includes per-artifact verdicts + project
  summary.
- **`check_lock`** — compares the workspace against
  `.primitivehub/phub.lock` and reports drift. Wraps phub's
  `runAudit` with `lockMode: "check"`.
- **stdio transport** (default) — `primitivehub-mcp` binary speaks
  MCP over stdin/stdout. Standard pattern; works with every MCP host
  (Claude Code, Cursor, Aider, …).
- **Programmatic API** — `buildServer()`, `runStdio()`, individual
  tool callables for in-process / SSE / HTTP transports.
- **Worked examples** (`examples/`) — Claude Code, Cursor, Aider
  config snippets verified to register the server with its five
  visible tools.

### Runtime deps

- `@modelcontextprotocol/sdk` `^1.0.0` — the official MCP SDK; not
  hand-rolled (justified in ADR-0031 § "Alternatives").
- `@primitivehub/verify` `^0.1.0`.
- `@primitivehub/phub` `^0.1.0`.

### Tests
- `test/tools.test.ts` — 16 cases, in-process tool wrappers.
- `test/server.test.ts` — 6 cases, JSON-RPC via `InMemoryTransport`.
- `test/verify-before-load.test.ts` — 10 cases, the composite runtime gate.
- 32/32 passing.

### Forward-looking (next PRs, not in this release)

- **SSE / HTTP transports** — for browser-based agents that can't
  spawn stdio child processes.
- **Tool surface additions as verify matures** — `verify_bundle`
  inherits verify v0.2 (signature / cert / Rekor) when those steps land.

[0.1.0]: https://github.com/PrimitiveHub-AI/context-ci/releases/tag/mcp-server-v0.1.0
