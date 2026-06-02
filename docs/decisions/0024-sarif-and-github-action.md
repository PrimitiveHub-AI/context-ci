# ADR-0024: SARIF 2.1.0 as canonical CI integration + composite GitHub Action

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0016 (Top 10 versioning), ADR-0022 (publishing
deferred), ADR-0023 (`phub` CLI), `packages/phub/`,
`actions/phub-scan/`, `docs/execution-plan.md` Gate G-C

## Context

The `@primitivehub/phub` CLI (ADR-0023) ships scan + verify
subcommands with `--json` output. JSON is fine for arbitrary
consumers, but the GitHub-native distribution is **GitHub Code
Scanning**, which speaks one wire format: **SARIF 2.1.0** (OASIS
standard, [json.schemastore.org/sarif-2.1.0.json](https://json.schemastore.org/sarif-2.1.0.json)).

Code Scanning is the gate where security findings show up inline on
PR diffs in front of every reviewer. Snyk, Semgrep, CodeQL, Trivy
all converged on SARIF for the same reason. For Context CI to land
in the same UI strip on the same PRs, phub MUST emit SARIF.

The CI integration shape also matters: end users adopt a GitHub
Action with one `uses:` line, not a bash snippet they paste into
their workflow. So in parallel with the SARIF reporter, this ADR
also locks the **composite-Action shape**.

## Decision

Two coupled decisions:

### 1. SARIF 2.1.0 is the canonical CI integration format

- `phub scan <file> --sarif` emits a single-run SARIF 2.1.0 document
  to stdout. Mutually exclusive with `--json`.
- The `tool.driver.rules` catalog **always** lists every detector
  phub ships (CCI-001 / CCI-002 / CCI-005 in v0.1) regardless of
  `--detector=<id>` filters, so consumers see the full rule
  catalog and can render rule descriptions even when only a subset
  ran.
- `passed=true` verdicts emit **no** SARIF result. Empty findings
  is a valid SARIF document; we don't pollute Code Scanning with
  green "this detector ran and found nothing" notes.
- `results[].partialFingerprints.contextCiDetail` is sha256 of
  `(cciId, detailTag, snippet)`, truncated to 16 hex chars. GitHub
  uses partialFingerprints to dedupe findings across runs — a
  finding that moves by a line stays "the same finding."
- `results[].properties.threatCategory` and `properties.detailTag`
  carry the per-finding tag (e.g. `role-hijack`, `npx-arbitrary-install`)
  so downstream tooling can filter without re-parsing message text.
- `helpUri` per rule points at `https://primitivehub.ai/top-10#CCI-NNN`
  — the public Top 10 spec page renders the rule's canonical
  description. Stable URL per ADR-0016.

### 2. `actions/phub-scan/` is the canonical GitHub-Action surface

- Composite action (no separate JS bundle to maintain; the existing
  CLI is what runs). Lower supply-chain surface than a JS Action
  that pulls in npm deps at action-build time.
- One-line `uses: primitivehub/phub-scan@v0.1.0` post-launch (the
  Action would be republished from a standalone `primitivehub/phub-scan`
  repo at launch; today the in-tree path
  [`./actions/phub-scan`](../../actions/phub-scan/) is canonical
  and dogfooded by `.github/workflows/phub-scan-demo.yml`).
- Inputs cover the common cases (`files`, `fail-on-findings`,
  `upload-sarif`) with safe defaults. Two escape hatches:
  - `phub-source: 'local'` for monorepo dogfooding (the demo
    workflow uses this; external users always use `'npm'`).
  - `phub-version` to pin (default `latest`, but production users
    SHOULD pin).
- The Action uploads SARIF to Code Scanning via
  `github/codeql-action/upload-sarif@v3` — the GitHub-canonical
  uploader, supports directory-mode merge for multi-file scans.
- Two failure semantics, controlled by `fail-on-findings`:
  - `true` (default): findings → step exits non-zero → PR check fails.
  - `false`: findings still appear in Code Scanning but the step
    exits 0. Lets teams adopt Context CI on a repo without
    breaking every PR on day one; promote to `true` once the
    backlog is clean.

### Severity mapping

| phub `Verdict.severity` | SARIF `level` |
|---|---|
| `FAIL` | `error` |
| `WARN` | `warning` |
| `INFO` | `note` (but only ever emitted in v0.1 when passed=false) |

`defaultConfiguration.level` on each rule is `error` — matches the
v0.1 "false positives preferable to false negatives" stance.

### Multi-file scans → directory mode

`phub scan` stays single-file in v0.1 (simpler API, easier to
reason about). The composite action loops file-by-file, emitting
one `.sarif` per scanned file into `sarif-directory` (default:
`phub-sarif/`). `upload-sarif@v3` natively merges every `.sarif`
in a directory into one Code Scanning category (`phub-context-ci`).

## Alternatives considered

1. **JSON-only output, no SARIF.** Rejected. Forces every user to
   write their own GitHub Actions glue to convert JSON to whatever
   Code Scanning ingests; nobody would do that and Context CI
   would never appear in the surface where security findings live.

2. **JavaScript Action instead of composite.** Rejected. JS Actions
   need a build step (rollup → checked-in bundle in `dist/`), pin
   their own Node version separately from the CLI, and introduce a
   second supply-chain surface (the Action's npm deps separate from
   phub's). Composite + the existing CLI binary is the minimum.

3. **Custom rule format instead of SARIF.** Rejected immediately —
   reinventing the wheel that every other security tool already
   converged on. SARIF's verbosity is the cost of universality.

4. **Embed SARIF reporter as a separate package** (`@primitivehub/phub-sarif`).
   Rejected. The SARIF reporter is ~150 lines, zero deps beyond
   `node:crypto`, and shares the same Verdict shape as the rest of
   phub. No reason to split.

5. **Upload SARIF in the CLI instead of the Action.** Rejected.
   The CLI must work air-gapped (Gate G-C). Uploading is the
   Action's job because that's where the GitHub token + Code
   Scanning API live.

6. **`fail-on-findings` defaults to `false`.** Considered. Rejected
   because the default behavior of a security scanner should be
   "block bad things"; opt-in to non-blocking is the right
   discoverability. Teams adopting on a noisy repo can flip it,
   and the docs call out the use case.

## Consequences

### Positive

- **Findings show up where reviewers already look** (PR diffs +
  Security tab) — no new dashboard to teach.
- **One-line workflow integration** for end users:
  `uses: primitivehub/phub-scan@v0.1.0`. Matches the discoverability
  of CodeQL / Semgrep / Snyk Actions.
- **SARIF rule descriptions + `helpUri`** mean clicking a finding
  in GitHub opens the Top 10 spec page — strong educational
  surface; the spec page is the docs the paper cites.
- **Composite action minimizes supply-chain surface.** The action
  has no `dist/` bundle to audit; the CLI it invokes is the same
  one users run locally.
- **`partialFingerprints` for stable dedup** means findings don't
  re-trigger reviewer attention on every PR that shifts line
  numbers around.

### Negative

- **SARIF is verbose.** A scan with N findings generates ~200N
  bytes of SARIF for the results array plus a static ~3KB rule
  catalog. Tolerable; SARIF is read by tools, not humans.
- **Code Scanning has a 5,000-result-per-run cap.** A pathological
  repo could exceed this; the per-detector MAX_HINTS_PER_VERDICT=10
  cap keeps any single detector's contribution bounded, but at
  scan-many-files time the total could climb. Mitigation: the
  composite action's loop puts one detector's findings per file
  into separate SARIF documents; Code Scanning merges them but
  also dedupes via partialFingerprints. The 5K cap is unreachable
  in practice for the v0.1 detector set.
- **`security-events: write` permission required** on caller
  workflows for SARIF upload. Standard for any Code Scanning
  integration; documented in the Action README.

### Neutral

- **The Action lives in-tree until launch.** `actions/phub-scan/`
  is the canonical source; a `primitivehub/phub-scan` repo gets
  cut at launch with this directory as its initial commit. The
  in-tree dogfooding via `.github/workflows/phub-scan-demo.yml`
  proves the Action shape today.

## Implementation

- `packages/phub/src/reporters/sarif.ts` — `renderSarif()` function
- `packages/phub/src/commands/scan.ts` — `--sarif` flag wiring,
  mutually-exclusive with `--json`
- `packages/phub/src/cli.ts` — adds `--sarif`, `--no-fail` global specs;
  `--no-fail` converts finding-exit 1 → 0 (preserves error-exit 2)
- `packages/phub/src/index.ts` — re-exports `renderSarif`
- `packages/phub/test/sarif.test.ts` — 11 structural assertions
- `packages/phub/test/cli.test.ts` — 5 new cases for `--sarif`,
  `--no-fail`, flag conflict
- `actions/phub-scan/action.yml` — composite action manifest
- `actions/phub-scan/README.md` — integration docs
- `.github/workflows/phub-scan-demo.yml` — end-to-end demo using
  the local action against the repo's own CLAUDE.md / README.md /
  DESIGN.md with `fail-on-findings: 'false'` (documented in
  docs/bugs.md #25)

## What ships in subsequent PRs

- **Standalone `primitivehub/phub-scan` repo at launch** — the
  in-tree action moves out; consumers cite `primitivehub/phub-scan@v0.1.0`
  as a one-line marketplace listing.
- **Marketplace publication** — the standalone repo's first
  release gets listed in GitHub Marketplace.
- **Scanner-conformance suite** (ADR-0023 follow-up) — shared
  fixtures + invariants Python and TS detectors both satisfy.
- **T3 / T4 / T6..T10 ports** — additive to the SARIF rule catalog
  (new rules added; no breaking change to existing CCI-NNN ids).
- **Markdown-AST aware scanners (v0.2)** — fixes docs/bugs.md #25
  on both Python and TS sides.

## References

- `actions/phub-scan/action.yml` — composite action
- `packages/phub/src/reporters/sarif.ts` — SARIF reporter
- `.github/workflows/phub-scan-demo.yml` — end-to-end proof
- SARIF 2.1.0 spec — https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/sarif-v2.1.0-cs01.html
- GitHub Code Scanning SARIF docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
- ADR-0016 — Top 10 stable IDs
- ADR-0023 — phub CLI
- docs/execution-plan.md Gate G-C — Enforcement surfaces shipped
