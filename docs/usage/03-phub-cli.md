# 2. `phub` CLI Reference

> [← back to index](./README.md) · prev: [Getting started](./01-getting-started.md) · next: [Context Policy →](./03-context-policy.md)

Complete reference for every `phub` subcommand and flag.

**Synopsis:**

```
phub <command> [options] [args]

Commands:
  scan <file>        Scan one file for Context CI Top 10 patterns
  audit [dir]        Discover + classify + scan every artifact in a tree
  verify <bundle>    Verify a Trust Bundle
  init               Write a starter AGENTS.md
  help [command]     Show help (general or per-command)
  version            Print version

Exit codes:
  0   success (or policy permitted everything)
  1   findings flagged content / verification failed / lock drift
  2   usage error / unreadable file / invalid policy / invalid lock
```

---

## Table of contents

- [`scan`](#scan)
- [`audit`](#audit)
- [`verify`](#verify)
- [`init`](#init)
- [`help` / `version`](#help--version)
- [Global flags](#global-flags)
- [Exit codes — full table](#exit-codes--full-table)

---

## `scan`

Run the v0.1 detector roster (T1 / T2 / T5) against a single file.

```
phub scan <file> [--json | --sarif] [--policy <path>] [--strict]
                 [--allow-fail=<id>...] [--detector=<id>...]
                 [--no-fail]
```

### Quick start

```bash
phub scan AGENTS.md
# Human-readable output. Exit 0 on clean, 1 on findings, 2 on error.
```

### Flags

| Flag | Default | What it does |
|---|---|---|
| `--json` | off | Emit machine-readable JSON. Includes `policySource`, `policyAllowed`, `summary`. |
| `--sarif` | off | Emit SARIF 2.1.0 for GitHub Code Scanning. Mutually exclusive with `--json`. See [GitHub Action](./05-github-action.md). |
| `--detector=<id>` | all | Restrict to one detector. May be repeated. Accepts detector name (`t1.prompt_injection`), CCI ID (`CCI-001`), threat category (`T1`). |
| `--strict` | off | Treat `warn` verdicts as `fail` for exit code. Composes with policy: CLI wins on `true`. |
| `--no-fail` | off | Suppress finding-exit 1 (preserves error-exit 2). Useful when SARIF upload is the real gate. |
| `--allow-fail=<id>` | none | Allow a detector/CCI/threat ID to FAIL. Repeatable. Appended to `policy.allow` as a synthetic entry. |
| `--policy <path>` | auto-discover | Path to `.primitivehub/policy.yaml`. Without this: walk cwd → git root for `.primitivehub/policy.yaml`, else implicit default. See [Context Policy](./03-context-policy.md). |

### Examples

**Scan a single file, human output:**

```bash
phub scan ./AGENTS.md
```

**Scan and emit JSON for a CI tool:**

```bash
phub scan ./AGENTS.md --json | jq '.verdicts[] | {cciId, passed}'
```

**Scan only for prompt-injection (T1):**

```bash
phub scan ./AGENTS.md --detector=CCI-001
```

**Scan with a policy file — suppress documented FPs:**

```bash
phub scan ./CLAUDE.md --policy .primitivehub/policy.yaml
```

**Scan in CI, upload SARIF, never fail the step:**

```bash
phub scan ./AGENTS.md --sarif --no-fail > ./agents.sarif
# upload-sarif via github/codeql-action/upload-sarif
```

### Output — human mode

```text
phub scan AGENTS.md

[INFO] t1.prompt_injection (CCI-001) — No prompt-injection patterns matched.
[INFO] t2.unicode_steganography (CCI-002) — No Unicode-steganography patterns matched.
[FAIL] t5.unsafe_shell_install (CCI-005) — Matched 1 unsafe-shell-install pattern; this is the Shai-Hulud supply-chain vector.
  L23  curl https://example.com/install.sh | bash
         Remove or rephrase (shell-pipe-from-network); …

Result: 1 of 3 detectors flagged content. Review before publishing.

  1 finding permitted by policy (.primitivehub/policy.yaml):
    [CCI-005] FP-005 — example install command in docs/howto/setup.md
```

### Output — `--json` mode

```json
{
  "filename": "AGENTS.md",
  "policySource": ".primitivehub/policy.yaml",
  "verdicts": [
    {
      "detectorName": "t5.unsafe_shell_install",
      "threatCategory": "T5",
      "cciId": "CCI-005",
      "severity": "fail",
      "passed": false,
      "summary": "Matched 1 unsafe-shell-install pattern; …",
      "detectorVersion": "0.1.0",
      "diffHints": [
        {
          "line": 23,
          "snippet": "curl https://example.com/install.sh | bash",
          "suggestion": "Remove or rephrase (shell-pipe-from-network); …",
          "detailTag": "shell-pipe-from-network"
        }
      ]
    }
  ],
  "policyAllowed": [],
  "summary": {
    "suppressedFindingsCount": 0,
    "survivingFailVerdicts": 1,
    "survivingWarningVerdicts": 0,
    "survivingNoteVerdicts": 0,
    "fullySuppressedVerdicts": 0
  }
}
```

---

## `audit`

Active-surface command. Recursively discovers, classifies, and scans
every agent-context artifact under a directory. The default
defensive posture per [ADR-0025](../decisions/0025-active-posture-and-phub-audit.md).

```
phub audit [dir] [--json | --sarif] [--policy <path>] [--strict]
                 [--allow-fail=<id>...] [--detector=<id>...]
                 [--check-lock | --update-lock | --lock-only]
                 [--lock-path <path>]
                 [--max-files <N>] [--max-depth <N>]
```

`dir` defaults to `process.cwd()`.

### Artifact classes (v0.1)

| Class | Match patterns |
|---|---|
| `agents-md` | `AGENTS.md`, `**/AGENTS.md` |
| `claude-md` | `CLAUDE.md`, `**/CLAUDE.md` |
| `cursor-rules` | `.cursorrules`, `.cursor/rules/**/*.md*` |
| `windsurf-rules` | `.windsurfrules` |
| `aider-config` | `.aider.conf.yml`, `.aiderignore` |
| `copilot-instructions` | `.github/copilot-instructions.md` |
| `claude-skill` | `.claude/skills/**/*.md` |
| `claude-agent` | `.claude/agents/**/*.md` |
| `claude-command` | `.claude/commands/**/*.md` |
| `primitive` | `**/primitives/**/*.md` |
| `skill` | `**/skills/**/*.md`, `**/SKILL.md` |
| `prompt` | `**/prompts/**/*.md` |
| `mcp-config` | `**/mcp.json`, `**/*.mcp.json` |

See [ADR-0025 § Discovery scope](../decisions/0025-active-posture-and-phub-audit.md) for the
authoritative classification list. Adding a class is a versioned
change (lockstep with the Top 10 spec).

### Examples

**Audit the current directory:**

```bash
phub audit
```

**Audit a specific subtree:**

```bash
phub audit ./apps/web
```

**Audit + emit SARIF for Code Scanning:**

```bash
phub audit . --sarif > ./audit.sarif
```

**Audit only `claude-skill` classifications (filter not currently
implemented at audit level; use the recipe in [§ 08-recipes](./08-recipes.md)
for the workflow).**

**Cap traversal depth and file count (CI safety):**

```bash
phub audit . --max-depth 8 --max-files 500
```

### Output — human mode (excerpt)

```text
phub audit /srv/primitivehub/app

  20 artifacts discovered:
    claude-md       1   CLAUDE.md
    primitive      18   apps/web/content/primitives/*.md
    skill           1   apps/web/content/skills/SKILL.md

  Findings (post-policy):
    [CLEAN] All 20 artifacts pass current policy.

  Lock: not checked. Pass --check-lock or --update-lock.

Result: 20/20 artifacts clean.
```

### `--check-lock`, `--update-lock`, `--lock-only`

See [§ phub.lock](./04-phub-lock.md) for the full lockfile workflow.
Brief summary:

- `--check-lock`: compare working tree to `.primitivehub/phub.lock`;
  exit 1 on drift OR scanner findings; exit 2 if lock missing or
  spec-version mismatch.
- `--update-lock`: write a fresh lock (scanner findings do NOT block).
- `--lock-only`: skip scanners; stamp the lock only. With `--json`,
  writes the canonical JSON to stdout instead of disk (CI bootstrap).

These three are mutually exclusive at CLI parse time.

---

## `watch`

Daemonized active-surface command. Runs an initial audit, then
reacts to filesystem events. Per [ADR-0027](../decisions/0027-phub-watch.md)
this is the "on-access guard" row of the AV-product-family map
([ADR-0030 § 3](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)).

```
phub watch [dir] [--once] [--debounce <ms>] [--policy <path>]
                 [--strict] [--allow-fail=<id>...] [--detector=<id>...]
                 [--max-files <N>] [--max-depth <N>]
                 [--max-runtime-sec <N>] [--json]
                 [--quarantine]
```

`dir` defaults to `process.cwd()`.

### Modes

| Mode | What it does |
|---|---|
| Default (daemon) | Initial audit + fs.watch + re-audit on each debounced event. Exits on SIGINT / SIGTERM. NDJSON or human output. |
| `--once` | Single audit + emit + exit. Same shape as `phub audit`, useful for tests. |

### Flags

| Flag | Default | What it does |
|---|---|---|
| `--once` | off | Single audit + exit (no fs.watch). |
| `--debounce <ms>` | `200` | Per-path debounce. Coalesces N rapid events on the same path into one emit. |
| `--max-runtime-sec <N>` | none | Exit cleanly after N seconds. Daemon mode only; tests + CI helper. |
| `--quarantine` | off | v0.1 marker only — real file moves land in v0.2. |
| `--json` | off | Emit NDJSON event stream (one JSON object per line). |

All audit flags (`--policy`, `--strict`, `--allow-fail`,
`--detector`, `--max-files`, `--max-depth`) work identically. SARIF
is NOT supported (NDJSON is the streaming format).

### NDJSON event kinds

| Kind | When | Payload |
|---|---|---|
| `started` | First emit; carries initial audit summary | `{root, mode, policySource, artifactCount, flaggedCount}` |
| `ready` | After watcher attaches (daemon only) | `{debounceMs, quarantine}` |
| `fs-event` | One debounced fs.watch event | `{path, rawKind, timestamp}` |
| `scanned` | After re-audit completes | `{flaggedCount, totalFindings, flagged: [...]}` |
| `warning` | Watcher error or audit warning | `{message}` |
| `shutdown` | Daemon stopping (signal or `--max-runtime-sec`) | `{signal, exitCode}` |

### Examples

**Smoke run on the current directory:**

```bash
phub watch --once
```

**Start a daemon emitting NDJSON; consume with jq:**

```bash
phub watch . --json | jq -c 'select(.kind == "scanned") | {flaggedCount: .payload.flaggedCount}'
```

**Time-bounded daemon (useful for CI):**

```bash
phub watch . --json --max-runtime-sec 600 > watch.ndjson
# Run for 10 minutes, emit every event to a file, exit cleanly.
```

**Filter to one classification family:**

```bash
phub watch . --detector=CCI-005
# Only re-emit T5 verdicts; everything else still classified + ignored.
```

### Exit codes

| Code | Daemon meaning | `--once` meaning |
|---|---|---|
| `0` | No re-audit during the daemon's lifetime produced a flagged verdict. | Initial audit was clean. |
| `1` | At least one re-audit produced a flagged verdict (sticky — does not revert). | Initial audit flagged ≥ 1 artifact. |
| `2` | Usage error / unreadable root / invalid policy. | Same. |

Daemon exit code is **monotonic** — once 1, stays 1. The daemon's
run is treated as "did anything dirty happen during this window?"
not "is the tree currently clean?"

### Output — human mode (excerpt)

```text
[watch] root=/my/project mode=daemon policy=/my/project/.primitivehub/policy.yaml artifacts=12 flagged=0
[watch] ready (debounce=200ms)
[watch] change: /my/project/AGENTS.md
[watch] scanned: 1 flagged artifact(s), 1 finding(s)
[watch] shutdown (SIGINT)
```

### Output — `--json` mode (one event per line)

```json
{"kind":"started","timestamp":"...","payload":{"root":"...","mode":"daemon","policySource":"...","artifactCount":12,"flaggedCount":0}}
{"kind":"ready","timestamp":"...","payload":{"debounceMs":200,"quarantine":false}}
{"kind":"fs-event","timestamp":"...","payload":{"timestamp":"...","path":"/my/project/AGENTS.md","rawKind":"change"}}
{"kind":"scanned","timestamp":"...","payload":{"flaggedCount":1,"totalFindings":1,"flagged":[{"path":"AGENTS.md","classification":"agents-md","digest":"...","verdicts":[{"cciId":"CCI-001","severity":"fail","summary":"..."}]}]}}
{"kind":"shutdown","timestamp":"...","payload":{"signal":"SIGINT","exitCode":1}}
```

### Platform notes

| Platform | Recursive watch | Notes |
|---|---|---|
| macOS | yes (FSEvents) | Full support. |
| Windows | yes (ReadDirectoryChangesW) | Full support. |
| Linux | yes if Node ≥ 20.6; else non-recursive fallback | Older Node emits a `warning` event but doesn't fail. |

For older Node on Linux, watch will see top-level changes only.
Upgrade Node, or pair with `phub audit --check-lock` in a periodic
cron as the fallback.

### Quarantine

`--quarantine` in v0.1 emits a marker in `ready` events but does NOT
move files. Real file-move semantics land in v0.2 behind a separate
ADR (restore protocol, metadata format, rename handling).

---

## `install`

Safe-install a context primitive. Replaces the T5 attack class
(`curl|bash`, `npx <pkg>`, `pip install <url>`) with a
**verify-then-write** pipeline. Per [ADR-0028](../decisions/0028-phub-install.md)
this is the fifth and final active surface from
[ADR-0025](../decisions/0025-active-posture-and-phub-audit.md).

```
phub install <slug@semver>      [--registry <base-url>]   # registry source
phub install --bundle <path>                              # local bundle
phub install --url <url>                                  # arbitrary HTTP source
   [common flags] [--install-dir <rel>] [--lock-path <path>] [--no-lock]
                  [--force] [--level=<level>] [--fetch-timeout-ms <N>] [--json]
```

### Three sources, mutually exclusive

| Source | Use case | Lock `attestation` |
|---|---|---|
| `phub install foo@1.0.0` | Default: fetch from a registry | `registry:foo@1.0.0` |
| `phub install --bundle ./b.json` | Local file (CI artifact, teammate hand-off) | `local:<absolute path>` |
| `phub install --url <url>` | Direct URL (custom hosting, dev sandbox) | `url:<URL>` |

Passing more than one → exit 2 with `AMBIGUOUS_SOURCE`. Passing none → exit 2 with `NO_SOURCE`.

### Pipeline

```text
1. Classify source                  → BundleSource
2. Fetch bundle JSON text
3. Parse JSON                       (BUNDLE_PARSE_ERROR on fail)
4. verifyBundle(bundle, {level})    (BUNDLE_REJECTED on fail)
5. Plan install target              (UNKNOWN_MEDIA_TYPE / UNSAFE_COMPONENT / PATH_TRAVERSAL)
6. Write bundle.content to disk     (ALREADY_INSTALLED unless --force)
7. Update .primitivehub/phub.lock   (skipped with --no-lock)
```

### Install layout

```
<workspace>/.primitivehub/installed/primitives/<slug>/<semver>/primitive.<ext>
```

The `primitives/` segment makes installed artifacts match the
existing audit classifier rule (`**/primitives/**`) so `phub audit
--check-lock` discovers them and detects drift on subsequent edits.

### Flags

| Flag | Default | What it does |
|---|---|---|
| `--registry <url>` | `https://registry.primitivehub.ai` | Override the registry for positional source. Required pre-launch. |
| `--bundle <path>` | — | Local Trust Bundle JSON file. |
| `--url <url>` | — | HTTP source. Any 2xx response is treated as bundle JSON. |
| `--install-dir <rel>` | `.primitivehub/installed/primitives` | Override the install root, relative to workspace. |
| `--lock-path <path>` | `<workspace>/.primitivehub/phub.lock` | Lock file to update. |
| `--no-lock` | off | Skip the lock-update step (ephemeral installs). |
| `--force` | off | Overwrite an existing install path. Without this, re-install fails with `ALREADY_INSTALLED`. |
| `--level=<level>` | `policy` | Verification depth (`structural` / `policy` / `full`). Same semantics as `phub verify`. |
| `--fetch-timeout-ms <N>` | `10000` | HTTP fetch timeout for `--url` / registry sources. |
| `--json` | off | Emit JSON instead of human-readable output. |

### Examples

**Install a local bundle into the current workspace:**

```bash
phub install --bundle ./team-bundle.json
# [install] source=bundle-path attestation=local:./team-bundle.json
# [install] subject=team-skill@1.2.3
# [install] verified at level=policy
# [install] wrote 4321 bytes → .primitivehub/installed/primitives/team-skill/1.2.3/primitive.md
# [install] lock updated: ./.primitivehub/phub.lock
```

**Install from a registry — the canonical safe-install ergonomics:**

```bash
phub install secure-code-review@1.0.0
# defaults --registry=https://registry.primitivehub.ai post-launch.
```

**Install + immediately audit-check the result:**

```bash
phub install --bundle ./b.json
phub audit --check-lock
# → "1/1 artifacts clean. Lock match: no drift." exit 0
```

**Try a bundle ephemerally (no lock side-effect):**

```bash
phub install --bundle ./b.json --no-lock --install-dir /tmp/sandbox
```

**Force-reinstall an existing version:**

```bash
phub install secure-code-review@1.0.0 --force
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Installed + (default) lock updated successfully. |
| `1` | Refused soft: `ALREADY_INSTALLED`. Pass `--force` to overwrite. |
| `2` | Source error / bundle rejected / writer safety refused / usage error. |

### Production-hygiene rule (per ADR-0028 § 5)

A CI-gated production project should **reject PRs that introduce
`local:*` or `url:*` attestations into the committed
`.primitivehub/phub.lock`**. Only `registry:<slug>@<semver>` (and
eventually `rekor:<log-index>`) should land on `main`. The `local:`
and `url:` prefixes are dev-mode escape hatches.

---

## `verify`

Verifies a [Trust Contract v0.1](../trust-contract-v0.1.md) bundle
using the [`@primitivehub/verify`](./07-verify-library.md) reference
implementation. All work happens locally — no network calls.

```
phub verify <bundle.json> [--level=<level>] [--strict]
                          [--allow-fail=<id>...] [--offline]
                          [--json]
```

### Flags

| Flag | Default | What it does |
|---|---|---|
| `--level=<level>` | `policy` | One of `structural` (steps 1+2) / `policy` (1+2+7) / `full` (1-7; steps 3-6 stubbed in v0.1, see [verify README](../../packages/verify/README.md)) |
| `--strict` | off | Treat `warn` predicate verdicts as `fail` during policy evaluation |
| `--allow-fail=<id>` | none | Allow a detector or CCI ID to FAIL without rejecting the bundle. Repeatable. |
| `--offline` | (always) | No-op — verification is already offline. Accepted for documentation. |
| `--json` | off | Emit raw `VerificationResult` JSON |

### Examples

**Verify a canonical valid bundle:**

```bash
phub verify ./trust-bundle.json
# → "Trust Bundle verified." exit 0
```

**Verify and inspect the result programmatically:**

```bash
phub verify ./trust-bundle.json --json | jq '{valid, level, failures: (.failures | length)}'
```

**Full verification (returns DEFERRED for v0.1 stubs):**

```bash
phub verify ./trust-bundle.json --level=full
# → DEFERRED failures for signature/cert/Rekor — by design in v0.1.
```

---

## `init`

Writes a starter `AGENTS.md` template into the current directory.

```
phub init [--force]
```

| Flag | Default | What it does |
|---|---|---|
| `--force` | off | Overwrite an existing `AGENTS.md` |

```bash
mkdir -p /tmp/new-project && cd /tmp/new-project
phub init
# → Wrote /tmp/new-project/AGENTS.md
cat AGENTS.md
```

The starter template includes commented-out sections for project
identity, conventions, hard rules — enough scaffolding to fill in.

---

## `help` / `version`

```bash
phub --help                 # general help
phub help scan              # per-command help
phub help audit
phub help verify
phub help init
phub --version              # → 0.1.0
phub version                # same
```

---

## Global flags

These flags work across multiple subcommands (each subcommand
documents which ones it accepts):

| Flag | Subcommands | Purpose |
|---|---|---|
| `--json` | scan, audit, verify | Machine-readable output |
| `--sarif` | scan, audit | SARIF 2.1.0 (mutually exclusive with `--json`) |
| `--strict` | scan, audit, verify | Promote warning → fail |
| `--no-fail` | scan, audit | Suppress finding-exit 1; preserve error-exit 2 |
| `--policy <path>` | scan, audit | Explicit policy file path |
| `--allow-fail=<id>` | scan, audit, verify | Repeatable allow-list |
| `--detector=<id>` | scan, audit | Repeatable detector filter |

---

## Exit codes — full table

| Code | Meaning | Where it comes from |
|---|---|---|
| `0` | Success / no findings / policy permitted everything | The clean path. |
| `1` | One or more detectors flagged content (post-policy), OR `verify` failed, OR `audit --check-lock` detected drift | The substantive "something is wrong" code. |
| `2` | Usage error / unreadable file / invalid JSON / invalid policy YAML / invalid lock format / spec-version mismatch / mutually-exclusive flags | The "the run never completed cleanly" code. |

`--no-fail` flips exit 1 → 0 but preserves exit 2.

---

## See also

- [Context Policy Language](./03-context-policy.md) — every flag interacts with policy
- [phub.lock](./04-phub-lock.md) — `--check-lock` / `--update-lock` flows
- [GitHub Action](./05-github-action.md) — wrapping `phub scan` / `phub audit` in CI
- [`packages/phub/README.md`](../../packages/phub/README.md) — package-level overview
- [ADR-0023 — phub CLI](../decisions/0023-phub-cli-and-detector-parity.md)
- [ADR-0025 — active surfaces + phub audit](../decisions/0025-active-posture-and-phub-audit.md)
- [ADR-0026 — phub.lock format + drift](../decisions/0026-phub-lock-format-and-drift-detection.md)
