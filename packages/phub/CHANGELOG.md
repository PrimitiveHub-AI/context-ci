# Changelog

All notable changes to `@primitivehub/phub` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version tracks both Trust Contract spec version (for the verify
wrapper) and Context CI Top 10 version (for the scanner detectors);
`0.1.x` of this package is conformant to both v0.1.

## [Unreleased]

### Added (PR 5.5.X — Context Policy Language v0.1, ADR-0018)
- **`phub scan --policy <path>`** — load a
  [Context Policy Language v0.1](../../docs/context-policy-v0.1.md)
  YAML file. Per-file allow exceptions with required `reason` field,
  per-rule severity overrides (`error`/`warning`/`note`/`off`), spec-
  defined glob path matching. Closes the canonical false-positive
  documented in `docs/bugs.md` #25.
- **`phub scan --allow-fail=<id>`** (CLI) — appended to
  `policy.allow` as synthetic entry; composes with `--policy`.
- **Auto-discovery** of `.primitivehub/policy.yaml` walking cwd → git
  root. Explicit `--policy <path>` wins.
- **Human output**: appends "N findings permitted by policy" summary
  with each unique `[CCI-NNN] reason` line.
- **JSON output**: adds `policySource`, `policyAllowed` (per-hint
  records with `reason`), and `summary` block.
- **SARIF output**: rules disabled by `severity: off` emit no result;
  allow-permitted hints emit no result. Code Scanning sees post-policy
  state only.
- New runtime dep: `yaml` (^2.6.0) — pure-TS, no transitive deps.
- Programmatic exports: `loadPolicyFromFile`, `loadPolicyFromString`,
  `applyPolicy`, `resolvePolicy`, `discoverPolicyPath`, `matchGlob`,
  `matchAnyGlob`, all policy types, `IMPLICIT_DEFAULT_POLICY`.

### Added (PR 5.5.3.action)
- `phub scan --sarif` — SARIF 2.1.0 output for GitHub Code Scanning
  upload, with `partialFingerprints` for stable cross-run dedup,
  `properties.threatCategory`/`detailTag` for downstream filtering,
  and `helpUri` per rule pointing at the Top 10 spec page.
  Mutually exclusive with `--json`. Per ADR-0024.
- `phub scan --no-fail` — converts finding-exit 1 → 0 (preserves
  error-exit 2). Lets CI use SARIF upload as the gate instead of
  process exit code.
- `actions/phub-scan/` composite GitHub Action (in-tree pre-launch,
  to be republished as `primitivehub/phub-scan` at launch).
- `.github/workflows/phub-scan-demo.yml` — end-to-end CI demo using
  the local action against the repo's own files; uploads SARIF to
  this repo's Code Scanning category `phub-context-ci`.
- Programmatic export: `renderSarif(filename, verdicts) → string`.

## [0.1.0] — 2026-05-31

**Not yet published to npm.** Per
[ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md)
publishing is gated to the project launch event. The CLI is fully
functional inside the monorepo today; `npx @primitivehub/phub
<command>` is a launch-day capability.

### Package name

The bare `phub` name on npm is occupied by an unrelated package
(discovered via `pnpm publish --dry-run` during PR 5.5.3). This
package ships under `@primitivehub/phub` (scoped) to avoid the
conflict. The binary remains `phub` (unscoped) so post-install
ergonomics are unchanged: `pnpm add -D @primitivehub/phub` followed
by `phub --help` works as expected. See
[ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
"Update 2026-05-31" for the pivot rationale.

### Added

- `phub scan <file>` — runs T1 / T2 / T5 detectors against any text
  file (markdown or plain). Stable IDs `CCI-001` / `CCI-002` /
  `CCI-005` per Context CI Top 10 v0.1.
- `phub verify <bundle.json>` — wraps
  [`@primitivehub/verify`](../verify/). Verification levels
  `structural` / `policy` / `full`. All-offline.
- `phub init` — writes a starter `AGENTS.md` in the current
  directory.
- `phub help [command]`, `phub version`, `--help`, `--version`.
- `--json` global flag for machine-readable output (scan + verify).
- Programmatic API exports (`runScan`, `verifyCommand`, `DETECTORS`,
  scanner classes, `renderHuman*Report` reporters) so phub can be
  embedded in custom GitHub Actions / pre-commit hooks / CI tools.
- Hand-rolled argv parser (`src/argv.ts`) — zero deps, supports
  long/short flags, `=`-form values, repeatable flags, `--` end-of-args.

### Detector parity

Detectors are TypeScript ports of `apps/api/scanners/{t1,t2,t5}_*.py`.
Pattern sets are byte-for-byte identical to the Python source. Per
[ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
a future PR adds a scanner-conformance suite to enforce the parity
mechanically; today, fixture tests in this package + the Python
pytest suite both run independently.

### Scope of v0.1

Ships the launch-demo trifecta (T1 / T2 / T5) — the differentiating
detector set the project paper rests on. The remaining Top 10 IDs
(`CCI-003`, `CCI-004`, `CCI-006`..`CCI-010`) land in subsequent PRs
in lockstep with the Python detectors.

### Known limitations

- No SARIF output (Gate G-C follow-up).
- No `phub login` / `phub publish` (Phase 6+).
- Detectors flag matches inside fenced code blocks (mirrors Python
  v0.1; markdown-AST awareness lands in v0.2 across both sides).
- The `--offline` flag on `verify` is documentary only; verification
  is always offline in v0.1.

[Unreleased]: https://github.com/DevXYZx/primitivehub/compare/phub-v0.1.0...HEAD
[0.1.0]: https://github.com/DevXYZx/primitivehub/releases/tag/phub-v0.1.0
