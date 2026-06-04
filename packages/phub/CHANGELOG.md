# Changelog

All notable changes to `@primitivehub/phub` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version tracks both Trust Contract spec version (for the verify
wrapper) and Context CI Top 10 version (for the scanner detectors);
`0.1.x` of this package is conformant to both v0.1.

## [Unreleased]

### Added (PR 5.11 — CBOM SPDX 2.3 + CycloneDX 1.5 projection exporters)
- **`phub cbom --format=<fmt>` flag** with three values:
  - `cbom` — Native CBOM v0.1 (default; unchanged behavior).
  - `spdx` — SPDX 2.3 JSON projection. Each CBOM component maps to
    an SPDX `File` element with SHA256 checksum + `NOASSERTION`
    license. Classification + attestation + displayName +
    primitiveVersion ride along as SPDX `annotations` with
    `cbom:`-prefixed `comment` values. Document namespace is
    derived from SHA-256 of the native CBOM bytes —
    `https://primitivehub.ai/cbom/<subject>#<hash>` — so same
    workspace → same namespace, every run. SPDX 2.3 requires
    `creationInfo.created`; pinned to the stable epoch-zero
    marker `1970-01-01T00:00:00Z` to preserve byte-identical
    re-stamps.
  - `cyclonedx` — CycloneDX 1.5 JSON projection. Each CBOM
    component maps to a `component` with `type: "file"`, a
    `bom-ref` of `cbom:<sha256>`, SHA-256 `hashes`, and
    `properties[]` carrying `cbom:classification`,
    `cbom:attestation`, `cbom:sizeBytes`, plus `cbom:displayName`
    when present. `metadata.properties` carries the
    `cbom:topTen:specVersion` / `cbom:topTen:detectorCount`
    pointers. `serialNumber` is `urn:cbom:<hash>` derived from
    the native CBOM bytes.
- **Native CBOM remains the canonical wire form.** SPDX +
  CycloneDX are lossy projections (SPDX drops sizes + the topTen
  pointer; both drop fields with no schema equivalent) — see
  `docs/cbom-v0.1.md` § 7.2 for the mapping table.
- **Reproducibility property holds across all three formats.** The
  conformance suite at `docs/cbom/conformance/` now ships
  `expected.spdx.json` and `expected.cyclonedx.json` alongside the
  native `expected.cbom.json`; the TS harness asserts
  byte-identical emission for each.
- **Programmatic API:** `buildSpdxDocument`, `serializeSpdx`,
  `buildCycloneDxBom`, `serializeCycloneDxBom`, and the
  `renderCbom(cbom, format)` dispatcher exported from
  `@primitivehub/phub`.
- **Test count:** phub suite grows 264 → 295 (28 new
  cbom-exporters tests + 2 new fixture-parity assertions + 1 new
  manifest re-assertion). Reproducibility verified across formats:
  re-rendering each yields byte-identical output.

### Added (PR 5.9 — CBOM v0.1: third pillar of the Trust Runtime)
- **`phub cbom [<path>]` subcommand** — emits a Context Bill of
  Materials (CBOM v0.1) for the workspace. Canonical-JSON inventory
  of every classified agent-context artifact: path, classification,
  SHA-256 content digest, size in bytes, attestation pointer, and
  optional `displayName` / `primitiveVersion` parsed from YAML
  frontmatter. Reproducibility is load-bearing: re-running against
  an unchanged workspace yields a byte-identical document (no
  timestamps, alphabetic key sort, lexicographic component order).
  See [ADR-0033](../../docs/decisions/0033-cbom-v0.1.md) and the
  wire-format spec at [`docs/cbom-v0.1.md`](../../docs/cbom-v0.1.md).
- **CLI flags:** `--output <file>` to write to disk instead of
  stdout, `--lock-path <path>` to override the lock used for
  attestation cross-referencing, `--subject-name <name>` to
  populate the `subject.name` field, `--max-files` / `--max-depth`
  walker caps mirroring `phub audit`.
- **Lock integration:** when `.primitivehub/phub.lock` is present
  in the workspace, each component's `attestation` field is copied
  from the matching lock entry so the CBOM and lock agree on
  provenance state. Absent lock → all components emit
  `"unattested"`.
- **Conformance suite** at `docs/cbom/conformance/` with a
  `minimal-workspace` fixture (1 AGENTS.md, 1 CLAUDE.md, 1
  primitive with frontmatter). TS harness
  (`test/cbom-conformance.test.ts`) verifies byte-identical
  emission and reproducibility. A future Python `phub_py cbom`
  (v0.2 candidate) runs the same manifest.
- **Programmatic API:** `buildCbom`, `serializeCbom`, and the
  `CBOM_*` constants exported from `@primitivehub/phub`.
- **Test count:** phub suite grows 235 → 264 (29 new CBOM tests
  across `cbom.test.ts` + `cbom-conformance.test.ts`).

### Added (PR 5.6.3 — T9 + T10 detectors; Top 10 complete at 10/10)
- **T9 / T10** TypeScript detector ports (lockstep with the Python
  implementations per ADR-0023):
  - `T9CopyrightContaminationDetector` (CCI-009) — verbatim license
    boilerplate matching across five families:
    permissive-license-header (MIT / Apache / BSD / MPL / SPDX),
    gpl-header (GPL / LGPL / AGPL / SPDX),
    proprietary-copyright-notice (third-party © + year + "All Rights
    Reserved"), cc-attribution-required (CC-BY / CC-BY-SA / CC-BY-NC
    markers), and forum-source-attribution (Stack Overflow, Reddit,
    Medium, Substack, GitHub references).
  - `T10ContextBloatDetector` (CCI-010) — mechanical threshold checks:
    oversized-primitive (> 32K chars), excessive-repetition (> 20% of
    non-trivial duplicate lines), whitespace-stuffing (> 40% blank
    lines for primitives with ≥ 100 lines), heading-proliferation
    (< 500 chars per h2). Thresholds calibrated against the project's
    own primitives (max ≈ 16K chars) — verified zero false positives
    on the existing primitive corpus.
- **Active detector roster grows from 8 to 10 — full Top 10 shipped.**
  The paper's coverage claim is now mechanically defended at 10/10.
- `src/index.ts` exports added for both new detectors.
- `src/reporters/sarif.ts` RULE_DESCRIPTIONS extended with CCI-009
  and CCI-010 entries (shortDescription, fullDescription, helpUri).
- Six new conformance fixtures (3 per detector) + manifest entries.
  Both Python and TS harnesses now run 35/35 (was 29).
- T10 verdict severity is `warn` per the spec range (`info` to `warn`).

### Added (PR 5.6.2 — T7 + T8 detectors)
- **T7 / T8** TypeScript detector ports (lockstep with the Python
  implementations per ADR-0023):
  - `T7PoisonedNamingDetector` (CCI-007) — official-vendor-claim
    prose, false-affiliation-claim prose, and vendor-typosquat
    patterns (digit-for-letter substitutions on a 36-vendor list).
    Slug-similarity + Sigstore identity cross-check are v0.2.
  - `T8FakeCitationDetector` (CCI-008) — invalid CVE years (future
    or pre-1999), invalid RFCs (>9999 or 0), invalid arXiv IDs
    (month out of range or future year), DOI prefixes outside the
    v0.1 accepted-authorities list (28 publishers), and ungrounded
    "according to research" / "studies show" / "experts agree"
    rhetoric without an inline source within 200 characters.
- Active detector roster grows from 6 to **8** (T1..T8). Stable
  category-number order preserved.
- `src/index.ts` exports added for both new detectors.
- `src/reporters/sarif.ts` RULE_DESCRIPTIONS extended with CCI-007
  and CCI-008 — shortDescription, fullDescription, helpUri pointing
  at the Top 10 spec anchor.
- Six new conformance fixtures (3 per detector) + manifest entries.
  Both Python and TS harnesses now run 29/29 (was 23).
- T8 reads the system clock for "current year" cutoffs (CVE / arXiv).
  Conformance fixtures use year 2099 so positive expectations stay
  valid indefinitely.

### Added (PR 5.6 — T3 + T4 + T6 detectors + scanner-conformance suite, ADR-0032)
- **T3 / T4 / T6** TypeScript detector ports (lockstep with the
  Python implementations per ADR-0023):
  - `T3EncodedPayloadsDetector` (CCI-003) — long base64 / hex blobs +
    decode-and-execute instructions + ROT13 prose.
  - `T4RemoteFetchDetector` (CCI-004) — fetch-and-include /
    load-time-fetch / agent-side `<link>` / `<iframe>` / `@import`.
  - `T6CredentialExfiltrationDetector` (CCI-006) — send-secrets,
    curl-data-exfil with known secret env vars, hide-in-output,
    scan-and-send credential file paths.
- Active detector roster grows from 3 to **6** (T1 / T2 / T3 / T4 /
  T5 / T6). Detector registration in `src/scanners/registry.ts`
  preserves stable category-number order; `--json` output remains
  reproducible.
- Programmatic exports added to `src/index.ts` for each new detector
  class.
- New runtime parity gate: `test/scanner-conformance.test.ts` runs
  the shared manifest at `docs/context-ci-top-10/conformance/`
  through the TS roster. 23/23 fixtures pass; manifest covers every
  active detector.
- Zero new runtime deps — uses Node's built-in fs/url/path APIs
  for fixture discovery.

### Added (PR 5.7.4 — `phub install`, ADR-0028)
- **`phub install <slug@semver>`** — safe-install for context primitives.
  Replaces `curl|bash` / `npx <pkg>` (T5 attack class) with a
  verify-then-write pipeline. Three sources, mutually exclusive:
    - positional `<slug@semver>` (registry, default
      `https://registry.primitivehub.ai`)
    - `--bundle <path>` (local Trust Bundle JSON)
    - `--url <url>` (arbitrary HTTP source)
- **Pipeline** — classify source → fetch bundle text → JSON.parse →
  `verifyBundle` (level=policy by default) → safety-check
  classification + path + media type → write content → update lock.
- **Path layout** — `<workspace>/.primitivehub/installed/primitives/<slug>/<semver>/primitive.<ext>`.
  The `primitives/` segment makes the audit classifier rule
  (`**/primitives/**`) match installed artifacts so re-audit
  discovers them.
- **Walker change** — `KEEP_DOT_DIRS` gains `.primitivehub` so audit
  descends into the install tree. Zero regression on existing audit/
  lock/watch tests.
- **Lock attestation widened** — `LockAttestation` now includes
  `url:<url>` and `local:<path>` alongside `unattested` /
  `rekor:<idx>` / `registry:<slug>@<semver>`. Dev-mode escape hatches
  documented as "do not merge to main" in production.
- **Safety rules at writer** — refuses subject.slug containing `..`,
  path traversal at any level, unknown media types (whitelist:
  text/markdown, text/plain, application/json), content > 16 MB,
  size mismatch vs declared `content.sizeBytes`, and writes that
  escape the workspace root.
- **Stable refusal codes** — `NO_SOURCE`, `AMBIGUOUS_SOURCE`,
  `INVALID_SLUG_SEMVER`, `UNSAFE_SLUG`, `BUNDLE_NOT_FOUND`,
  `FETCH_TIMEOUT`, `FETCH_HTTP_ERROR`, `BUNDLE_PARSE_ERROR`,
  `BUNDLE_REJECTED`, `UNKNOWN_MEDIA_TYPE`, `PATH_TRAVERSAL`,
  `ALREADY_INSTALLED`, etc. CI consumers branch on the code.
- **Flags** — `--registry <url>`, `--install-dir <rel>`,
  `--lock-path <path>`, `--no-lock`, `--force`, `--level`,
  `--fetch-timeout-ms`, `--json`.
- **Programmatic exports** — `installCommand`, `runInstall`,
  `parseSlugSemver`, `classifySource`, `fetchBundleText`,
  `planInstallTarget`, `writeBundleContent`, error classes, types.
- Zero new runtime deps — uses Node's built-in `fetch` with
  AbortController-based timeouts.

### Added (PR 5.7.5 — `verifyBeforeLoad` reference for ADR-0029)
- **`verifyBeforeLoad(opts)`** — composite runtime-gate function.
  Combines `runAudit({lockMode:"check"})` + per-path lock entry lookup
  + scanner verdict aggregation into one synchronous call. Returns
  `{safe, reasons[], checks}` with eight stable refusal codes
  (`LOCK_MISSING`, `PATH_NOT_IN_LOCK`, `PATH_DIGEST_MISMATCH`,
  `PATH_FLAGGED_BY_SCANNER`, `PATH_UNATTESTED`, etc.).
- The reference implementation that the MCP server's
  `verify_before_load` tool (ADR-0029) wraps. Non-MCP consumers
  (pre-commit hooks, custom GitHub Actions, IDE plugins) can import
  it directly; cryptographic bundle verification stays in
  `@primitivehub/verify`.
- Programmatic exports: `verifyBeforeLoad`, `VerifyBeforeLoadOptions`,
  `VerifyBeforeLoadResult`, `VerifyBeforeLoadReason`,
  `VerifyBeforeLoadReasonCode`, `VerifyBeforeLoadChecks`.

### Added (PR 5.7.3 — `phub watch`, ADR-0027)
- **`phub watch [dir]`** — active runtime guardian. Daemon mode runs
  an initial audit, then watches the tree via Node's built-in
  `fs.watch({ recursive: true })`. Each debounced fs event triggers
  a re-audit; flagged artifacts emit a `scanned` event with the
  failing CCI IDs. Exits on SIGINT/SIGTERM. Reuses runAudit
  internals — zero parallel scanning logic per ADR-0023's parity
  rule.
- **`--once`** — single audit + emit + exit (same shape as
  `phub audit`; for tests + CI smoke runs).
- **`--debounce <ms>`** — per-path debounce (default 200ms). Coalesces
  editor save-and-replace storms into a single emit per path.
- **`--max-runtime-sec <N>`** — bounded daemon runtime for tests
  and time-boxed CI scans. Production daemons usually omit it.
- **`--quarantine`** — accepted in v0.1 as a documentary marker;
  actual file-move semantics deferred to v0.2 (separate ADR).
- **NDJSON stream** with `--json` — one `{kind, timestamp, payload}`
  JSON object per line. Event kinds: `started` / `ready` /
  `fs-event` / `scanned` / `warning` / `shutdown`. Streamable
  via `tail -f | jq`.
- **Zero new runtime deps** — uses Node's built-in fs.watch.
  Cross-platform via libuv (macOS FSEvents, Windows
  ReadDirectoryChangesW, Linux libuv recursive ≥ Node 20.6).
- **Programmatic API** — `watchCommand`, `WatchOptions`,
  `startWatcher`, `Watcher`, `WatcherEvent`, `WatcherOptions`.


### Added (PR 5.7.2 — `phub.lock`, the package-lock.json moment for AI cognition, ADR-0026)

The lockfile companion to `phub audit`. Stamps every classified
artifact's `(path, classification, digest, attestation-status)`
into a canonical JSON file (`.primitivehub/phub.lock`) committed to
the repo. CI compares the working tree against the lock; PR diffs
surface every change to the agent-context surface. Foundation for
`phub watch` (ADR-0027 planned) + `phub install` (ADR-0028 planned).

- `phub audit --check-lock` — compare the working tree against
  `.primitivehub/phub.lock` (or `--lock-path`). Exit 1 on drift OR
  scanner findings; exit 2 if the lock is missing or its
  `top10_version` differs from the current spec.
- `phub audit --update-lock` — write a fresh lock. Scanner findings
  do NOT block the write (the lock pins state, not verdicts).
- `phub audit --lock-only` — skip the scanner roster, only stamp
  the lock. Combined with `--json`, writes the canonical JSON to
  stdout instead of disk (CI-bootstrap path).
- `phub audit --lock-path <path>` — override auto-discovered
  location.
- Drift report (human) — added / modified / removed / reclassified
  categories with short-digest display. JSON output adds a `lock`
  object with `mode`, `path`, `hasDrift`, and the full `drift`
  breakdown.
- **Reproducibility** — re-stamping the lock against an unchanged
  working tree produces a byte-identical file. No timestamps;
  alphabetical keys at every level; lexicographic artifact sort.
  Unit-tested in `test/audit-lock.test.ts`.
- Programmatic exports: `lockFromAudit`, `serializeLock`,
  `parseLock`, `readLock`, `writeLock`, `diffLock`, `isLockDrifted`,
  `LockParseError`, `LOCK_VERSION`, `LOCK_TOP10_VERSION`,
  `LOCK_GENERATOR`, `LOCK_SCHEMA_URL`, and the `PhubLock` /
  `LockedArtifact` / `LockDrift` / `LockAttestation` types.
- New tests: `test/audit-lock.test.ts` (19 unit tests covering
  format + diff + reproducibility); extended end-to-end coverage
  in `test/audit.test.ts` (12 new CLI tests covering all four lock
  flags + their interactions).

The lockfile is the AV-product-family equivalent of the
**boot-time integrity check** ([ADR-0030 § 3](../../docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md)).
*Before this project runs an agent against any of these primitives,
prove the cognition hasn't changed since I last reviewed it.*

### Added (PR 5.7.1 — the Samurai Cut, ADR-0025)

The first **active surface**. `phub` now defends a whole project, not
just a file you remembered to point it at.

- `phub audit [<path>]` — walks the project, classifies every
  agent-context artifact (AGENTS.md / CLAUDE.md / `.cursorrules` /
  `.windsurfrules` / `.aider.conf.yml` / `.github/copilot-instructions.md`
  / `.claude/skills|agents|commands/**` / `.cursor/rules/**` /
  `**/primitives/**` / `**/skills/**` / `**/SKILL.md` /
  `**/prompts/**` / `**/mcp.json`), digests each file (SHA-256), and
  runs the existing T1/T2/T5 detector roster on the text-scannable
  classes. `mcp-config` is classified-but-not-scanned in v0.1 (its
  detector family lands in a future PR). Default path is
  `process.cwd()`.
- `phub audit --sarif` — multi-file SARIF 2.1.0 aggregate that
  composes with the existing `actions/phub-scan/` GitHub Action.
- `phub audit --json` — machine-readable inventory + per-artifact
  digest + verdicts + summary; foundation for the planned `phub.lock`
  (future ADR-0026).
- `phub audit --detector=<id>`, `--strict`, `--no-fail`,
  `--allow-fail=<id>`, `--policy <path>`, `--max-files=<n>`,
  `--max-depth=<n>` — same flag vocabulary as `phub scan`, plus
  walker bounds.
- Walker discipline (per ADR-0025): skips `node_modules/`, `.git/`,
  `dist/`, `build/`, `.next/`, `coverage/`, `target/`,
  `__pycache__/`, `venv/`, `.venv/`, `.tox/`, `.pytest_cache/`,
  `.cache/`, and dot-prefixed directories other than `.claude/`,
  `.cursor/`, `.github/`. Does NOT follow symlinks. Depth ≤ 12 and
  file count ≤ 5000 by default (both overridable).
- Programmatic exports: `runAudit`, `auditCommand`, `classify`,
  `isTextScannable`, `walk`, `sha256Hex`, `sha256Ref`,
  `ARTIFACT_CLASSES`, `renderAuditHumanReport`,
  `renderSarifForArtifacts`, and the `AuditResult` /
  `AuditedArtifact` / `AuditSummary` / `ArtifactClass` /
  `WalkOptions` / `WalkResult` types.
- New tests: `test/audit-classifier.test.ts`,
  `test/audit-walker.test.ts`, `test/audit.test.ts`.

`phub audit` introduces no new detectors. It is an orchestration
surface over the existing scanner kernel — the detector-parity rule
(ADR-0023) is therefore unchanged. PRs 5.7.2 (`phub.lock`), 5.7.3
(`phub watch`), 5.7.4 (`phub install`), and 5.7.5 (MCP runtime gate)
build on this foundation under their own ADRs (0026–0029).

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
