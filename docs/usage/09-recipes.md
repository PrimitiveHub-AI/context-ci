# Recipes — end-to-end workflows

> [← back to index](./README.md) · prev: [verify library](./07-verify-library.md) · next: [Troubleshooting →](./09-troubleshooting.md)

Worked end-to-end scenarios. Each starts from a clean state and ends
with a runnable system. Copy-paste-friendly.

---

## Table of contents

- [A CI-gated project (GitHub Actions + lock)](#a-ci-gated-project)
- [A Claude Code workspace](#a-claude-code-workspace)
- [A runtime-checking agent](#a-runtime-checking-agent)
- [The FP triage cycle](#the-fp-triage-cycle)
- [Inventorying an unknown codebase](#inventorying-an-unknown-codebase)
- [Migrating from `--allow-fail` flags to policy.yaml](#migrating-from---allow-fail-flags-to-policyyaml)

---

## A CI-gated project

Goal: every PR scans `AGENTS.md`, `CLAUDE.md`, and any `.cursorrules`,
fails the workflow on findings, surfaces SARIF in the Security tab,
AND fails on lockfile drift.

### 1. Seal the initial lock

In a clean working tree:

```bash
phub audit --lock-only
git add .primitivehub/phub.lock
git commit -m "chore: initial phub.lock seal"
```

If the project has known false positives, write the policy first:

```bash
mkdir -p .primitivehub
cat > .primitivehub/policy.yaml << 'EOF'
version: "0.1"
allow:
  - reason: "FP-001 — CLAUDE.md teaches T5 by name; documented in docs/bugs.md #25."
    files: ["CLAUDE.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
EOF
git add .primitivehub/policy.yaml
git commit -m "chore: initial Context CI policy"
```

(Per [ADR-0030](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)
also add the matching `FP-001` entry in `docs/false-positive-resolution.md` § 6.
The `reason:` text must reference the ledger entry.)

### 2. Wire the Action

`.github/workflows/context-ci.yml`:

```yaml
name: Context CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: primitivehub/phub-scan@v0.1.0
        with:
          files: 'AGENTS.md CLAUDE.md .cursorrules'
          fail-on-findings: 'true'

  audit-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.0.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm add -g @primitivehub/phub@^0.1.0
      - run: phub audit --check-lock
```

The first job fails on per-file findings; the second fails on
lockfile drift. Together they catch (a) attack patterns and (b)
unsigned-off changes to context primitives.

### 3. Require both checks

Repo Settings → Branches → `main` → Protect → require both
`scan / scan` and `audit-lock / audit-lock` checks before merge.

### 4. Onboard contributors

Drop this into `CONTRIBUTING.md`:

> Before opening a PR that touches `AGENTS.md`, `CLAUDE.md`,
> `.cursorrules`, or any file under `.claude/`, run:
>
> ```bash
> phub audit --check-lock
> ```
>
> If it reports drift but the changes are intentional, run
> `phub audit --update-lock` and commit the updated lock.

---

## A Claude Code workspace

Goal: register the MCP server so the Claude agent can call
`audit_workspace` before reading any context primitive.

### 1. Build the MCP server

(Pre-launch — post-launch the `npx` form just works.)

```bash
cd packages/verify     && pnpm install && pnpm build && cd -
cd packages/phub       && pnpm install && pnpm build && cd -
cd packages/mcp-server && pnpm install && pnpm build && cd -
```

### 2. Add to `.claude.json`

Project-local config (`.claude.json` in the repo root):

```json
{
  "mcpServers": {
    "primitivehub": {
      "command": "node",
      "args": ["/abs/path/to/packages/mcp-server/bin/primitivehub-mcp.js"]
    }
  }
}
```

(Replace `/abs/path/to` with the real path.)

Post-launch: swap to `"command": "npx"`, `"args": ["@primitivehub/mcp-server"]`.

### 3. Verify registration

```bash
claude mcp list
# Expected: primitivehub  ← 5 tools (audit_workspace, check_lock, scan_text, verify_bundle, verify_before_load)
```

### 4. Use in-session

Sample Claude prompts:

> "Before you touch any context files, run `audit_workspace` on this
> repo and show me what you find."
>
> "If there's any lock drift, refuse to proceed and tell me what
> changed."

The agent gets the verdicts as JSON and can decide whether to
continue.

---

## A runtime-checking agent

Goal: an agent that combines `check_lock` and `verify_bundle` to
implement the spirit of the planned MCP runtime gate (ADR-0029)
today, before the composite tool ships.

### Pattern: belt-and-suspenders read

When the agent needs to load a primitive:

```text
1. agent → check_lock { root: "<workspace>" }
   ↳ if hasDrift OR missing: refuse to load anything; surface drift to user.
2. agent → fetch primitive bundle (via Trust API or local cache)
3. agent → verify_bundle { bundle: <json> }
   ↳ if !valid: refuse to load this primitive specifically.
4. agent → consume primitive content.
```

### Implementation (Claude Code skill)

`.claude/skills/safe-load.md`:

```markdown
---
title: Safe primitive load (pre-ADR-0029)
trigger: before reading any primitive
---

You MUST follow this procedure before reading any primitive:

1. Call MCP tool `check_lock` with the workspace root.
2. If `hasDrift` is true OR `missing` is true, refuse to read any
   primitive. Tell the user the drift summary and ask whether to
   proceed.
3. If `hasDrift` is false, call MCP tool `verify_bundle` on the
   bundle you're about to consume.
4. If `valid` is false, refuse to read THIS primitive. Tell the user
   why (the `failures[0].code` is the right thing to surface).
5. If both checks pass, proceed with the read.
```

When ADR-0029 lands, the agent replaces both calls with a single
`verify_before_load` invocation.

---

## The FP triage cycle

Goal: when `phub scan` flags content that ISN'T an attack, walk the
four-path triage from
[`docs/false-positive-resolution.md`](../false-positive-resolution.md)
to a clean resolution.

### Step 1: classify

You scanned `apps/web/content/primitives/setup-guide.md` and got:

```text
[FAIL] t5.unsafe_shell_install (CCI-005) — Matched 1 unsafe-shell-install pattern.
  L42  npx shadcn@latest add Button
```

Walk the four paths:

| Path | Question | Answer for this case |
|---|---|---|
| **A — True positive** | Is the content actually instructing an agent to execute remote code? | No — it's documenting the canonical install command. |
| **B — Domain WAI** | Is this a primitive whose job is to teach about a third-party tool? | Yes — it's a shadcn/ui composition primitive. |
| **C — Detector defect** | Should the regex be tightened to exclude this pattern? | No — the regex IS correct that this is an `npx <pkg>` invocation. |
| **D — Ambiguous** | Do I need a security-reviewer? | No — Path B is clear-cut. |

→ Path B. Add a narrow allow + numbered FP ledger entry.

### Step 2: write the FP ledger entry

Append to `docs/false-positive-resolution.md` § 6:

```markdown
### FP-003 — shadcn primitive documents the canonical install command

**Date authored:** 2026-06-05
**Path classification:** B (domain WAI)
**Triage owner:** @your-handle
**Re-review:** 2026-09-05

The primitive `apps/web/content/primitives/setup-guide.md` documents
shadcn/ui's `npx shadcn@latest add <component>` install command on
line 42. The detector is correct that this is an `npx` invocation;
the content is correct that it's reference material describing a
third-party tool's documented entry point, not an executable
installer.

Notes:
- ADR-0023 (detector parity) preserved — no detector change.
- ADR-0018 (Context Policy) is the mechanism; this is the
  justification.
- Policy entry in `.primitivehub/policy.yaml` references FP-003.
```

### Step 3: write the policy entry

Append to `.primitivehub/policy.yaml`:

```yaml
allow:
  # ... existing entries ...
  - reason: |
      FP-003 — apps/web/content/primitives/setup-guide.md documents
      the canonical shadcn/ui install command (`npx shadcn@latest
      add <component>`). Reference material, not an executable
      installer. Path B (domain WAI) per docs/false-positive-resolution.md §1.
      Re-review: 2026-09-05.
    files:
      - "apps/web/content/primitives/setup-guide.md"
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
```

### Step 4: verify the allow works

```bash
phub scan apps/web/content/primitives/setup-guide.md
# → exit 0; "1 finding permitted by policy" with the FP-003 reason surfaced.
```

### Step 5: commit both files in the same PR

Per [ADR-0030](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)
the policy entry and ledger entry are committed together — neither
alone is a complete change.

```bash
git add .primitivehub/policy.yaml docs/false-positive-resolution.md
git commit -m "policy: allow shadcn primitive's install command (FP-003)"
```

### Step 6: schedule re-review

`Re-review: 2026-09-05` is 90 days out. A quarterly task should walk
every FP-NNN entry and verify:

- Is the primitive content still WAI?
- Has the detector tightened (Path C since last review)?
- Should the allow narrow further?

Per [ADR-0030 § 1.4](../decisions/0030-fp-resolution-and-av-vendor-parallel.md):
quarterly + on every Top 10 minor-version bump.

---

## Inventorying an unknown codebase

Goal: take a fresh codebase, find every agent-context artifact, and
produce a report — without running scanners (just classification).

```bash
phub audit . --lock-only --json | jq '.artifacts | group_by(.classification) | map({class: .[0].classification, count: length, paths: map(.path)})'
```

Output:

```json
[
  {"class": "claude-md", "count": 1, "paths": ["CLAUDE.md"]},
  {"class": "cursor-rules", "count": 2, "paths": [".cursorrules", ".cursor/rules/style.md"]},
  {"class": "primitive", "count": 18, "paths": [/* … */]},
  {"class": "skill", "count": 1, "paths": ["apps/web/content/skills/SKILL.md"]}
]
```

`--lock-only` writes a fresh lock (you can commit it as the initial
seal) without spending cycles on scanners.

---

## Migrating from `--allow-fail` flags to `policy.yaml`

Goal: you've been running `phub scan AGENTS.md --allow-fail=CCI-005`
in CI; move that to a versioned policy file.

### Before (anti-pattern)

```yaml
# .github/workflows/ci.yml
- run: phub scan AGENTS.md --allow-fail=CCI-005
```

`--allow-fail=CCI-005` globally permits every T5 finding on every
file. No justification text. No audit trail.

### After (correct)

`.primitivehub/policy.yaml`:

```yaml
version: "0.1"
allow:
  - reason: "FP-007 — AGENTS.md sample on line 88 demonstrates a curl-bash anti-pattern as part of onboarding documentation. Path B (domain WAI). Re-review: 2026-09-05."
    files: ["AGENTS.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["shell-pipe-from-network"]
```

`.github/workflows/ci.yml`:

```yaml
- run: phub scan AGENTS.md
```

The CLI no longer has a magic flag. The policy is reviewable. The
allow is scoped to one file + one detail_tag. The FP-007 ledger
entry explains why.

---

## See also

- [phub CLI](./02-phub-cli.md) — every command used above
- [Context Policy](./03-context-policy.md) — the policy field reference
- [phub.lock](./04-phub-lock.md) — drift detection
- [GitHub Action](./05-github-action.md) — wrapping in CI
- [MCP server](./06-mcp-server.md) — agent integration
- [`docs/false-positive-resolution.md`](../false-positive-resolution.md) — FP methodology + ledger format
- [Troubleshooting](./09-troubleshooting.md) — when a recipe breaks
