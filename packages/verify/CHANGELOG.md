# Changelog

All notable changes to `@primitivehub/verify` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this library tracks the Trust Contract spec version (per ADR-0015).
`0.1.x` of this library is conformant to Trust Contract v0.1.

## [0.1.0] — 2026-07-21

The v0.1 launch release. Published to npm at launch — the `pnpm publish`
is a deliberate human action gated behind GitHub Actions environment
approval (ADR-0022 three-lock; [ADR-0045](../../docs/decisions/0045-product-first-public-launch-and-distribution-repo.md),
product-first).

### Added

- Initial public API: `verifyBundle(bundle, opts)` with three
  verification levels (`structural` / `policy` / `full`).
- Hand-rolled JSON Schema Draft 2020-12 mini-validator covering only
  the keywords v0.1 needs (zero runtime deps; < 50KB Gate G-B target).
- Content-digest verification via Web Crypto `subtle.digest` (works
  in Node ≥20 and modern browsers without polyfill).
- Context CI policy evaluator with three modes: default
  (reject any FAIL verdict), strict (treat WARN as FAIL),
  `allowFailFor` allow-list (escape hatch by detector or CCI ID).
- Vendored copy of the canonical Trust Contract v0.1 JSON Schema
  (`schema/v0.1.json`) — matches `docs/trust-contract/conformance/schema/v0.1.json`
  byte-for-byte.
- Vitest conformance harness reads the canonical fixtures from
  `docs/trust-contract/conformance/` — 23/23 passing.

### Scope

This release implements Trust Contract v0.1 verification procedure
**steps 1, 2, and 7**:

- Step 1 — JSON Schema validation
- Step 2 — Content digest verification (SHA-256)
- Step 7 — Context CI policy evaluation

Steps 3-6 (in-toto Statement parse + signature verification +
certificate chain walk + Rekor inclusion proof) are explicitly stubbed
and return `*_DEFERRED` failures when `level: "full"` is requested.
The v0.2 release of this library closes that gap.

### Reference implementation status

Per ADR-0020, this library is the **TypeScript/JavaScript reference
implementation** for Trust Contract v0.1. When the spec text and this
library's behavior disagree on the v0.1-implemented steps, the
conformance suite (`docs/trust-contract/conformance/`, ADR-0021) is
the arbiter.

### Known limitations

See README "Known limitations of v0.1" for the v0.2 roadmap.

[0.1.0]: https://github.com/DevXYZx/primitivehub/releases/tag/verify-v0.1.0
