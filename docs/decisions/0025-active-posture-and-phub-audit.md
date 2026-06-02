# ADR-0025: Active posture — `phub audit` and the active-surfaces arc

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0015 (Trust Contract v0.1), ADR-0016 (Top 10 versioning),
ADR-0018 (Context Policy Language), ADR-0020 (verify as reference
implementation), ADR-0023 (phub CLI + detector-parity), ADR-0024
(SARIF + GitHub Action), `docs/vision.md`, `docs/positioning.md`,
`docs/execution-plan.md` Gate G-C, `packages/phub/`

## Context

`@primitivehub/phub` v0.1 (ADR-0023) shipped `scan <file>`, `verify
<bundle>`, and `init`. Each subcommand is **passive**: the user has to
know which file is suspicious and hand it to the CLI. `scan AGENTS.md`
only protects you against the AGENTS.md you remembered to point at.

The threat model in `docs/threat-model.md` and the hard-rule #6 in
`CLAUDE.md` ("no `npx` skill installs — the install path is treated as
a supply-chain attack vector, T5") both describe an attacker who hides
in the file the operator did NOT remember to scan: a `.cursorrules`
copy-pasted from a Twitter thread; a `.claude/skills/foo.md` dropped
by a contractor; a nested `AGENTS.md` under `tools/` that no one
audited; an MCP server descriptor checked in two PRs ago. **A
file-at-a-time linter cannot defend against the file you don't know
about.**

The vision in `docs/vision.md` already named the end state — "every
piece of context an AI agent loads can be inspected, verified, attested,
and revoked" — but the surfaces shipped through ADR-0023/0024 only
deliver the **passive half** of that sentence ("inspect this one file").
The active half ("find every piece of context, classify it, lock it,
guard it, gate runtime loading") is what closes the loop.

This ADR (a) names the shift from passive to active as a deliberate
product posture, (b) specifies `phub audit` — the first active
surface — as a concrete decision, and (c) lists the subsequent active
surfaces so other sessions don't re-derive the architecture.

## Decision

### The active-vs-passive distinction is load-bearing

- **Passive surface:** waits for a user invocation against a specific
  target. Example: `phub scan AGENTS.md`. Useful for known-suspect
  files; useless against unknown ones.
- **Active surface:** discovers its own targets, classifies them,
  scans them, and produces a project-level verdict. Example: `phub
  audit`. Useful as the *default* defensive posture.

Both are required; neither replaces the other. Going forward, every
new phub surface MUST declare itself passive or active in its design
note. Passive-only surfaces don't ship without a paired active
companion or an explicit deferral.

### Ship `phub audit` as the first active surface

Recursively discovers every agent-context artifact under a path
(default: `process.cwd()`), classifies it, scans it with the existing
detector roster, and emits a project-level report.

**Discovery scope** (the canonical "what counts as a context
artifact" list — kept in sync with `execution-plan.md` Gate G-C
default scan paths):

| Glob / filename | Classification |
|---|---|
| `AGENTS.md`, `**/AGENTS.md` | `agents-md` |
| `CLAUDE.md`, `**/CLAUDE.md` | `claude-md` |
| `.cursorrules`, `.cursor/rules/**/*.md*` | `cursor-rules` |
| `.windsurfrules` | `windsurf-rules` |
| `.aider.conf.yml`, `.aiderignore` | `aider-config` |
| `.github/copilot-instructions.md` | `copilot-instructions` |
| `.claude/skills/**/*.md` | `claude-skill` |
| `.claude/agents/**/*.md` | `claude-agent` |
| `.claude/commands/**/*.md` | `claude-command` |
| `**/primitives/**/*.md` | `primitive` |
| `**/skills/**/*.md`, `**/SKILL.md` | `skill` |
| `**/prompts/**/*.md` | `prompt` |
| `**/mcp.json`, `**/*.mcp.json` | `mcp-config` |

The classification list is **versioned alongside the Top 10** (ADR-0016).
New artifact classes ship as minor-version bumps to the Top 10 spec
because they describe the attack surface, not the implementation.

**Walker discipline** (zero-deps, hand-rolled):

- Skip vendor / build / VCS directories: `node_modules/`, `.git/`,
  `dist/`, `build/`, `.next/`, `coverage/`, `target/`, `__pycache__/`,
  `venv/`, `.venv/`, `.tox/`, `.pytest_cache/`, `.cache/`.
- Skip dot-prefixed directories EXCEPT for the meaningful ones:
  `.claude/`, `.cursor/`, `.github/` (and the meaningful dot-files
  `.cursorrules`, `.windsurfrules`, `.aider.conf.yml`, `.aiderignore`).
- Do NOT follow symlinks. Crossing the project boundary via a symlink
  is its own threat class and is not in scope for v0.1 audit.
- Sanity bounds: max depth 12, max files 5000. Both are diagnostics
  bounds, not security bounds — exceeding them prints a warning and
  reports what was scanned.

**Classification + scan output:**

For each matched artifact:
- Absolute path (relative to audit root in display).
- Classification tag (from the table above).
- SHA-256 content digest. The digest is the foundation for `phub.lock`
  (a future ADR) and matches the cryptographic vocabulary in CLAUDE.md
  ("Content Digest = SHA-256 hash of the canonical content").
- Per-detector verdict from the current roster (T1 / T2 / T5 in v0.1;
  expands lockstep with the Python side per ADR-0023).
- `mcp-config` files are classified + digested but NOT scanned with
  the markdown-text detectors in v0.1 — their detector family lands
  in a future PR. Today they appear in the inventory tagged
  "classified, not scanned" so an operator at least sees they exist.

**Aggregate verdict:** project-level pass if every artifact's
verdicts pass; project-level fail if any artifact has any FAIL (or
WARN under `--strict`).

**Exit codes** match `phub scan`:
- `0` clean (or `--no-fail` suppressed a finding-exit)
- `1` one or more artifacts flagged
- `2` usage error / unreadable path

**Output formats:**
- Default human-readable: inventory table grouped by classification +
  per-file verdict lines + project summary.
- `--json`: `{ root, artifacts: [{ path, classification, digest,
  verdicts: [...] }], summary }`.
- `--sarif`: SARIF 2.1.0 aggregating findings across all artifacts
  into one document (single run, one result per finding, `artifactLocation.uri`
  is the relative path).

**Flags consistent with `phub scan`:**
- `--detector=<id>` — restrict the detector roster
- `--strict` — WARN → FAIL
- `--no-fail` — exit 0 even on findings (for CI flows where SARIF
  upload is the gate)
- `--json` / `--sarif` (mutually exclusive)

### Detector-parity rule still applies

`phub audit` does NOT introduce new detectors. It is an
*orchestration* surface over the existing scanner roster. ADR-0023's
detector-parity discipline therefore stands unchanged: every detector
in `packages/phub/src/scanners/` is a port of the canonical Python
detector in `apps/api/scanners/`, with byte-for-byte pattern parity
and matching stable IDs.

The walker, classifier, and aggregate reporter are CLI-orchestration
concerns and live only in the TS package. They do not require a
Python sibling — the Python pipeline operates on already-uploaded
artifacts, where discovery is implicit in the registry index, not on
a developer's working tree.

### The active-surfaces arc — locked sequence, individual ADRs to follow

`phub audit` is **step 1 of 5**. The full sequence is locked here so
future sessions don't accidentally invert dependencies or duplicate
work. Each subsequent step gets its own ADR when it lands.

1. **`phub audit`** *(this ADR)* — discover + classify + scan + report.
   Converts the CLI from passive to active. Foundation for everything
   below.
2. **`phub.lock` + `phub audit --check-lock`** — pin every artifact's
   `(path, classification, digest, attestation-status)` to a committed
   lockfile. Audit compares working tree to the lock; CI fails on
   drift. This is the "package-lock.json" moment for AI cognition.
   Future ADR.
3. **`phub watch`** — long-running file-system watcher. New context
   artifacts appearing in the working tree get auto-scanned and
   quarantined until explicitly approved into the lock. Future ADR.
4. **`phub install <slug@semver>`** — safe replacement for the
   `npx … | bash` skill-install attack class (T5). Pulls a primitive
   from the registry, verifies its Trust Bundle, content-addresses
   the install path under `.primitivehub/installed/sha256-<hex>/`,
   records the install in `phub.lock`. Refuses to install unattested
   content without `--unsafe`. Future ADR.
5. **`@primitivehub/mcp-server` runtime gate** *(Gate G-D)* — exposes
   `primitivehub.verify_before_load(artifact_ref)` as an MCP tool.
   Agent runtimes (Claude Code, Cursor, …) call it before loading
   any primitive into their context; refuses-by-default for unattested
   or revoked content. Already planned as PR 5.5.5 / Gate G-D; this
   ADR confirms the contract.

These five surfaces are the **active half of the Trust Contract** —
the half that closes "context an agent loads can be inspected,
verified, attested, and revoked" from the vision into something an
operator actually experiences as default-safe behavior.

### The Samurai Cut

Strategic framing for the maintainer's reference, not a marketing
phrase to leak: shipping `phub audit` in one PR converts every
already-built piece of the Trust Contract — the verifier kernel
(ADR-0020), the scanner ports (ADR-0023), the SARIF reporter and
GitHub Action (ADR-0024), the Top 10 vocabulary (ADR-0016) — from
"capable but waiting" into "actively defending a project." One cut,
many pieces snap into formation.

The cut is deliberate and singular: it's the moment the CLI's value
proposition shifts from "lint this file" to "audit my project for AI
supply-chain risk." Every step in the active-surfaces arc above builds
on that posture. None of the four subsequent surfaces ships in this
ADR; they ship in their own ADRs as they land.

## Alternatives considered

1. **Add `--recursive` to `phub scan` instead of a new `audit`
   subcommand.** Rejected. The vocabulary matters — *audit* is what
   security teams call this operation; *recursive scan* is what
   linters call it. Naming the surface "audit" carries the brand
   into every CI log and every PR comment. The cost is one extra
   subcommand registration; the upside is vocabulary alignment with
   how the paper will discuss this.

2. **Ship `audit` without classification, just walk + scan.** Rejected.
   Classification is the bridge from "linter ran on every .md" to
   "operator sees the structure of their agent-context surface." It's
   also the table that future tooling (lockfile, watcher, registry
   importer) keys off — adding it later means a breaking change to
   the JSON output.

3. **Make classification heuristic (LLM-assisted).** Rejected. The
   classifier is a security-relevant component; deterministic
   path-pattern matching is auditable, an LLM call is not. Heuristic
   classes (e.g., "this file looks like a system prompt embedded in
   source code") are an explicit future-ADR concern, not v0.1 scope.

4. **Ship lockfile in the same PR as audit.** Rejected. Lockfile is
   a contract — its semantics need their own ADR. Coupling them
   makes both reviews harder. `phub audit --check-lock` is the
   integration point and lands when the lockfile lands.

5. **Defer audit to post-launch.** Rejected. Without an active
   surface, the launch demo is "here's how you scan a file we
   pre-selected." With audit, it's "point me at any agentic
   project on GitHub and I'll show you what it actually loads." The
   demo difference is the difference between "interesting tool" and
   "category-defining product."

## Consequences

### Positive

- **The default-safe posture is reachable in one PR.** Operators
  who install `@primitivehub/phub` get a meaningful project-level
  defense without authoring file lists or configuring globs.
- **The launch demo becomes concrete.** "Run `npx
  @primitivehub/phub audit` against your repo; here's everything
  shaping your agents that nobody asked." The screenshot writes
  itself.
- **The lockfile and watcher have a clean foundation to build on.**
  Both consume the audit's discovery + digest output unchanged.
- **The SARIF + GitHub Action surface (ADR-0024) gains immediate
  reach.** Wiring `phub audit --sarif` into the existing composite
  action gives CI a project-level Code Scanning verdict, not just a
  single-file one.

### Negative

- **Classification is path-based and therefore false-negative-prone.**
  A skill file checked in as `tools/helper.md` won't be classified.
  Mitigation: documented heuristic + the spec's classification list
  ratchets explicitly so additions are reviewable.
- **The walker has to honor a growing skip-list.** Vendor directories,
  build outputs, and language-specific cache dirs all need explicit
  exclusion. Mitigation: ADR-versioned list (above) plus a
  `--include-hidden` escape hatch for the maintainer-debug case.
  Future addition: `.phubignore` for project-specific tuning.
- **A large monorepo could hit the walk-budget cap.** Mitigation: cap
  is documented (5000 files / 12 depth), `--max-files` and
  `--max-depth` flags allow override, and the report names what was
  skipped so the operator knows.

### Neutral

- **`phub audit` and `phub scan` share the scanner kernel.** Future
  detector additions automatically flow through both surfaces — this
  is by design.
- **`phub.lock` is referenced but unspecified here.** That's
  intentional: this ADR closes the active-posture decision; the
  lockfile is its own decision.

## Implementation

`packages/phub/`:

- `src/audit/walker.ts` — recursive file walker (zero deps, honors
  skip-list, symlink-safe, depth-bounded).
- `src/audit/classifier.ts` — path-pattern → classification mapping;
  pure function.
- `src/audit/digest.ts` — SHA-256 digest helper via `node:crypto`.
- `src/commands/audit.ts` — orchestration: walk → classify → scan →
  aggregate.
- `src/reporters/audit-human.ts` — human-readable inventory + summary
  reporter.
- Extension to `src/reporters/sarif.ts` — multi-file aggregation.
- `src/cli.ts` — wire `audit` into the dispatcher; per-command help.
- `src/index.ts` — programmatic exports for the new types and
  functions.
- `test/audit-walker.test.ts`, `test/audit-classifier.test.ts`,
  `test/audit.test.ts` — unit + end-to-end coverage.

CLI surface:

```
phub audit [<path>]              # default: current directory
phub audit --json                # machine-readable
phub audit --sarif               # SARIF aggregate (GitHub Code Scanning)
phub audit --detector=<id>       # restrict detector roster (repeatable)
phub audit --strict              # WARN → FAIL
phub audit --no-fail             # exit 0 even on findings
phub audit --max-files=<n>       # override walker bound (default 5000)
phub audit --max-depth=<n>       # override walker depth (default 12)
```

## What ships in subsequent ADRs

- ADR-0026 ✓ landed 2026-06-01: `phub.lock` format + `phub audit --check-lock` / `--update-lock` / `--lock-only` / `--lock-path`
- ADR-0027 (planned): `phub watch` daemon
- ADR-0028 (planned): `phub install` safe-install command
- ADR-0029 (planned): MCP runtime gate (`verify_before_load`)
- ADR-0030 ✓ landed 2026-06-01 (out of sequence): FP resolution as product discipline; the AV-vendor parallel — locks the strategic framing for the whole active-surfaces arc

## References

- ADR-0015 — Trust Contract v0.1
- ADR-0016 — Context CI Top 10 v0.1 (classification list extends here)
- ADR-0018 — Context Policy Language v0.1
- ADR-0020 — `@primitivehub/verify` as reference implementation
- ADR-0023 — `phub` CLI + detector-parity
- ADR-0024 — SARIF + GitHub Action
- `docs/vision.md` — "inspected, verified, attested, and revoked"
- `docs/execution-plan.md` Gate G-C — `audit` was already named in the
  CLI command list; this ADR specifies its semantics
- `packages/phub/` — the implementation
