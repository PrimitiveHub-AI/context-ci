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

## Usage

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

## Inputs

| Input | Default | What it does |
|---|---|---|
| `files` | `AGENTS.md CLAUDE.md` | Space-separated paths to scan. Each is resolved relative to `$GITHUB_WORKSPACE` so SARIF URIs are repo-relative. |
| `sarif-directory` | `phub-sarif` | Where per-file SARIF outputs land (one `.sarif` per scanned file). |
| `upload-sarif` | `true` | Upload SARIF to GitHub Code Scanning via `github/codeql-action/upload-sarif`. |
| `fail-on-findings` | `true` | Fail the workflow when any detector flags content. Set `false` to make Code Scanning the gate without blocking merge. |
| `phub-source` | `npm` | Where to install phub from: `npm` (default) or `local` (monorepo-only). |
| `phub-version` | `latest` | When `phub-source=npm`, the version to install. Pin in production. |

## Outputs

| Output | What it is |
|---|---|
| `sarif-directory` | Path to the directory with per-file SARIF outputs (for downstream archival). |
| `findings-count` | Total SARIF results across all scanned files; `0` = clean. |

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

## License

MIT. See [LICENSE](../../LICENSE) (project-wide).
