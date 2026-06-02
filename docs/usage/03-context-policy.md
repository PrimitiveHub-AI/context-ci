# 3. Context Policy Language

> [← back to index](./README.md) · prev: [phub CLI](./02-phub-cli.md) · next: [phub.lock →](./04-phub-lock.md)

**Spec:** [`docs/context-policy-v0.1.md`](../context-policy-v0.1.md)
**ADR:** [ADR-0018](../decisions/0018-context-policy-language.md)
**Discipline:** [`docs/false-positive-resolution.md`](../false-positive-resolution.md)

The `.primitivehub/policy.yaml` file lets you:

- **Suppress false positives** per-file, per-rule, per-`detail_tag`,
  with required justification text.
- **Override severity** per rule (`error` / `warning` / `note` / `off`).
- **Promote `warn` → `fail`** globally with `strict: true`.

Policy lives in git, gets PR-reviewed, and has an append-only FP-NNN
ledger. The audit trail is the whole point.

---

## Table of contents

- [Location + discovery](#location--discovery)
- [Minimum-viable policy](#minimum-viable-policy)
- [Field reference](#field-reference)
- [Severity model](#severity-model)
- [Path matching (globs)](#path-matching-globs)
- [Allow-rule matching](#allow-rule-matching)
- [Evaluation algorithm](#evaluation-algorithm)
- [CLI composition](#cli-composition)
- [The FP-NNN ledger discipline](#the-fp-nnn-ledger-discipline)
- [Examples](#examples)
- [Reserved fields](#reserved-fields)

---

## Location + discovery

Canonical location:

```
<repo-root>/
└── .primitivehub/
    └── policy.yaml
```

Discovery order when `phub scan` or `phub audit` runs:

1. `--policy <path>` if provided (file MUST exist; otherwise exit 2).
2. `./.primitivehub/policy.yaml` if it exists in the cwd or any
   ancestor up to the git root.
3. Implicit default policy — equivalent to:

```yaml
version: "0.1"
strict: false
rules:
  CCI-001: { severity: error }
  CCI-002: { severity: error }
  CCI-005: { severity: error }
allow: []
```

Without a policy file, behavior is identical to pre-policy phub
(every detector ships at `severity: error`, no allows).

---

## Minimum-viable policy

```yaml
# .primitivehub/policy.yaml
version: "0.1"
```

That's it. `version` is the only required field. Everything else
takes safe defaults.

---

## Field reference

```yaml
version: "0.1"            # required; must be "0.1"
strict: false             # optional; default false
rules:                    # optional; per-rule overrides
  CCI-001:
    severity: error       # error | warning | note | off
  CCI-002:
    severity: warning
allow:                    # optional; per-file allow exceptions
  - reason: "FP-001 — CLAUDE.md teaches T5 by name."
    files: ["CLAUDE.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `version` | string | yes | — | Must be `"0.1"`. Versionless policies are rejected. |
| `strict` | bool | no | `false` | When `true`, `warning`-severity findings count as failures for exit code. |
| `rules` | object | no | `{}` | Map of `CCI-NNN` → per-rule config. Unknown IDs ignored with a warning (forward-compat). |
| `rules.<id>.severity` | string | no | `error` | One of `error` / `warning` / `note` / `off`. |
| `allow` | array | no | `[]` | Allow exceptions. Order doesn't matter — ANY match permits. |
| `allow[].reason` | string | yes | — | Free-text. **Required.** Surfaced in scan output. |
| `allow[].files` | string[] | yes | — | Glob patterns. Min 1 entry. Use `["**/*"]` for repo-wide (and explain why). |
| `allow[].rules` | array | yes | — | Rule selectors. Min 1 entry. |
| `allow[].rules[].id` | string | yes | — | CCI ID (`CCI-005`), detector name (`t5.unsafe_shell_install`), threat category (`T5`), or `"*"` (all). |
| `allow[].rules[].detail_tags` | string[] | no | `[]` = all | Restrict to specific tags like `npx-arbitrary-install`. |

---

## Severity model

Four levels:

| Severity | SARIF level | Exit-code contribution | Notes |
|---|---|---|---|
| `error` | `error` | `exit 1` | Default for every rule in v0.1. |
| `warning` | `warning` | `exit 0` (unless `strict: true`) | Still surfaced in output. |
| `note` | `note` | `exit 0` | Informational only. |
| `off` | (no SARIF result) | `exit 0` | Rule disabled entirely. |

`strict: true` promotes ALL `warning`-severity findings to behave
like `error` for the exit code. SARIF level remains `warning`.

---

## Path matching (globs)

Spec § 4.2. Small, deliberately-scoped subset:

| Pattern | Matches |
|---|---|
| `CLAUDE.md` | Exact basename OR path. Matches `CLAUDE.md` and `/srv/x/CLAUDE.md`. |
| `**/CLAUDE.md` | Same as above (basename match makes `**/` redundant). |
| `docs/*.md` | `docs/foo.md`. Does NOT match `docs/sub/foo.md` (single `*` doesn't cross `/`). |
| `docs/**/*.md` | Any `.md` file at any depth under `docs/`. |
| `*` | Any single path segment. |
| `**` | Any number of path segments. |
| `?` | One character (excluding `/`). |

Implementation: a pattern matches if **either** the full path **or**
the basename matches the glob. Regex anchors are NOT supported.

---

## Allow-rule matching

An allow entry permits a finding when ALL three hold:

1. **Path** — at least one of `allow_entry.files` matches the scan
   target's filename per the glob rules.
2. **Rule** — at least one of `allow_entry.rules` matches: `id ==
   "*"`, OR `id == cci_id`, OR `id == detectorName`, OR `id ==
   threatCategory`.
3. **detail_tag** — the matched rule's `detail_tags` is empty/absent
   (any tag passes), OR the finding's `detailTag` is in
   `detail_tags`.

Multiple allow entries can match a single finding; the first
matching entry's `reason` is recorded in output (deterministic
order: input order).

---

## Evaluation algorithm

```
for each verdict v in V:
    severity = policy.rules[v.cciId].severity or "error"
    if severity == "off":
        suppress v entirely; continue

    surviving_hints = []
    for each hint h in v.diffHints:
        if any allow_entry in policy.allow matches (filename, v.cciId, h.detailTag):
            mark h as allowed; record allow_entry.reason
        else:
            surviving_hints.append(h)

    if surviving_hints is empty:
        re-mark v as passed=true, severity=info
    else:
        v.severity = severity   (apply the override)
        v.diffHints = surviving_hints

exit_code:
    if any v has severity == "error" and not passed: exit 1
    if policy.strict and any v has severity == "warning" and not passed: exit 1
    else: exit 0
```

See [spec § 6](../context-policy-v0.1.md#6-evaluation-algorithm) for
the authoritative version.

---

## CLI composition

CLI flags compose with the file. The composition rules:

- `--strict` on the CLI **overrides** `policy.strict: false` (CLI
  wins on `true`).
- `--allow-fail=<id>` repeats are **appended** to `policy.allow` as
  synthetic entries with `reason: "--allow-fail=<id>"`,
  `files: ["**/*"]`, `rules: [{id: "<id>"}]`. Per [ADR-0030 § 1.3](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)
  these are reserved for transient overrides — committed policy must
  not use the wildcard `id: "*"` or `files: ["**/*"]`.
- `--detector=<id>` does NOT compose with policy — it controls which
  detectors RUN (not what to do with their findings).

---

## The FP-NNN ledger discipline

Per [ADR-0030](../decisions/0030-fp-resolution-and-av-vendor-parallel.md) and
[`docs/false-positive-resolution.md`](../false-positive-resolution.md):

> Every `allow:` entry in a committed `.primitivehub/policy.yaml`
> **MUST reference an `FP-NNN` ledger entry** in
> `docs/false-positive-resolution.md` § 6. Adding an `allow:` entry
> without a matching ledger entry in the same commit is a defect.

The four-path triage every finding walks:

| Path | Outcome |
|---|---|
| **A — True positive** | Edit the content. No policy change. |
| **B — Domain WAI** | Narrow allow + FP-NNN ledger entry. |
| **C — Detector defect** | Lockstep tighten (Python + TS per ADR-0023). No policy change. |
| **D — Ambiguous** | Escalate to a security-reviewer. Do NOT silently allow. |

The ledger entry format includes:

- `FP-NNN` — monotonic identifier, never re-used.
- `Date authored:` — when the entry was added.
- `Path classification:` — which of A/B/C/D the triage chose.
- `Triage owner:` — who decided.
- `Re-review:` — date (default +90 days) for periodic reassessment.
- `Notes:` — links to ADRs, the policy entry, related code.

Re-review cadence: **quarterly + on every Top 10 minor-version bump**.

See `docs/false-positive-resolution.md` for the full methodology
including the strict allow-entry format and a worked example.

---

## Examples

### Suppress the canonical CLAUDE.md T5 false positive

```yaml
version: "0.1"
allow:
  - reason: "FP-001 — CLAUDE.md hard-rule #6 documents npx skill installs as a T5 attack vector by name. Detector is doing its job; the content is the project's own threat-model documentation. Path B (domain WAI). Re-review: 2026-09-01."
    files: ["CLAUDE.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
```

The matching FP-001 entry lives in `docs/false-positive-resolution.md`
§ 6.

### Demote T2 globally to warning; promote nothing

```yaml
version: "0.1"
rules:
  CCI-002:
    severity: warning
```

T2 (Unicode steganography) findings still appear in human / JSON /
SARIF output but don't fail the exit code unless you also set
`strict: true`.

### Disable T5 entirely on a security-teaching primitive

```yaml
version: "0.1"
allow:
  - reason: "FP-004 — apps/web/content/primitives/security-engineering-supplychain.md exhibits attack patterns by definition. Path B (domain WAI)."
    files: ["apps/web/content/primitives/security-engineering-supplychain.md"]
    rules:
      - id: "T5"      # threat-category alias works; same as id: "CCI-005"
```

Note `detail_tags` is omitted → all T5 tags allowed on that file.

### Composition with `--strict` on the CLI

Policy:

```yaml
version: "0.1"
strict: false
rules:
  CCI-002:
    severity: warning
```

Invocation:

```bash
phub scan ./AGENTS.md --strict
```

→ T2 findings now contribute to exit 1 (the CLI `--strict true`
wins over `policy.strict: false`).

### A real-world project policy

See [`/srv/primitivehub/app/.primitivehub/policy.yaml`](../../.primitivehub/policy.yaml)
— the project's own policy with FP-001 + FP-002 entries explaining
the two known-WAI cases.

---

## Reserved fields

The following top-level keys are reserved for v0.2 and are rejected
with a descriptive error today:

| Reserved field | Reserved for |
|---|---|
| `extends` | Base-policy inheritance (v0.2) |
| `actors` | Author-identity allow rules (v0.2) |
| `metadata` | Free-form team metadata + audit fields (v0.2) |
| `notify` | Notification channels (v0.2) |

Reserving them prevents user-defined fields from squatting names
intended for future schema additions.

---

## Conformance suite

The executable contract: [`docs/context-policy/conformance/`](../context-policy/conformance/).

- `schema/v0.1.json` — JSON Schema (Draft 2020-12)
- `valid/*.yaml` — 8 fixtures every implementation MUST accept
- `invalid/*.yaml` — 5 fixtures every implementation MUST reject
- `scenarios/*.json` — 6 (policy, verdicts, filename) → (exitCode,
  counts) tuples testing the evaluation algorithm

Per [ADR-0021](../decisions/0021-conformance-suite-as-executable-contract.md)
the suite IS the contract — when the spec text and an implementation
disagree, the suite arbitrates.

---

## See also

- [`docs/context-policy-v0.1.md`](../context-policy-v0.1.md) — authoritative spec
- [`docs/false-positive-resolution.md`](../false-positive-resolution.md) — FP discipline + ledger format
- [ADR-0018 — Context Policy Language](../decisions/0018-context-policy-language.md)
- [ADR-0030 — FP resolution + AV-vendor parallel](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)
- [phub CLI § scan](./02-phub-cli.md#scan) — where policy hooks in
