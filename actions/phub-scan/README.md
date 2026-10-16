# PrimitiveHub Context CI scan (GitHub Action)

Composite GitHub Action that runs [`@primitivehub/phub`](../../packages/phub/)
across your repo's agent-context files (`AGENTS.md`, `CLAUDE.md`,
`.cursorrules`, etc.) and uploads SARIF findings to GitHub Code
Scanning. Findings appear on PR diffs alongside CodeQL / Semgrep /
Snyk results.

## Why this exists

Your AI agent reads `AGENTS.md` and obeys it. If that file contains
prompt-injection patterns, hidden Unicode, or "curl | bash" install
instructions, the agent executes them silently. Context CI Top 10
catalogues these patterns; this Action runs them on every PR.

Per [ADR-0023](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
this Action is the GitHub-native delivery surface for the same detector
roster — all ten Context CI Top 10 categories (CCI-001…010) — that the
`phub` CLI and the server-side Context CI pipeline run.

## Two modes

| `mode` | What runs | Blocks the PR on | Produces |
|---|---|---|---|
| `scan` (default) | Per-file Top 10 scan | Scanner findings (`fail-on-findings`) | SARIF → Code Scanning |
| `gate` | `phub verify-before-load` — the inline Context Firewall | **Tamper, drift, scanner findings** (block-tier); optionally unsealed | Pass/fail verdict |

`gate` mode runs the exact same composite gate as the `phub
verify-before-load` CLI command and the MCP `verify_before_load` tool —
one firewall, three transports. It refuses-by-default: an artifact that
was tampered after sealing (digest drift), triggers a Top 10 detector,
or (with `require-attestation`) lacks an attestation is **BLOCKED** and
fails the job. Unsealed-only artifacts fail too unless you set
`allow-unsealed: 'true'`.

## Usage — scan mode (SARIF → Code Scanning)

Add to `.github/workflows/scan.yml`:

```yaml
name: phub Context CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write   # required for SARIF upload to Code Scanning

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: primitivehub/context-ci/actions/phub-scan@v0.1.0
        with:
          files: 'AGENTS.md CLAUDE.md .cursorrules'
          fail-on-findings: 'true'
```

PRs with findings appear in the **Security → Code scanning** tab and
inline on the PR diff. Click any finding for the rule docs at
`primitivehub.ai/top-10#CCI-NNN`.

## Usage — gate mode (the inline Context Firewall)

Block any PR that tampers with, drifts, or poisons your agent-context
files. No `security-events` permission needed — the gate is a pass/fail
check, not a SARIF upload:

```yaml
name: Context Firewall

on: [pull_request]

permissions:
  contents: read

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: primitivehub/context-ci/actions/phub-scan@v0.1.0
        with:
          mode: 'gate'
          files: 'AGENTS.md CLAUDE.md .cursorrules'
          allow-unsealed: 'false'   # require sealed artifacts; flip to 'true' while adopting
```

The step fails (exit 1) the moment any listed artifact is BLOCKED, with
the reason codes in the step log.

## Inputs

| Input | Default | What it does |
|---|---|---|
| `mode` | `scan` | `scan` (Top 10 → SARIF) or `gate` (`verify-before-load` pass/fail firewall). |
| `files` | `AGENTS.md CLAUDE.md` | Space-separated paths to scan/gate. Each is resolved relative to `$GITHUB_WORKSPACE` so SARIF URIs are repo-relative. |
| `allow-unsealed` | `false` | **Gate mode.** Pass unsealed (posture-only) artifacts with a warning instead of failing. Block-tier signals still fail. |
| `require-attestation` | `false` | **Gate mode.** Treat an `unattested` lock entry as a block-tier failure (for registry primitives). |
| `sarif-directory` | `phub-sarif` | **Scan mode.** Where per-file SARIF outputs land (one `.sarif` per scanned file). |
| `upload-sarif` | `true` | **Scan mode.** Upload SARIF to GitHub Code Scanning via `github/codeql-action/upload-sarif`. |
| `fail-on-findings` | `true` | **Scan mode.** Fail the workflow when any detector flags content. Set `false` to make Code Scanning the gate without blocking merge. |
| `phub-source` | `npm` | Where to install phub from: `npm` (default) or `local` (monorepo-only). |
| `phub-version` | `latest` | When `phub-source=npm`, the version to install. Pin in production. |

## Outputs

| Output | What it is |
|---|---|
| `sarif-directory` | Scan mode: path to the directory with per-file SARIF outputs (for downstream archival). |
| `findings-count` | Scan mode: total SARIF results across all scanned files; `0` = clean. |
| `blocked` | Gate mode: `'true'` if any artifact was BLOCKED, else `'false'`. |

## Required workflow permissions

```yaml
permissions:
  contents: read
  security-events: write   # SARIF upload
```

If you set `upload-sarif: 'false'`, you can drop `security-events: write`.

## Behavior on findings

- **Default** (`fail-on-findings: 'true'`): the workflow step exits
  non-zero when any detector flags content. Use this when you want
  Context CI verdicts to BLOCK merging.
- **Report-only** (`fail-on-findings: 'false'`): the step always exits
  zero (unless phub itself errors). Findings still appear in Code
  Scanning; merging is not blocked. Good for adopting Context CI
  on existing repos without immediately failing every PR.

## Install source

By default the Action installs `@primitivehub/phub` from npm
(`phub-source: 'npm'`; pin `phub-version` in production). The
`phub-source: 'local'` path builds phub from an in-tree monorepo checkout
instead — used by
[`.github/workflows/phub-scan-demo.yml`](../../.github/workflows/phub-scan-demo.yml)
to exercise the full Action shape (install → scan → SARIF upload) in CI
without depending on the registry.

## Coverage & supply-chain hardening (PH-SEC-009)

Two defaults trade safety for convenience — tighten them for production:

**1. Enumerated `files` can miss context the agent will still load.**
The default `files: 'AGENTS.md CLAUDE.md'` only scans what you list. A
`.cursorrules`, `.github/copilot-instructions.md`, a `**/SKILL.md`, or a
`**/primitives/**` file that an agent *does* read won't be scanned unless
you name it. For real coverage, discover the whole workspace instead of
enumerating:

```yaml
# scan EVERY classified agent-context artifact, fail on drift vs the lock:
- run: npx @primitivehub/phub@0.1.3 audit . --check-lock
```
(`phub audit` is the active surface — it finds and classifies every
agent-context file, not just two. See the CLI reference § `audit`.)

**2. `phub-version: 'latest'` is mutable.** `latest` silently moves, so a
compromised or yanked release changes what runs in your pipeline and breaks
reproducibility. For production:
- **Pin `phub-version`** to an exact version (e.g. `0.1.3`), not `latest`.
- **Pin the action itself to a commit SHA**, not a moving tag:
  `uses: primitivehub/context-ci/actions/phub-scan@<40-char-sha>`.
- Prefer `npm ci` / an integrity-checked install over an unpinned global
  install when you vendor the CLI yourself.

**3. Sealing ≠ approval.** Never run `--update-lock` / `--lock-only` in the
gate job (see the lock docs § Security) — the admission pipeline verifies a
*committed* lock, it doesn't write one, and it must fail on scanner findings
even when the lock is drift-clean.

## License

MIT. See [LICENSE](../../LICENSE) (project-wide).
