# ADR-0023: `phub` CLI as user-facing surface + detector-parity discipline

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0016 (Top 10 versioning), ADR-0020 (verify as
reference implementation), ADR-0021 (conformance suite as
executable contract), ADR-0022 (publishing deferred to launch),
`packages/phub/`, `docs/execution-plan.md` Gate G-C

## Context

The Python-side scanners in `apps/api/scanners/` are the canonical
detector implementations: they run on the server during the
Context CI pipeline; they produce the predicates that go into
signed Trust Bundles; their behavior is auditable in attestations
under the stable `CCI-NNN` IDs (ADR-0016).

But the user-felt surface of PrimitiveHub is on the **client**:

- A developer writes `AGENTS.md` and wants to know if it's safe
  *before* committing.
- A CI pipeline wants to gate PRs on Context CI verdicts without
  shelling out to a PrimitiveHub instance.
- An AI agent embedded in an IDE wants to verify a downloaded Trust
  Bundle without making a network call to the issuing registry.

The CLI is the surface end users feel. `phub` is that surface.

`@primitivehub/verify` (ADR-0020) covers the verifier kernel.
`phub` covers everything *around* the verifier — file IO, argv,
human-readable output, scanner invocation — and ships scanner
TS ports so `npx phub scan AGENTS.md` works without a backend.

## Decision

**Ship `packages/phub/`** as the user-facing CLI for PrimitiveHub.
v0.1 ships three subcommands (`scan` / `verify` / `init`) and the
launch-demo detector trifecta (T1 / T2 / T5).

### Detector-parity rule

The TS detectors in `packages/phub/src/scanners/` are **ports** of
the canonical Python detectors in `apps/api/scanners/`. They are
NOT independent implementations.

1. **Pattern sets MUST mirror the Python source byte-for-byte.**
   When a Python regex is updated, the TS port is updated in the
   same PR.
2. **Stable IDs match.** Each TS detector exports the same
   `cciId` / `threatCategory` / `detectorName` / `detectorVersion`
   as its Python counterpart.
3. **Behavior on shared fixtures must agree.** Today this is
   enforced by independent fixture suites on each side; the
   parity is asserted by inspection during PR review.
4. **A future PR adds a scanner-conformance suite** (analogous to
   `docs/trust-contract/conformance/` for the verifier) that both
   the Python pytest harness and the TS vitest harness run against
   the same canonical adversarial-input set. Until then, parity is
   maintained by code-review discipline + the lockstep-PR rule.

### Lockstep-PR rule

When a Python detector regex / behavior changes, the PR MUST
include the matching TS port change. Drift between the two
implementations is a defect under this ADR. CI gates this by
running both test suites on every PR that touches
`apps/api/scanners/**` or `packages/phub/src/scanners/**` (CI wiring
is part of this PR via `.github/workflows/phub-ci.yml`).

### Scope: TS port, not Python wrapper

The TS detectors run pure-locally (no Python interpreter, no
subprocess, no network). This is non-negotiable:

- `npx phub scan` MUST work without an installed Python toolchain.
- `phub verify --offline` MUST work air-gapped (CI proves this with
  `--network=none` in Gate G-C).

The cost of port-maintenance is real but small (the detectors are
regex-heavy pure functions). The cost of *not* porting — requiring
users to install Python + run a Procrastinate worker locally — is
an adoption-killer.

### Publishing discipline

Inherits ADR-0022 in full: `@primitivehub/phub` is NOT published to
npm before the project launch event. The three-lock workflow model
(`workflow_dispatch` + `LAUNCH-CONFIRMED` input + `environment:
launch` reviewer gate) applies identically.

**Update 2026-05-31:** Initial draft of this ADR specified the bare
`phub` name on npm "with squat risk accepted." During PR 5.5.3 CI
implementation, `pnpm publish --dry-run` against the proposed
package surfaced an existing `phub` package at v1.1.4 on the public
registry (the squat had already happened). Pivoted to the scoped
name `@primitivehub/phub` with the unscoped binary name `phub`
preserved (npm `bin` is independent of package name). Post-install
ergonomics are unchanged (`phub --help` works after
`pnpm add -D @primitivehub/phub`). The no-install invocation
becomes the slightly-longer `npx @primitivehub/phub` — accepted as
the cost of brand consistency with `@primitivehub/verify`. Pursuing
the bare `phub` name via npm trademark dispute is a launch-week
nice-to-have, not load-bearing.

## Alternatives considered

1. **HTTP wrapper that calls a running PrimitiveHub instance** for
   scans. Rejected. Forces every user to either run their own
   instance or trust the hosted one with their source code; kills
   the offline / air-gap use case; introduces a network hop on
   every PR check.

2. **TS port without lockstep-PR rule** — let the two
   implementations drift and reconcile at release time. Rejected.
   Drift between detector implementations is a credibility problem
   (attestation says "CCI-001 passed" but `phub scan` says
   "CCI-001 failed" → user trust evaporates). Lockstep prevents
   the divergence from existing in main even briefly.

3. **Ship CLI without detectors; only `verify` + `init`.** Rejected.
   The CLI without scanning is plumbing. The scan command is the
   one that makes the strategic story concrete:
   "What does Context CI mean? Run `npx phub scan AGENTS.md` and
   you'll see."

4. **Use Commander.js / yargs for argv parsing.** Rejected. Adds
   a runtime dep + ~15KB to the bundle. Hand-rolled parser
   (`src/argv.ts`) is ~120 lines, easier to audit (supply-chain
   surface matters for a security tool), and matches the verify
   package's zero-deps narrative.

5. **Single package combining verify + phub.** Rejected. Verify is
   a library; phub is a CLI. They have different audiences (library
   consumers vs. command-line users), different version cadences
   (verify is conformance-pinned to Trust Contract spec versions;
   phub adds CLI features more freely), and different deprecation
   policies. Splitting them lets each evolve at its right pace.

## Consequences

### Positive

- **`npx phub <cmd>` is the demo.** The paper opens with "run this
  command, see what's wrong with your context." No backend, no
  install, no sign-up.
- **Air-gap deployments work.** `phub scan` + `phub verify
  --offline` cover regulated environments where outbound network
  is forbidden.
- **Programmatic API enables ecosystem.** Custom GitHub Action,
  pre-commit hook, IDE plugin — all import directly from `phub`
  rather than reinventing the scanner logic.
- **Lockstep rule prevents drift.** A regression in the Python
  detector that doesn't break the TS test is impossible to ship
  because the lockstep PR includes both.

### Negative

- **Two implementations to maintain.** Every detector behavior
  change is two diffs in lockstep. Cost is small (regex changes
  port mechanically) but real.
- **Today's parity is by-inspection.** Until the scanner-conformance
  suite lands, a subtle regex difference (e.g. Python's `\w`
  Unicode semantics under `re.UNICODE` vs. JS's `\w` requiring
  `\p{L}` workaround — exactly what T2 ran into) could survive
  review.
- **Mature scanner-conformance suite is a future PR.** Catalog the
  canonical adversarial-input set + invariants both implementations
  must satisfy; analogous to `docs/trust-contract/conformance/`.

### Neutral

- **`phub` is a CLI; updates need user re-install.** This is
  standard npm CLI ergonomics. The `npx phub` pattern (no install)
  always gets the latest published version, mitigating staleness
  for one-off use; daily users running it via `pnpm add -D phub`
  bump on their own cadence.
- **The bare `phub` name (no scope) has a real squat risk** before
  launch (ADR-0022 accepts the same risk for `@primitivehub/verify`
  with the same mitigation — domain ownership as dated proof of
  first use + npm trademark dispute process).

## Implementation

`packages/phub/`:

- `bin/phub.js` — shebang entry, delegates to `dist/cli.js`
- `src/cli.ts` — orchestrator: argv parse, dispatch to commands
- `src/argv.ts` — zero-dep argv parser
- `src/commands/scan.ts` — `phub scan`
- `src/commands/verify.ts` — `phub verify` (wraps `@primitivehub/verify`)
- `src/commands/init.ts` — `phub init`
- `src/scanners/types.ts` — `Verdict`, `Severity`, `DiffHint`, `Detector`
- `src/scanners/t1-prompt-injection.ts` — port of `apps/api/scanners/t1_prompt_injection.py`
- `src/scanners/t2-unicode-steganography.ts` — port of `apps/api/scanners/t2_unicode_steganography.py`
- `src/scanners/t5-unsafe-shell-install.ts` — port of `apps/api/scanners/t5_unsafe_shell_install.py`
- `src/scanners/registry.ts` — `DETECTORS` array + lookup helper
- `src/reporters/human.ts` — human-readable scan + verify renderers
- `src/index.ts` — programmatic exports
- `test/scanners.test.ts` — per-detector fixture tests (14 cases)
- `test/cli.test.ts` — end-to-end CLI tests via `main()` (19 cases)
- `test/fixtures/` — clean + per-detector adversarial markdown
- `README.md` — install + subcommand docs + programmatic API
- `CHANGELOG.md` — v0.1.0 entry
- `LICENSE` — MIT

## What ships in subsequent PRs

- **Scanner-conformance suite** — canonical adversarial inputs
  + invariants; runs against both Python and TS detectors;
  analogous to `docs/trust-contract/conformance/`.
- **`phub-publish.yml`** — npm publish workflow with same three-lock
  model as verify-publish.yml (ADR-0022).
- **T3 / T4 / T6..T10 ports** — each lockstep with the Python
  detector landing in `apps/api/scanners/`.
- **SARIF reporter** — `phub scan --sarif` for GitHub Code Scanning
  integration (Gate G-C closer).
- **GitHub Action wrapper** — published to GitHub Marketplace
  per Gate G-C acceptance.
- **MCP server (`@primitivehub/mcp-server`, Gate G-D)** — exposes
  `verify_bundle` + `fetch_trusted_primitive` as MCP tools; consumes
  this package's scanner + verify exports internally.

## References

- `packages/phub/` — the implementation
- `packages/phub/README.md` — CLI surface
- `apps/api/scanners/` — canonical Python detectors
- ADR-0016 — Top 10 versioning + `CCI-NNN` stable IDs
- ADR-0020 — verify as reference implementation
- ADR-0021 — conformance suite as executable contract
- ADR-0022 — publishing deferred to launch
- `docs/execution-plan.md` Gate G-C — Enforcement surfaces shipped
