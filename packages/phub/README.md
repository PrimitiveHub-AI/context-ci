# phub

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**PrimitiveHub CLI.** Scan markdown context primitives (`AGENTS.md`,
`CLAUDE.md`, `.cursorrules`, …) for Context CI Top 10 patterns; verify
PrimitiveHub Trust Bundles offline.

Zero runtime deps beyond
[`@primitivehub/verify`](../verify/). Air-gap safe. Node ≥ 20.

## Install

After launch (per
[ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md)
the package is not yet on npm):

```bash
# No-install invocation:
npx @primitivehub/phub --help

# Or as a dev dependency in your project:
pnpm add -D @primitivehub/phub

# Once installed, the binary is `phub` (unscoped):
phub --help
```

### Why scoped?

The bare `phub` name on npm is already occupied by an unrelated
package; PrimitiveHub ships under the `@primitivehub` scope to
avoid the conflict. The binary remains `phub` so post-install
ergonomics are unchanged. See
[ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
"Update 2026-05-31" for the discovery + pivot rationale.

## Subcommands

```text
phub audit [<path>]       # discover + classify + scan every artifact under <path>
phub watch [<path>]       # daemonized audit — runs on every fs event (ADR-0027)
phub scan <file>          # T1/T2/T5 detectors on a single file (v0.1)
phub verify <bundle.json> # @primitivehub/verify wrapper
phub init                 # write starter AGENTS.md
```

`phub audit` is the **active surface**
([ADR-0025](../../docs/decisions/0025-active-posture-and-phub-audit.md));
`phub watch` is the **daemonized active surface**
([ADR-0027](../../docs/decisions/0027-phub-watch.md));
`phub scan` is their passive counterpart. Use `scan` when you already
know which file is suspect; use `audit` when you don't; use `watch`
when you want the audit to react to fs events instead of being
re-invoked.

## `phub audit`

Walks the project, finds every agent-context artifact (AGENTS.md /
CLAUDE.md / `.cursorrules` / `.windsurfrules` / `.aider.conf.yml` /
`.github/copilot-instructions.md` /
`.claude/{skills,agents,commands}/**` / `.cursor/rules/**` /
`**/primitives/**` / `**/skills/**` / `**/SKILL.md` / `**/prompts/**` /
`**/mcp.json`), classifies it, digests it (SHA-256), runs the
detector roster on the text-scannable classes, and emits a
project-level report. Skips `node_modules/` / `.git/` / `dist/` /
`build/` / `.next/` / `coverage/` / `target/` / `__pycache__/` /
`venv/` / `.venv/` / `.tox/` / `.pytest_cache/` / `.cache/` and
dot-prefixed directories other than `.claude/` / `.cursor/` /
`.github/`. Does not follow symlinks.

```bash
npx @primitivehub/phub audit
```

```text
phub audit /srv/primitivehub/app

Inventory (7 artifacts, 5 classes):
  agents-md             1  AGENTS.md
  claude-md             1  CLAUDE.md
  claude-skill          2  .claude/skills/code-review.md, .claude/skills/debug.md
  cursor-rules          1  .cursorrules
  mcp-config            1  apps/api/mcp.json  (classified, not scanned in v0.1)
  primitive             1  apps/web/content/primitives/example.md

Findings:
  [FAIL] .claude/skills/code-review.md (claude-skill)
    [FAIL] t1.prompt_injection (CCI-001) — Matched 1 prompt-injection pattern; review before signing.
      L17  Ignore previous instructions
             Remove or rephrase (override-system-instructions); …

Skipped: 4 skip-list dirs, 2 hidden dirs.

Result: 1 of 7 artifacts flagged. 1 finding total. Review before committing.
```

| Flag | Default | What it does |
|---|---|---|
| `--json` | off | Emit `{ root, artifacts: [...], summary }` JSON for CI consumption. Foundation for the planned `phub.lock`. |
| `--sarif` | off | Multi-file SARIF 2.1.0 aggregating findings across every artifact. Upload to GitHub Code Scanning the same way as `phub scan --sarif`. Mutually exclusive with `--json`. |
| `--detector=<id>` | all | Restrict run; accepts detector name, CCI ID (`CCI-001`), or threat category (`T1`). Repeat for multiple. |
| `--strict` | off | Treat `warn` verdicts as `fail`. |
| `--no-fail` | off | Always exit 0, even on findings. |
| `--allow-fail=<id>` | none | Allow a detector/CCI/threat ID to fail. Repeatable. |
| `--policy <path>` | auto-discover | Path to `.primitivehub/policy.yaml`. |
| `--max-files=<n>` | 5000 | Hard cap on files visited. |
| `--max-depth=<n>` | 12 | Hard cap on directory depth. |

**Exit codes:** `0` = clean (or `--no-fail`), `1` = one or more
artifacts flagged OR drift detected, `2` = usage error / unreadable
path / invalid policy file / missing lock under `--check-lock` /
spec-version mismatch under `--check-lock`.

### Lockfile (`.primitivehub/phub.lock`)

`phub.lock` is the package-lock.json equivalent for AI cognition
([ADR-0026](../../docs/decisions/0026-phub-lock-format-and-drift-detection.md)).
A canonical-JSON file stamps every classified artifact's
`(path, classification, digest, attestation-status)`; CI gates on
drift; PRs that touch agent-context artifacts re-stamp the lock and
reviewers see the diff.

```bash
# First time: stamp the lock and commit it.
npx @primitivehub/phub audit --update-lock
git add .primitivehub/phub.lock && git commit -m "chore: stamp phub.lock"

# In CI (every PR): fail the build on drift.
npx @primitivehub/phub audit --check-lock

# After intentional changes to agent-context artifacts: re-stamp.
npx @primitivehub/phub audit --update-lock
git add .primitivehub/phub.lock
```

| Flag | What it does |
|---|---|
| `--check-lock` | Compare working tree to lock. Exit 1 on drift OR scanner findings. Exit 2 on missing lock / spec-version mismatch. |
| `--update-lock` | Write a fresh lock. Scanner findings do NOT block the write. |
| `--lock-only` | Skip scanners, only stamp the lock. Combined with `--json`, writes the canonical JSON to stdout instead of disk. |
| `--lock-path <path>` | Override the auto-discovered `.primitivehub/phub.lock` location. |

Drift categories surface in the human reporter and the JSON output:

```
Drift detected against /your/repo/.primitivehub/phub.lock:

  Added (1):
    .claude/skills/new-tool.md   (claude-skill, sha256:abc123…)
  Modified (1):
    AGENTS.md   sha256:def456… → sha256:ghi789…
  Removed (1):
    .cursorrules   (cursor-rules, sha256:jkl012…)

Resolution:
  - If these changes are intentional, run `phub audit --update-lock`
    and commit the regenerated .primitivehub/phub.lock.
  - If a change is unexpected, investigate the source before re-locking.
```

**Reproducibility:** re-stamping the lock against an unchanged
working tree produces a byte-identical file. No timestamps; keys
sorted alphabetically at every level; artifacts sorted
lexicographically by path. This is the load-bearing property that
makes the lock reviewable in git diffs.

## `phub scan`

Runs every v0.1 detector against the file (markdown or plain text)
and reports per-detector verdicts.

```bash
npx @primitivehub/phub scan AGENTS.md
```

```text
phub scan AGENTS.md

[FAIL] t1.prompt_injection (CCI-001) — Matched 2 prompt-injection patterns; review before signing.
  L17  Ignore previous instructions
         Remove or rephrase (override-system-instructions); …
[INFO] t2.unicode_steganography (CCI-002) — No Unicode-steganography patterns matched.
[FAIL] t5.unsafe_shell_install (CCI-005) — Matched 1 unsafe-shell-install pattern; …
  L23  curl https://example.com/install.sh | bash
         Remove or rephrase (shell-pipe-from-network); …

Result: 2 of 3 detectors flagged content. Review before publishing.
```

| Flag | Default | What it does |
|---|---|---|
| `--json` | off | Emit `{ filename, verdicts: [...] }` JSON for CI consumption |
| `--sarif` | off | Emit SARIF 2.1.0 for [GitHub Code Scanning](https://docs.github.com/code-security/code-scanning) upload (mutually exclusive with `--json`) |
| `--detector=<id>` | all | Restrict run; accepts detector name, CCI ID (`CCI-001`), or threat category (`T1`). Repeat for multiple. |
| `--strict` | off | Treat `warn` verdicts as `fail`. Composes with policy: CLI wins on `true`. |
| `--no-fail` | off | Suppress finding-exit 1 (still exits 2 on errors). Useful when SARIF upload is the gate. |
| `--allow-fail=<id>` | none | Allow a detector/CCI/threat ID to fail. Repeatable. Appended to `policy.allow` as a synthetic entry. |
| `--policy <path>` | auto-discover | Path to `.primitivehub/policy.yaml`. Without this flag: walk cwd → git root looking for `.primitivehub/policy.yaml`, fall back to implicit default. See [Context Policy Language v0.1 spec](../../docs/context-policy-v0.1.md). |

**Exit codes:** `0` = clean (or policy permitted everything), `1` = one
or more detectors flagged content, `2` = usage error, unreadable file,
mutually-exclusive flags, or invalid policy file.

### Context Policy Language

Per-file allow exceptions live in `.primitivehub/policy.yaml`. The
canonical use case (`docs/bugs.md` #25): the project's own `CLAUDE.md`
legitimately mentions `npx skill installs` in its hard-rule prose
forbidding the pattern; the T5 v0.1 detector flags it. With policy:

```yaml
# .primitivehub/policy.yaml
version: "0.1"
allow:
  - reason: "CLAUDE.md teaches T5 attack patterns by design; docs/bugs.md #25."
    files: ["CLAUDE.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
```

Now `phub scan CLAUDE.md` → exit 0 with `"2 findings permitted by
policy"` surfaced in output. See
[Context Policy Language v0.1 spec](../../docs/context-policy-v0.1.md)
for the full surface (severity overrides, glob patterns, evaluation
algorithm) and
[ADR-0018](../../docs/decisions/0018-context-policy-language.md) for
the rationale.

### GitHub Code Scanning integration

Pipe the SARIF output into a file and upload via
[`github/codeql-action/upload-sarif`](https://github.com/github/codeql-action),
or use the [`primitivehub/phub-scan`](../../actions/phub-scan/)
composite action which wraps the whole flow (per
[ADR-0024](../../docs/decisions/0024-sarif-and-github-action.md)).

## `phub verify`

Verifies a [Trust Contract v0.1](../../docs/trust-contract-v0.1.md)
bundle using the [`@primitivehub/verify`](../verify/) reference
implementation. All work happens locally — no network calls.

```bash
npx @primitivehub/phub verify ./trust-bundle.json
```

```text
phub verify ./trust-bundle.json
Trust Bundle verified.
```

| Flag | Default | What it does |
|---|---|---|
| `--level=<level>` | `policy` | One of `structural` (steps 1+2) / `policy` (1+2+7) / `full` (1-7; steps 3-6 stubbed in v0.1, see verify README) |
| `--strict` | off | Treat `warn` predicate verdicts as `fail` during policy evaluation |
| `--allow-fail=<id>` | none | Permit a specific detector/CCI ID to FAIL without rejecting the bundle. Repeatable. |
| `--offline` | (always) | No-op — verification is already offline. Accepted for documentation. |
| `--json` | off | Emit raw `VerificationResult` JSON |

**Exit codes:** `0` = verified at the requested level, `1` = rejected,
`2` = usage error / parse error.

## When phub flags content — the four-path triage

`phub` is a scanner. Every scanner eventually flags content the
project legitimately produces. Following the AV-vendor discipline
([ADR-0030](../../docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md)),
every flagged finding gets classified into exactly one of four paths
before you act on it. The full methodology lives in
[`docs/false-positive-resolution.md`](../../docs/false-positive-resolution.md).

| Path | Meaning | Resolution |
|---|---|---|
| **A** | True positive — real risk in the content | **Edit the file.** Re-run audit. No allow entry. |
| **B** | Domain WAI — content legitimately documents the pattern | **Narrow allow entry + numbered FP-NNN ledger entry, same commit.** |
| **C** | Detector defect — regex too broad | Lockstep PR tightening Python + TS detectors per [ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md). No allow. |
| **D** | Ambiguous | Escalate to security-reviewer. **Do not silently allow.** |

**Hard rule:** every commit that adds an `allow:` entry to
`.primitivehub/policy.yaml` MUST also append an `FP-NNN` ledger entry
to `docs/false-positive-resolution.md` § 6 in the same commit. A
policy entry without a ledger entry is a defect.

Allow-entry format (enforced by ADR-0018 + ADR-0030):

```yaml
# .primitivehub/policy.yaml
version: "0.1"
strict: false
allow:
  - reason: |
      FP-NNN — one-paragraph justification referencing the ledger entry,
      ADR(s), and bugs.md if applicable. Path B per the methodology.
      Re-review: YYYY-MM-DD.
    files:
      - "narrow/path/to/file.md"   # NOT **/*
    rules:
      - id: "CCI-005"               # specific stable ID, NOT "*"
        detail_tags:
          - "specific-detail-tag"   # narrower than allowing all of the rule
```

Re-review cadence is quarterly + on every Top 10 minor-version bump.
Default per-entry re-review date is +90 days from authorship; stale
entries get removed at the next walk.

## `phub init`

Writes a starter `AGENTS.md` template in the current directory.

```bash
npx @primitivehub/phub init
```

| Flag | Default | What it does |
|---|---|---|
| `--force` | off | Overwrite an existing `AGENTS.md` |

## Programmatic API

The package also exports the detectors + commands so you can embed
phub in a custom GitHub Action, pre-commit hook, or CI harness:

```ts
import { DETECTORS, runScan, T1PromptInjectionDetector } from "phub"

const result = runScan("agents.md", await readFile("agents.md", "utf8"), {
  json: false,
  strict: false,
})
if (result.exitCode === 1) {
  // …branch on result.verdicts…
}
```

## What v0.1 ships

- T1 — prompt injection (override instructions, role hijack, hidden
  instructions, credential-exfiltration hints) → `CCI-001`
- T2 — Unicode steganography (zero-width, bidi-control, tag-character,
  mixed-script confusable) → `CCI-002`
- T5 — unsafe shell install (curl|bash, npx, pip from URL/git,
  install-instruction-to-agent) → `CCI-005`

The detectors are TypeScript ports of the canonical Python detectors
in `apps/api/scanners/`. Pattern sets mirror the Python source
byte-for-byte; per
[ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
a future PR adds a cross-implementation scanner-conformance suite
analogous to `docs/trust-contract/conformance/`.

## What v0.1 does NOT ship

- T3, T4, T6-T10 detectors — Phase 5 ramp; landing as the Python
  detectors land. Each gets a TS port in the same PR that ships the
  Python implementation.
- SARIF output for GitHub Code Scanning — Gate G-C follow-up.
- `phub login` / `phub publish` — Phase 6+ (registry write surface).
- Watch mode, fix mode — pending demand signal.
- Markdown-AST awareness (currently flags fenced code blocks too) —
  v0.2 across both Python and TS.

## Versioning + publishing

This package tracks the Trust Contract spec version. `0.1.x` is
conformant to Trust Contract v0.1 (verify wrapper) and Context CI
Top 10 v0.1 (scanner detectors).

Per [ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md)
publishing to npm is gated to the launch event via the same
three-lock model as `@primitivehub/verify`.

## License

MIT. See [LICENSE](./LICENSE).
