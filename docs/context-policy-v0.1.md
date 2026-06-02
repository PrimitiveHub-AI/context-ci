# Context Policy Language v0.1

**Status:** Stable
**Version:** 0.1
**Media type:** `application/vnd.primitivehub.context-policy+yaml`
**Date:** 2026-05-31
**Versioning policy:** [ADR-0015](./decisions/0015-trust-contract-versioning.md)
**Conformance philosophy:** [ADR-0021](./decisions/0021-conformance-suite-as-executable-contract.md)
**Authoritative ADR:** [ADR-0018](./decisions/0018-context-policy-language.md)
**Reference implementation:** [`packages/phub/src/policy/`](../packages/phub/src/policy/)

---

> A configuration file is a contract between a security team and the
> CI gate. This document defines that contract for PrimitiveHub
> Context CI scans. When this spec and the reference implementation
> disagree on a behavioral edge case, the conformance suite at
> [`docs/context-policy/conformance/`](./context-policy/conformance/)
> arbitrates per [ADR-0021](./decisions/0021-conformance-suite-as-executable-contract.md).

## 1. Goals

1. **YAML-configurable exceptions.** Today's `phub scan --strict
   --allow-fail=CCI-005` flag-soup works for one-off invocations but
   doesn't survive code-review. Policy lives in a versioned file
   under `.primitivehub/policy.yaml`, reviewable in PRs alongside
   the code that triggered it.
2. **Per-file allow rules.** The single highest-value feature: say
   "CLAUDE.md is allowed to mention `npx install` because it
   teaches about T5 attacks." Without per-file exceptions, the
   only escape hatch is disabling the rule globally — a security
   regression. (This is the canonical use case for the project's
   own CLAUDE.md per `docs/bugs.md #25`.)
3. **Severity overrides.** Downgrade `error` → `warning` for rules
   the team is still cleaning up; promote `warning` → `error` when
   ready to enforce. The default severity in v0.1 is `error` for
   all three shipped detectors.
4. **Spec stable enough to embed in a paper.** Same versioning
   discipline as Trust Contract v0.1 (ADR-0015): SemVer-aligned,
   12-month deprecation window, conformance suite is the
   executable contract (ADR-0021).

## 2. Non-goals (v0.1)

- **No imperative logic.** Policy is declarative data — match
  conditions and outcomes. No `if`/`then`/expressions.
- **No author identity.** Author-based allow rules ("anyone in
  @security-team can override CCI-005") are a v0.2 candidate
  pending OIDC integration work.
- **No remote inheritance.** Single local file; no
  `extends: "https://policies.example.com/base.yaml"`. v0.2.
- **No detector tuning.** Policy decides *what to do with a
  finding*, never *whether to look*. Detector parameters
  (regex patterns, MAX_HINTS_PER_VERDICT, …) are in detector
  source per ADR-0023's parity rule.
- **No per-line allow exceptions.** v0.1 allows by `(file, rule,
  detail_tag)` triples. Per-line is too brittle (lines move) and
  per-snippet-pattern is too easy to weaponize (write the policy,
  then write attacker content matching the policy). v0.2 may add
  partialFingerprint-keyed allow entries.

## 3. File location + naming convention

```
<repo-root>/
└── .primitivehub/
    └── policy.yaml          ← canonical location
```

CLI consumers MAY pass `--policy <path>` to override. If neither
the default path nor `--policy` resolves to a readable file, the
scan runs with the **implicit default policy** (§ 7).

## 4. YAML structure (full v0.1 surface)

```yaml
# .primitivehub/policy.yaml
version: "0.1"

# Global flags (mirror the CLI's --strict).
strict: false                  # if true, WARN → ERROR in exit-code logic

# Per-rule configuration. Keys are stable CCI IDs (CCI-001..CCI-010).
# Unknown rule IDs are IGNORED with a warning (forward-compat with
# detectors added in newer phub versions; old policies don't break).
rules:
  CCI-001:
    severity: error            # error | warning | note | off
  CCI-002:
    severity: warning          # demote: still surface, don't fail
  CCI-005:
    severity: error            # promote: enforce strictly

# Per-file allow exceptions. Each entry says "for these file paths,
# allow this rule's findings (or these specific detail_tags) to pass."
allow:
  - reason: "CLAUDE.md teaches T5 attack patterns by design (docs/bugs.md #25)."
    files:
      - "CLAUDE.md"
      - "AGENTS.md"
    rules:
      - id: "CCI-005"
        detail_tags:
          - "npx-arbitrary-install"
  - reason: "Threat-model document mentions all attacks by design."
    files:
      - "docs/threat-model.md"
    rules:
      - id: "*"                # wildcard: every rule
```

### 4.1. Field reference

| Field | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `version` | string | yes | — | Must be `"0.1"` in this spec version. Future minor versions are backwards-compatible additions; major version bump per ADR-0015. |
| `strict` | bool | no | `false` | Mirrors the CLI's `--strict`. When `true`, `warning`-level findings count as failures for exit-code purposes. |
| `rules` | object | no | `{}` | Map of `CCI-NNN` → per-rule config. Unknown IDs ignored with a warning. |
| `rules.<id>.severity` | string | no | `error` | One of `error` / `warning` / `note` / `off`. `off` disables the rule entirely (no SARIF result, no exit-code contribution). |
| `allow` | array | no | `[]` | List of allow exceptions. Order does not matter; ANY match permits the finding. |
| `allow[].reason` | string | yes | — | Free-text justification. REQUIRED — making the team write a sentence is the entire point. Surfaced in `phub scan --json` output so reviewers see why a finding was suppressed. |
| `allow[].files` | array of strings | yes | — | File paths to which this allow applies. Matching: see § 6. Empty array is invalid (use `["**/*"]` for repo-wide). |
| `allow[].rules` | array | yes | — | Rules to which this allow applies. Empty array is invalid. |
| `allow[].rules[].id` | string | yes | — | A CCI ID (`CCI-005`), a detector name (`t5.unsafe_shell_install`), a threat category (`T5`), or the literal `"*"` (every rule). |
| `allow[].rules[].detail_tags` | array of strings | no | `[]` (all) | Specific `detail_tag` values from the verdict's diff hints to allow. Omit or empty array = all detail_tags for this rule. |

### 4.2. Path-matching syntax (v0.1)

Path patterns in `allow[].files` are matched against the scan target
filename. v0.1 supports a deliberately small glob subset:

| Pattern | Matches |
|---|---|
| `CLAUDE.md` | Exact basename or path. Both `CLAUDE.md` and `/srv/x/CLAUDE.md` match. |
| `**/CLAUDE.md` | Same as above; `**/` is permitted but redundant for basename match. |
| `docs/*.md` | Any `.md` file directly in `docs/`. Single `*` does NOT cross `/`. |
| `docs/**/*.md` | Any `.md` file at any depth under `docs/`. |
| `*` | Any single path segment. |
| `**` | Any number of path segments. |
| `?` | One character (excluding `/`). |

Implementation rule: a pattern matches if **either** the full file
path **or** the basename matches the glob. This makes `CLAUDE.md`
match wherever it appears in the tree, while `docs/*.md` only
matches files actually in `docs/`. Future versions may make this
behavior configurable; v0.1 is opinionated.

Regex anchors are NOT supported in v0.1 (security surface — easy to
write greedy regex that nullifies the whole rule).

## 5. Severity model

Four levels, mapped to SARIF (ADR-0024):

| Severity | SARIF level | Default exit code contribution | Notes |
|---|---|---|---|
| `error` | `error` | exit 1 | Default for every rule in v0.1. |
| `warning` | `warning` | exit 0 (unless `strict: true`) | Surfaced in human + SARIF + JSON output. |
| `note` | `note` | exit 0 | Informational only; SARIF emission. |
| `off` | (no SARIF result) | exit 0 | Rule disabled. Verdict still computed for `--json` output. |

`strict: true` promotes ALL `warning`-severity findings to behave
like `error` for exit-code purposes. SARIF level is unchanged
(remains `warning`); only the process exit logic differs.

## 6. Evaluation algorithm

Given a verdicts array V from `phub scan`, a policy P, and a scan
target filename F:

```
for each verdict v in V:
    severity = P.rules[v.cciId].severity  if defined
               else "error"                              # default
    if severity == "off":
        suppress v entirely (no output, no exit contribution)
        continue

    surviving_hints = []
    for each hint h in v.diff_hints:
        if any allow_entry in P.allow matches (F, v.cciId, h.detail_tag):
            mark h as allowed; record the allow_entry.reason in output
        else:
            surviving_hints.append(h)

    if surviving_hints is empty:
        re-mark v as passed=true, severity=info
    else:
        v.severity = severity  (apply the override)
        v.diff_hints = surviving_hints

final_exit_code:
    if any v in V has severity == "error" and not passed: exit 1
    if P.strict and any v has severity == "warning" and not passed: exit 1
    else: exit 0
```

### 6.1. Allow-match predicate

`allow_entry` matches `(F, cci_id, detail_tag)` when ALL three hold:

1. **At least one of `allow_entry.files`** matches F per § 4.2.
2. **At least one of `allow_entry.rules`** matches: rule `id ==
   "*"`, OR `id == cci_id`, OR `id == detectorName`, OR `id ==
   threat_category` (e.g., `T5`).
3. **`detail_tag` is permitted**: the matched rule's `detail_tags`
   is empty/missing (any tag passes), OR `detail_tag` is in the
   `detail_tags` array.

Multiple allow entries can match; the first matching entry's `reason`
is recorded in output (deterministic order: input order).

## 7. The implicit default policy

When no policy file is provided (no `--policy` flag, no
`.primitivehub/policy.yaml` in the cwd or its ancestors up to the
git root), the implicit default is:

```yaml
version: "0.1"
strict: false
rules:
  CCI-001: { severity: error }
  CCI-002: { severity: error }
  CCI-005: { severity: error }
allow: []
```

This matches the v0.1 phub CLI default behavior exactly. The
implicit default exists so that `phub scan AGENTS.md` works
out-of-the-box with the same semantics as `phub scan AGENTS.md
--policy <equivalent-to-above>`.

## 8. CLI integration (reference)

```text
phub scan <file> [--policy <path>] [--strict] [--allow-fail=<id>] …
```

Resolution order for policy:
1. `--policy <path>` if provided (file MUST exist; otherwise exit 2).
2. `./.primitivehub/policy.yaml` if it exists in the cwd or any
   ancestor up to the git root.
3. Implicit default (§ 7).

CLI flags compose with file policy:
- `--strict` from CLI overrides `strict: false` from file (CLI wins).
- `--allow-fail=<id>` from CLI appends to file's `allow` as a
  synthetic entry: `{ reason: "--allow-fail=<id>", files: ["**/*"],
  rules: [{id: "<id>"}] }`.
- `--detector=<id>` filters which detectors RUN (not a policy
  concept — it's a scan-time scoping flag).

## 9. Conformance suite

[`docs/context-policy/conformance/`](./context-policy/conformance/)
contains:

- `schema/v0.1.json` — JSON Schema (Draft 2020-12) for the policy
  YAML. Implementations MUST reject any policy that fails to
  validate against this schema.
- `valid/*.yaml` — every fixture is a structurally and
  semantically valid v0.1 policy. Implementations MUST accept all.
- `invalid/*.yaml` — every fixture is invalid in a specific way
  (documented in companion `.md` files). Implementations MUST
  reject all.
- `scenarios/*.json` — scenario tests: a (policy, verdicts,
  filename) tuple + expected (exit_code, final_verdicts). The
  evaluation algorithm in § 6 is tested against these.

Per [ADR-0021](./decisions/0021-conformance-suite-as-executable-contract.md),
the conformance suite IS the executable contract. When this spec
and the suite disagree, the suite wins.

## 10. Versioning + deprecation

Same model as Trust Contract v0.1 (ADR-0015):

- **Patch** (`0.1.x`): clarifications + non-breaking schema additions
  (new optional fields). Existing valid policies remain valid.
- **Minor** (`0.2.x`): backwards-compatible feature additions
  (path-matching extensions, new severity levels, new allow
  predicates). Old policies still parse; new features require
  opt-in via `version: "0.2"`.
- **Major** (`1.0`, `2.0`): breaking changes. Old `version: "0.1"`
  policies are deprecated with a 12-month sunset window per
  ADR-0015.

The `version: "0.1"` field is mandatory and explicit. Versionless
policies are rejected at parse time. This is deliberate: a policy
without a version is a policy whose semantics drift.

## 11. Reserved fields (forward compatibility)

The following top-level keys are RESERVED in v0.1 — implementations
MUST reject policies that use them with an error explaining the
intended v0.2 semantics. Reserving them now prevents accidental
squat by user-added custom fields.

| Reserved | Reserved for |
|---|---|
| `extends` | v0.2 remote / base-policy inheritance |
| `actors` | v0.2 author-identity allow rules |
| `metadata` | v0.2 free-form team metadata + audit fields |
| `notify` | v0.2 notification channels (Slack, email) |

## 12. Example: closing docs/bugs.md #25

The canonical "this is why Policy Language exists" example. The
project's own `CLAUDE.md` legitimately mentions `npx skill installs`
in its hard-rule prose explaining the T5 attack vector; the v0.1
regex flags it. Without policy, the only choices are:

- Stop scanning `CLAUDE.md` (security regression).
- Rewrite `CLAUDE.md` to avoid the words (defeats the purpose).
- Wait for v0.2 AST-aware detectors (months away).

With policy:

```yaml
# .primitivehub/policy.yaml
version: "0.1"
allow:
  - reason: "CLAUDE.md teaches T5 attack patterns by design; documented in docs/bugs.md #25."
    files: ["CLAUDE.md"]
    rules:
      - id: "CCI-005"
        detail_tags: ["npx-arbitrary-install"]
```

Then:

```bash
phub scan CLAUDE.md --policy .primitivehub/policy.yaml
# → exit 0; the documented exception is recorded in output with the reason
```

The exception is in git history (alongside the `CLAUDE.md` text it
permits), is reviewable in PRs, and is auditable in retrospect.
That's the entire product.

## 13. References

- ADR-0015 — Trust Contract versioning + deprecation policy (same model)
- ADR-0016 — Context CI Top 10 v0.1 (CCI-NNN stable IDs)
- ADR-0018 — Context Policy Language v0.1 (this spec's ADR)
- ADR-0020 — `@primitivehub/verify` as reference implementation
- ADR-0021 — Conformance suite as the executable contract
- ADR-0023 — `phub` CLI + detector parity
- ADR-0024 — SARIF + GitHub Action
- `docs/context-policy/conformance/` — the executable contract
- `packages/phub/src/policy/` — reference implementation
- `docs/bugs.md` #25 — the canonical motivating false positive
