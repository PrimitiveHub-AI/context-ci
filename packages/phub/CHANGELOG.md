# Changelog

All notable changes to `@primitivehub/phub` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version tracks both Trust Contract spec version (for the verify
wrapper) and Context CI Top 10 version (for the scanner detectors);
`0.1.x` of this package is conformant to both v0.1.

## [Unreleased]

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
