# ADR-0026: `phub.lock` format + drift detection — the package-lock.json moment for AI cognition

**Status:** Accepted
**Date:** 2026-06-01
**Related:** ADR-0015 (Trust Contract v0.1), ADR-0016 (Top 10
versioning), ADR-0018 (Context Policy Language), ADR-0023 (phub CLI +
detector parity), ADR-0025 (active surfaces — locks this ADR's slot as
PR 5.7.2), ADR-0030 (FP resolution + AV-vendor parallel — lock
discipline mirrors signature-DB discipline), `packages/phub/`.

## Context

`phub audit` (ADR-0025) discovers every agent-context artifact in a
project and produces `(path, classification, digest)` for each. That
output answers "what's in the project right now." It does NOT answer
the question that converts an interesting tool into a daily-driver:

> *What changed since the last time I reviewed this?*

Without that answer, every audit run is full-replay: the operator
re-reads every finding, re-classifies every artifact, and can't tell
the difference between "junior contractor dropped a new
`.claude/skills/foo.md` last Tuesday" and "this is the file I already
approved three sprints ago." The same gap that made `git status` an
interesting tool until `git diff` shipped, and the same gap that made
`npm install` workable until `package-lock.json` made it auditable.

Every supply-chain ecosystem solved this with a **lockfile**:

| Ecosystem | Lockfile | Purpose |
|---|---|---|
| npm | `package-lock.json` | Pin every installed package's resolved version + integrity |
| pnpm | `pnpm-lock.yaml` | Same, with content-addressed store |
| Cargo | `Cargo.lock` | Pin every transitive crate's exact version + checksum |
| Bundler | `Gemfile.lock` | Pin gem versions + sources |
| Pipenv | `Pipfile.lock` | Pin Python deps + hashes |
| Composer | `composer.lock` | Pin PHP package versions |

Agent context has no equivalent. PrimitiveHub ships the first one.

This ADR is the format-and-semantics ADR for `phub.lock`. The file is
committed to repositories. CI compares the working tree against it.
PRs that touch agent-context artifacts re-stamp the lock. The artifact
becomes the AV-product-family **boot-time integrity check** equivalent
(per [ADR-0030 § 3](./0030-fp-resolution-and-av-vendor-parallel.md)):
*before this project runs an agent against any of these primitives,
prove the cognition hasn't changed since I last reviewed it.*

## Decision

### File location + naming

The lock lives at `.primitivehub/phub.lock` (sibling of
`policy.yaml`). Auto-discovery walks cwd → git root looking for
`.primitivehub/phub.lock`, mirroring the policy-file discovery rule
(ADR-0018). Explicit `--lock-path <path>` overrides.

Filename convention follows the majority of established lockfiles —
`Cargo.lock`, `yarn.lock`, `Gemfile.lock`, `Pipfile.lock`,
`poetry.lock`, `composer.lock` — no extension on the lock filename,
despite the content being structured JSON. This is the dominant
ecosystem convention; `package-lock.json` and `pnpm-lock.yaml` are
the outliers.

### File format — canonical JSON

The lock is **canonical JSON** (RFC 8785-style determinism, scoped to
our format):

- UTF-8.
- 2-space indentation (matches the package's `JSON.stringify(_, null, 2)` style).
- Trailing newline.
- Object keys sorted alphabetically at every nesting level.
- Array order is significant and deterministic (see § Reproducibility).
- No comments. The `reason:` discipline that lives in policy.yaml is
  not applicable here — the lock records *state*, not *decisions*.

### Top-level schema (v0.1)

```json
{
  "$schema": "https://primitivehub.ai/phub-lock/v0.1.json",
  "artifacts": [
    {
      "attestation": "unattested",
      "classification": "claude-md",
      "digest": "sha256:abc...",
      "path": "CLAUDE.md"
    }
  ],
  "generator": "phub@0.1.0",
  "root": ".",
  "top10_version": "0.1",
  "version": "0.1"
}
```

Field-by-field:

- `$schema` — JSON Schema URL for tooling integration. Optional in
  reads, always emitted on writes. Not yet hosted; reserved for
  launch-day publishing per ADR-0022.
- `version` — Lock-format version. Currently `"0.1"`. Ratchets per
  ADR-0015 (Trust Contract versioning) when the format ratchets.
- `top10_version` — The Context CI Top 10 spec version the
  classifications were computed against (per ADR-0016). When a future
  lock is checked against the current Top 10 and these don't match,
  `--check-lock` exits 2 with "lock predates spec ratchet — re-lock."
- `generator` — `phub@<version>` of the tool that wrote the lock.
  Diagnostic; not used in equality checks.
- `root` — Path-prefix that artifact paths are relative to. Always
  `"."` in v0.1; reserved for future multi-root workspaces.
- `artifacts` — Sorted array of every classified artifact in the
  audit's discovery scope. Sort order: lexicographic by `path`.

Each `artifact` entry:

- `path` — Forward-slash path relative to `root`.
- `classification` — One of the
  [ADR-0025](./0025-active-posture-and-phub-audit.md) artifact
  classes (`agents-md`, `claude-md`, `cursor-rules`, etc.).
- `digest` — `sha256:` + lowercase-hex SHA-256 of the artifact's raw
  bytes (the same value `phub audit --json` already emits).
- `attestation` — One of `unattested` | `rekor:<log_index>` |
  `registry:<slug>@<semver>`. v0.1 emits only `unattested` because
  the integrations to populate the other states (Sigstore Rekor
  lookup, registry by-digest lookup) are not wired through
  `phub audit` yet. Future ADRs (0028 `phub install`) populate the
  registry mapping; future Trust API integration (Phase 5.5.2 is
  already shipped on the API side) populates the rekor mapping. The
  schema makes room for them today so v0.2 doesn't break v0.1
  consumers.

### Reproducibility — byte-identical re-stamps

**Re-stamping the lock against an unchanged working tree MUST produce
a byte-identical file.** This is the load-bearing property. Without
it:
- Git diffs lie ("the file changed" → "no, the timestamp changed")
- CI loops on benign re-runs
- Reviewer trust evaporates

To guarantee it:
- No timestamps in the file (git's commit date IS the timestamp).
- Stable sort: artifacts ordered lexicographically by `path`.
- Canonical JSON: keys alphabetical, no trailing whitespace, fixed
  indent, trailing newline.
- Walker output is already stable (`readdirSync` results sorted in
  `audit/walker.ts`).
- Classifier is pure (path-pattern matching; no I/O, no clock).

A unit test pins the property: `update-lock` → re-`update-lock`
produces zero diff.

### Commands

Three new flags on `phub audit` (NOT new subcommands — audit is the
orchestration surface):

#### `phub audit --check-lock`

Run audit + load lock + diff. Exit codes:

- `0` — no drift AND no scanner findings (or `--no-fail` suppressed
  scanner findings).
- `1` — drift detected OR scanner findings (or both).
- `2` — usage error / unreadable lock / missing lock file / spec
  version mismatch.

When the lock is missing, exit 2 with: *"no lock to check against;
run `phub audit --update-lock` to create one."* Refusing implicit
lock-creation under `--check-lock` is deliberate — a passing
check-lock against a non-existent lock is the kind of CI false-pass
that erodes trust.

#### `phub audit --update-lock`

Run audit + write `.primitivehub/phub.lock` to disk (creating
`.primitivehub/` if necessary). Exit codes:

- `0` — lock written. Scanner findings do NOT block lock writes —
  the lock records *what's there*, not *whether it's safe*. (Use a
  bare `phub audit` to gate on findings; the two concerns are
  orthogonal.)
- `2` — usage error / write failure.

#### `phub audit --lock-only`

Skip the scanner roster entirely; emit the lock-shape only. Useful
for CI bootstrapping where lock-stamping happens in a "stamp" job
separate from a "scan" job. Implies `--update-lock` semantics
(writes to disk) unless paired with `--json` (writes to stdout).

#### `phub audit --lock-path <path>`

Override the auto-discovered lock location. Composes with
`--check-lock` / `--update-lock` / `--lock-only`. Composes with
the existing `--policy` flag (the lock and the policy are
independent artifacts).

### Drift report shape

When `--check-lock` detects drift, the human reporter renders:

```
Drift detected against .primitivehub/phub.lock:

  Added (1):
    .claude/skills/new-tool.md   (claude-skill, sha256:abc…)

  Modified (1):
    AGENTS.md   sha256:def… → sha256:ghi…

  Removed (1):
    .cursorrules   (cursor-rules, sha256:jkl…)

  Reclassified (0)

Resolution:
  - If these changes are intentional, run `phub audit --update-lock`
    and commit the regenerated .primitivehub/phub.lock.
  - If a change is unexpected, investigate the source before re-locking.
```

JSON output emits:

```json
{
  "drift": {
    "added":       [{"path": "...", "classification": "...", "digest": "..."}],
    "modified":    [{"path": "...", "fromDigest": "...", "toDigest": "..."}],
    "removed":     [{"path": "...", "classification": "...", "digest": "..."}],
    "reclassified":[{"path": "...", "fromClass": "...", "toClass": "..."}]
  },
  ...
}
```

Drift categories are mutually exclusive: a path that exists in both
states with the same digest but different classification appears
only in `reclassified` (not in `modified`). A path whose digest AND
classification both changed appears in `modified` AND `reclassified`
(the digest change carries the semantic weight; the reclassification
is informational).

### Detector-parity orthogonality

`phub.lock` is **not** a detector. It does not introduce new
findings; it does not extend the Top 10; it does not affect
attestation predicates. The detector-parity rule (ADR-0023) is
therefore unchanged. Python sibling: not needed at the lock layer —
the Python pipeline operates on attested primitives where
discovery is implicit in the registry index, not in a developer's
working tree.

### Interaction with policy

The policy file (`.primitivehub/policy.yaml`) and the lock file
(`.primitivehub/phub.lock`) are independent artifacts:

- Policy governs **findings** (what's suppressed).
- Lock governs **state** (what's there).

`--check-lock` does NOT consult the policy when computing drift — a
file present in the working tree but not in the lock is "added,"
regardless of whether it would be policy-allowed if scanned. Drift
is about reviewable state; allow rules are about scanner output.

### Interaction with FP resolution (ADR-0030)

The lock's drift signal aligns with the AV-vendor product-family
parallel: drift detection is the **boot-time integrity check**
equivalent. When CI runs `phub audit --check-lock`, it's asking the
same question an AV agent asks at OS boot: *has the protected set
changed since the last known-good state?* The answer is "no" (pass)
or "yes; here's what" (fail-with-diff).

The FP resolution methodology applies to scanner findings only, not
to drift findings. Drift isn't a false positive — it's a fact about
the working tree. The resolution for drift is `--update-lock`, not
an allow entry.

## Alternatives considered

1. **YAML format instead of JSON.** Rejected. The lock is
   machine-managed (rewritten on every `--update-lock`); operator
   comments aren't useful (they'd be erased on the next stamp);
   YAML's ambiguity around quoting, numbers, and trailing whitespace
   makes canonical-form hard. JSON is the right call for a
   reproducibility-first format. (Counter-argument considered: the
   project already depends on `yaml` for policy parsing. Adding
   complexity to the existing dep would have been cheap. Still
   rejected on reproducibility grounds.)

2. **Sign the lock with Sigstore.** Deferred. The lock's integrity is
   the git commit history's integrity — anyone who can rewrite the
   lock can also rewrite the commit. Adding a Sigstore signature on
   top would defend against a narrower attack (an actor modifying
   `phub.lock` AFTER it's been committed but BEFORE the commit is
   reviewed in a PR) and would couple the lock to the existing
   Sigstore backend abstraction (ADR-0011). A reasonable v0.2
   feature; not v0.1 critical.

3. **Per-author lock entries.** Rejected. Multi-author attribution
   is the registry's job (the attestation predicate, ADR-0011),
   not the working tree's. The lock pins state; attestation pins
   provenance.

4. **Content-addressed only — drop `classification` and `path`.**
   Rejected. Classification gives the lock semantic shape (operator
   reading the diff knows *what kind* of artifact was added). Path
   makes the lock greppable. Both are cheap and load-bearing for the
   reviewer experience.

5. **Lock the scanner verdicts too — record "this file passed CCI-001
   when locked."** Rejected. Verdicts depend on the Top 10 spec
   version (already tracked as `top10_version`) AND the policy file
   AND the detector implementation version. Pinning verdicts at lock
   time fossilizes those choices; the next scanner run might
   reasonably return a different result for a digest-stable file
   because the detector got tighter or the policy got narrower.
   Treat verdicts as ephemeral per-run output; the lock pins the
   inputs.

6. **Combine `--check-lock` and the default `phub audit` mode —
   always check if a lock exists.** Rejected. Implicit gating is
   confusing in CI ("my audit started failing and I don't know why
   — turns out a lock got added"). Explicit `--check-lock` is the
   right ergonomics.

7. **Track artifact size or mtime in the lock.** Rejected. Size is
   already captured by the digest (different content → different
   digest). mtime is non-reproducible (clones / fresh checkouts
   have different mtimes) and would defeat the byte-identical
   re-stamp property.

8. **Include skipped paths in the lock.** Rejected. The skip-list
   (ADR-0025) is a property of the walker, not of the project. If
   the operator widens the walker (`--include-hidden` style escape
   hatch landing in a future PR), the lock changes structurally for
   reasons unrelated to the working tree's content. Lock only what's
   *included*, not what was *excluded*.

## Consequences

### Positive

- **Coverage becomes structural, not opt-in.** Once a repo commits
  `phub.lock`, every PR that touches an agent-context artifact has
  to re-lock. The lockfile change in the diff is visible to
  reviewers in the same way a `package-lock.json` change is visible.
- **CI gating gains a stable signal.** "Did anything in the agent
  context surface change?" becomes a single boolean from
  `phub audit --check-lock`'s exit code.
- **Unblocks `phub watch` (ADR-0027 planned).** The watcher needs a
  baseline to compare new file events against. The lock IS that
  baseline.
- **Closes the AV-product-family boot-time-integrity row.** Per
  ADR-0030 § 3 — the equivalent of "AV verifies its own signature
  files on boot" maps directly to "`phub audit --check-lock` runs
  on every CI invocation."
- **Paper-shaped artifact.** "PrimitiveHub introduces `phub.lock`,
  the first lockfile format for AI-agent cognition" is a citable
  paragraph in the launch paper. The format becomes the citable
  standard regardless of whether competitors adopt PrimitiveHub —
  they would have to adopt or contradict the lock format.

### Negative

- **Every PR touching context artifacts has to re-stamp.** This is
  exactly the npm experience with `package-lock.json` — sometimes
  noisy, especially during refactors. Mitigation: `--update-lock`
  is a single command; the diff is reviewer-readable; cardinality
  is bounded by the project's actual agent-context surface (typically
  dozens of artifacts, not thousands).
- **Spec-version mismatch ergonomics.** If the lock predates a Top
  10 minor-version bump, `--check-lock` refuses with "re-lock
  required." This is the right default (stale locks shouldn't pass
  silently), but operators will be surprised the first time.
  Mitigation: error message names the exact remediation command.
- **No signature in v0.1.** A motivated actor with write access to
  the repo can rewrite the lock alongside the artifacts. Mitigation:
  this is the same trust model as `package-lock.json` — the moat is
  git history + PR review + signed commits, not the lockfile itself.

### Neutral

- **Lock is per-project, not per-organization.** Multi-repo
  workspaces stamp one lock per repo. A future ADR may add
  organization-level aggregation; v0.1 is repo-scoped.
- **The lockfile is not a CBOM.** CBOM (Phase 5.6, ADR-0019 planned)
  is the externally-distributable manifest of cognition artifacts;
  `phub.lock` is the *internal* state pin. The two will reference
  each other once both ship.

## Implementation

`packages/phub/`:

- `src/audit/lock.ts` — types (`PhubLock`, `LockedArtifact`,
  `LockDrift`), `readLock(path)`, `writeLock(path, lock)`,
  `lockFromAudit(result)`, `diffLock(prev, current)`, canonical-JSON
  serializer + deterministic sort.
- `src/commands/audit.ts` — three new audit modes: `checkLock` /
  `updateLock` / `lockOnly`, threading the lock path + the `--no-fail`
  composition. Drift result merges into `AuditResult` for the
  reporters.
- `src/reporters/audit-human.ts` — drift section rendering when
  `result.drift` is present.
- `src/cli.ts` — wire `--check-lock`, `--update-lock`, `--lock-only`,
  `--lock-path <path>` flags; extend per-command help.
- `src/index.ts` — programmatic exports for the new types +
  functions.
- `test/audit-lock.test.ts` — format reproducibility, drift
  categories, round-trip, schema-version mismatch.
- Extended end-to-end tests in `test/audit.test.ts`.

## What ships in subsequent ADRs

- ADR-0027 — `phub watch` daemon. Filesystem watcher diffs new
  events against the lock; quarantine semantics for unapproved
  artifacts.
- ADR-0028 — `phub install <slug@semver>` safe-install. Pulls from
  registry, verifies bundle, records the install under the
  `attestation` field (`registry:<slug>@<semver>`).
- ADR-0029 — MCP runtime gate. `verify_before_load` consults the
  lock; agents refuse to load artifacts whose digest doesn't match.

## References

- ADR-0015 — Trust Contract v0.1 versioning
- ADR-0016 — Top 10 versioning + `top10_version` field
- ADR-0018 — Context Policy Language (sibling artifact)
- ADR-0023 — phub CLI + detector parity (parity unchanged)
- ADR-0025 — Active surfaces (locks this ADR's slot in the arc)
- ADR-0030 — FP resolution + AV-vendor parallel (boot-time
  integrity check mapping)
- `docs/false-positive-resolution.md` — methodology (orthogonal to
  drift detection)
- `docs/principles.md` Principle 19 (active by default), Principle 7
  (no hallucinations as fact — the lock makes state auditable)
- `packages/phub/` — implementation
