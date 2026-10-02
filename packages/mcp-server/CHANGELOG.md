# Changelog

All notable changes to `@primitivehub/mcp-server` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version tracks Trust Contract spec version (for `verify_bundle`) and
Context CI Top 10 version (for `scan_text` / `audit_workspace`);
`0.1.x` of this package is conformant to both v0.1.

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

[0.1.0]: https://github.com/DevXYZx/primitivehub/releases/tag/mcp-server-v0.1.0
