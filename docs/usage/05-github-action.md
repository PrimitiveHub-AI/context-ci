# 5. GitHub Action — `primitivehub/phub-scan`

> [← back to index](./README.md) · prev: [phub.lock](./04-phub-lock.md) · next: [MCP server →](./06-mcp-server.md)

**Source:** [`actions/phub-scan/`](../../actions/phub-scan/)
**ADR:** [ADR-0024](../decisions/0024-sarif-and-github-action.md)

Composite GitHub Action that runs `phub` across agent-context files
on every PR and uploads findings to GitHub Code Scanning. Findings
appear inline on PR diffs alongside CodeQL / Semgrep / Snyk results.

---

## Table of contents

- [What it does](#what-it-does)
- [Minimum-viable workflow](#minimum-viable-workflow)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Required permissions](#required-permissions)
- [Behavior on findings](#behavior-on-findings)
- [Pre-launch invocation (monorepo)](#pre-launch-invocation-monorepo)
- [Examples](#examples)

---

## What it does

1. Installs `@primitivehub/phub` (from npm, or from a local monorepo
   build).
2. For each input file, runs `phub scan --sarif --no-fail` and writes
   one `.sarif` per file into a directory.
3. Uploads the directory to GitHub Code Scanning via
   [`github/codeql-action/upload-sarif@v3`](https://github.com/github/codeql-action).
4. Optionally fails the workflow step if any finding was emitted.

Findings appear in the **Security → Code scanning** tab of the repo
and inline on PR diffs. Click any finding for the rule docs at
`primitivehub.ai/top-10#CCI-NNN`.

---

## Minimum-viable workflow

`.github/workflows/scan.yml`:

```yaml
name: phub Context CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write   # required for SARIF upload

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: primitivehub/phub-scan@v0.1.0
        with:
          files: 'AGENTS.md CLAUDE.md .cursorrules'
          fail-on-findings: 'true'
```

That's it. Every PR runs the v0.1 detector roster against the named
files. SARIF lands in Code Scanning automatically.

---

## Inputs

| Input | Default | What it does |
|---|---|---|
| `files` | `'AGENTS.md CLAUDE.md'` | Space-separated paths to scan. Each is resolved relative to `$GITHUB_WORKSPACE` so SARIF URIs are repo-relative. |
| `sarif-directory` | `'phub-sarif'` | Where per-file SARIF outputs land (one `.sarif` per scanned file). |
| `upload-sarif` | `'true'` | Upload SARIF to GitHub Code Scanning via `github/codeql-action/upload-sarif`. |
| `fail-on-findings` | `'true'` | Fail the workflow step when any detector flags content. Set `'false'` to use Code Scanning as the gate without blocking merge. |
| `phub-source` | `'npm'` | Where to install phub from: `'npm'` (default) or `'local'` (monorepo-only — uses in-tree `packages/phub/`). |
| `phub-version` | `'latest'` | When `phub-source: 'npm'`, the version to install. Pin in production. |

---

## Outputs

| Output | What it is |
|---|---|
| `sarif-directory` | Path to the directory containing per-file SARIF outputs (for downstream archival or custom merging). |
| `findings-count` | Total SARIF results across all scanned files. `0` = clean. |

```yaml
- id: phub
  uses: primitivehub/phub-scan@v0.1.0

- name: Archive SARIF artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: phub-sarif
    path: ${{ steps.phub.outputs.sarif-directory }}
```

---

## Required permissions

```yaml
permissions:
  contents: read
  security-events: write   # SARIF upload
```

If `upload-sarif: 'false'`, drop `security-events: write`. Note that
without the upload step, findings appear only in the workflow log;
PR reviewers won't see them inline.

---

## Behavior on findings

Two modes, controlled by `fail-on-findings`:

| `fail-on-findings` | Behavior |
|---|---|
| `'true'` (default) | Step exits non-zero on findings → PR check fails. Best for repos with a clean baseline. |
| `'false'` | Step always exits 0 (unless phub itself errors). Findings still appear in Code Scanning; merging is not blocked. Best for adopting Context CI on a repo with a backlog. |

Promote from `'false'` → `'true'` once the backlog is clean.

---

## Pre-launch invocation (monorepo)

Pre-launch the npm package isn't published. The Action source is
in-tree at [`actions/phub-scan/`](../../actions/phub-scan/) and the
demo workflow [`/.github/workflows/phub-scan-demo.yml`](../../.github/workflows/phub-scan-demo.yml)
uses `phub-source: 'local'`:

```yaml
jobs:
  demo:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.0.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build verify + phub from the in-tree source
        run: |
          ( cd packages/verify && pnpm install --frozen-lockfile && pnpm build )
          ( cd packages/phub   && pnpm install --frozen-lockfile && pnpm build )

      - uses: ./actions/phub-scan          # local action; not yet on Marketplace
        with:
          files: 'CLAUDE.md README.md DESIGN.md'
          phub-source: 'local'
          fail-on-findings: 'false'
```

Once `primitivehub/phub-scan` is published to Marketplace, external
consumers use `uses: primitivehub/phub-scan@v0.1.0` with
`phub-source: 'npm'`.

---

## Examples

### Production gate (`fail-on-findings: 'true'`)

```yaml
- uses: primitivehub/phub-scan@v0.1.0
  with:
    files: 'AGENTS.md CLAUDE.md .cursorrules .github/copilot-instructions.md'
    fail-on-findings: 'true'
    phub-version: '0.1.0'         # pin
```

### Adoption mode (`fail-on-findings: 'false'`)

```yaml
- uses: primitivehub/phub-scan@v0.1.0
  with:
    files: 'AGENTS.md CLAUDE.md'
    fail-on-findings: 'false'
```

Code Scanning surfaces every finding; PR authors triage at their own
pace; promote to `'true'` once backlog is zero.

### Scan + audit (the active-surface upgrade)

`phub scan` is per-file. For the full project scan + classification +
lock check, prefer:

```yaml
- name: Build phub locally
  run: |
    ( cd packages/verify && pnpm install --frozen-lockfile && pnpm build )
    ( cd packages/phub   && pnpm install --frozen-lockfile && pnpm build )

- name: phub audit + check-lock
  run: |
    node packages/phub/bin/phub.js audit --check-lock --sarif > phub-audit.sarif

- name: Upload SARIF
  if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: phub-audit.sarif
    category: phub-audit
```

A future version of the Action will likely add a `mode: scan|audit`
input to encapsulate this. For now, the manual pattern works fine.

### Branch protection

To require a passing `phub-scan` check on `main`:

1. Repo Settings → Branches → `main` → Protect.
2. Tick **Require status checks to pass before merging**.
3. Search for `phub-scan` and select the job name (default:
   "PrimitiveHub Context CI scan").

The PR can't merge until phub-scan reports a clean SARIF run.

---

## See also

- [`actions/phub-scan/action.yml`](../../actions/phub-scan/action.yml) — Action source
- [`actions/phub-scan/README.md`](../../actions/phub-scan/README.md) — package-level README
- [`.github/workflows/phub-scan-demo.yml`](../../.github/workflows/phub-scan-demo.yml) — end-to-end CI demo
- [ADR-0024 — SARIF + GitHub Action](../decisions/0024-sarif-and-github-action.md)
- [phub CLI § scan](./02-phub-cli.md#scan) — what `phub-scan` invokes per file
- [Context Policy](./03-context-policy.md) — `.primitivehub/policy.yaml` is honored by the Action's scan step
