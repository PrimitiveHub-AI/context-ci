# `phub.lock` — the lockfile for AI cognition

> [← back to index](./README.md) · prev: [Context Policy](./03-context-policy.md) · next: [GitHub Action →](./05-github-action.md)

**ADR:** [ADR-0026](../decisions/0026-phub-lock-format-and-drift-detection.md)
**Spec section:** ADR-0026 § "Wire format"
**File location:** `.primitivehub/phub.lock`

The `package-lock.json` equivalent for agent-context artifacts.
Pins every classified file's classification + content digest +
attestation status. Drift detection (`--check-lock`) tells you when
*anything* changed since the last seal — added, modified, removed,
or reclassified.

---

## Table of contents

- [What it solves](#what-it-solves)
- [File format](#file-format)
- [The four lock flags](#the-four-lock-flags)
- [Drift categories](#drift-categories)
- [Workflows](#workflows)
- [Examples](#examples)
- [Forward-compat: rekor:* and registry:*](#forward-compat-rekor-and-registry)

---

## What it solves

Without a lock:

- A new `.cursorrules` dropped by a contractor is invisible to the
  CI gate (nothing pinned it as "should not exist").
- A modified `CLAUDE.md` mid-PR slips through if the scanner happens
  to still pass.
- An artifact silently reclassified (a `prompt` file moved into
  `.claude/skills/`) gets the wrong detector roster applied.

With a lock:

- Every classified artifact has a SHA-256 digest at the time of the
  seal.
- `phub audit --check-lock` exits non-zero on drift.
- The drift report names the exact files added / modified / removed
  / reclassified.

The lock is the **boot-time integrity check** row of the AV
product-family map from [ADR-0030 § 3](../decisions/0030-fp-resolution-and-av-vendor-parallel.md).
Foreshadows `phub watch` (ADR-0027 planned), `phub install`
(ADR-0028 planned), and the MCP runtime gate (ADR-0029 planned).

---

## File format

Canonical JSON. Alphabetical keys at every level. Lexicographic
artifact sort. No timestamps. Re-stamping against an unchanged
working tree produces a **byte-identical file** (unit-tested).

```json
{
  "$schema": "https://primitivehub.ai/phub-lock/v0.1.json",
  "artifacts": [
    {
      "attestation": "unattested",
      "classification": "claude-md",
      "digest": "sha256:f3e36ce80b08dcbaacc7cb872dc8b49b75cb8adc989d0156520e700529970a03",
      "path": "CLAUDE.md"
    },
    {
      "attestation": "unattested",
      "classification": "primitive",
      "digest": "sha256:0059fac41e29122595827621b8483343b637a4a32617f90b45b2964805777672",
      "path": "apps/web/content/primitives/accessibility-wcag22.md"
    }
  ],
  "lock_version": "0.1",
  "top10_version": "0.1"
}
```

Top-level fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `$schema` | string | yes | Points at the canonical schema URL. |
| `lock_version` | string | yes | `"0.1"` in this release. Major bump = breaking change. |
| `top10_version` | string | yes | Pinned Top 10 spec version (currently `"0.1"`). When the spec ratchets, stale locks refuse to validate with a clear remediation. |
| `artifacts` | array | yes | Lexicographically sorted by `path`. |

Per-artifact fields:

| Field | Type | Notes |
|---|---|---|
| `path` | string | Repo-relative; forward slashes. |
| `classification` | string | One of the ADR-0025 artifact classes (`agents-md`, `claude-md`, …). |
| `digest` | string | `sha256:<hex>` of file bytes at seal time. |
| `attestation` | string | `unattested` in v0.1. Future `rekor:<log-index>` + `registry:<id@version>` populate when `phub install` + Trust API integration land. |

---

## The four lock flags

`phub audit` exposes lockfile interaction:

```
phub audit [dir] [--check-lock | --update-lock | --lock-only] [--lock-path <path>]
```

The first three are mutually exclusive at CLI parse time.

| Flag | What it does | Exit codes |
|---|---|---|
| `--check-lock` | Compare working tree to `.primitivehub/phub.lock`. | `0` clean & lock matches; `1` drift OR scanner findings; `2` lock missing or `top10_version` mismatch. |
| `--update-lock` | Write a fresh lock (scanner findings do NOT block). | `0` on success; `2` on filesystem errors. |
| `--lock-only` | Skip scanners; stamp the lock only. With `--json`, writes canonical JSON to stdout (CI bootstrap). | `0` / `2`. |
| `--lock-path <path>` | Override auto-discovered lock location (default `./.primitivehub/phub.lock`). | — |

Without any of the lock flags, `audit` runs scanners normally and
ignores the lockfile entirely.

---

## Drift categories

`--check-lock` reports four mutually-relevant drift categories
(added/removed are mutually exclusive; reclassified is orthogonal):

| Category | Meaning | Common cause |
|---|---|---|
| **added** | Path appears in the working tree but not in the lock. | Contractor dropped a new `.cursorrules`. |
| **modified** | Path is in both; digests differ. | Someone edited `CLAUDE.md`. |
| **removed** | Path is in the lock but not the working tree. | A primitive was deleted. |
| **reclassified** | Path is in both with matching digest, but classification changed. | A `prompt` file moved into `.claude/skills/`. |

The human reporter names each drift entry with the exact `phub`
command to remediate; the JSON reporter surfaces the same in a
structured shape.

---

## Workflows

### Initial seal

The project just got a Context CI pipeline and needs its first lock:

```bash
phub audit --lock-only
ls -la .primitivehub/phub.lock
git add .primitivehub/phub.lock && git commit -m "chore: initial phub.lock seal"
```

### CI gate (every PR)

`.github/workflows/your-ci.yml`:

```yaml
- name: phub audit + lock check
  run: phub audit --check-lock
```

A PR that adds, modifies, removes, or reclassifies any artifact
fails the step until the lock is updated. The PR author runs
`phub audit --update-lock` locally and commits the new lock.

### Updating the lock after intentional changes

```bash
phub audit --update-lock
git add .primitivehub/phub.lock && git commit -m "chore: re-seal lock for <feature>"
```

The diff on `.primitivehub/phub.lock` IS the human-reviewable record
of what changed — see git blame on any artifact's digest to find
when (and in which PR) it last shifted.

### Working-tree drift report (no write)

```bash
phub audit --check-lock --json | jq '.lockState.drift'
```

```json
{
  "added": [
    {"path": ".cursor/rules/snake.md", "classification": "cursor-rules", "digest": "sha256:abcd..."}
  ],
  "modified": [
    {"path": "CLAUDE.md", "lockDigest": "sha256:f3e36c...", "workingDigest": "sha256:9a1100..."}
  ],
  "removed": [],
  "reclassified": []
}
```

### `--lock-only --json` (CI bootstrap)

```bash
# Write canonical JSON to stdout instead of disk — useful when the
# CI runner can't commit back to the repo but should publish the
# lock as an artifact:
phub audit --lock-only --json > phub-lock-snapshot.json
```

---

## Examples

### Smoke test on the monorepo

```bash
phub audit --check-lock
# → "20/20 artifacts clean. Lock match: no drift." exit 0
```

(Assumes the project's own `.primitivehub/phub.lock` is committed
and the working tree is clean.)

### Inspecting the lock

```bash
jq '.artifacts | length' /path/to/context-ci/.primitivehub/phub.lock
# → 20

jq '.artifacts | map(.classification) | group_by(.) | map({class: .[0], count: length})' \
   /path/to/context-ci/.primitivehub/phub.lock
# → classifications + counts
```

### Forcing drift to see the output

```bash
echo "<!-- drift -->" >> /path/to/context-ci/CLAUDE.md   # don't commit this!
phub audit --check-lock
# → modified: 1 artifact (CLAUDE.md). exit 1.
git checkout CLAUDE.md
# Reset.
```

### Per-artifact lookup

```bash
jq '.artifacts[] | select(.path == "CLAUDE.md")' \
   /path/to/context-ci/.primitivehub/phub.lock
```

---

## Forward-compat: `rekor:*` and `registry:*`

The `attestation` field is `unattested` in v0.1. The two future
states the ADR forward-references:

- **`rekor:<log-index>`** — set when `phub install` (planned
  ADR-0028) downloads an artifact from PrimitiveHub and the digest
  was verified against a Rekor transparency-log entry. Indicates
  cryptographic provenance.
- **`registry:<slug@version>`** — set when an artifact came from a
  named registry primitive (e.g. `@org/skill-x@1.2.3`). Indicates
  the artifact is reproducibly fetchable.

The MCP runtime gate (planned ADR-0029) refuses to load any
artifact whose lock entry is `unattested` by default — operators
can opt in to looser policies via `.primitivehub/policy.yaml`.

---

## See also

- [`docs/decisions/0026-phub-lock-format-and-drift-detection.md`](../decisions/0026-phub-lock-format-and-drift-detection.md) — authoritative ADR
- [`docs/decisions/0025-active-posture-and-phub-audit.md`](../decisions/0025-active-posture-and-phub-audit.md) — the active-surfaces arc
- [`docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md`](../decisions/0030-fp-resolution-and-av-vendor-parallel.md) — AV-product-family parallel (boot-time integrity row)
- [phub CLI § audit](./02-phub-cli.md#audit) — where the lock flags live
- [Recipes § "A CI-gated project"](./08-recipes.md#a-ci-gated-project) — wiring the lock into CI
