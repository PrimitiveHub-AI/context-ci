# ADR-0018: Context Policy Language v0.1

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0015 (Trust Contract versioning — same model),
ADR-0016 (Top 10 stable IDs), ADR-0021 (conformance suite as
executable contract), ADR-0023 (phub CLI), ADR-0024 (SARIF +
GitHub Action), `docs/context-policy-v0.1.md`,
`docs/context-policy/conformance/`,
`packages/phub/src/policy/`

## Context

Phase 5.5 shipped Context CI scanning (T1/T2/T5), the `phub` CLI,
SARIF output, and a GitHub Action. Users immediately ran into a
discoverability problem: the only escape hatches are CLI flags
(`--strict`, `--allow-fail=<id>`, `--detector=<id>`). Flags work
for one-off invocations but don't survive code review — there's
no audit trail for "why is this rule suppressed?", no per-file
allow rules, no team-shared configuration.

The canonical motivating case is documented in `docs/bugs.md #25`:
the project's own `CLAUDE.md` legitimately mentions `npx skill
installs` in its hard-rule prose (it's *forbidding* the pattern,
not instructing the agent), and the v0.1 T5 detector flags it.
Without a policy mechanism the only choices are:
- Stop scanning `CLAUDE.md` (security regression).
- Rewrite `CLAUDE.md` to avoid the words (defeats the purpose).
- Wait for v0.2 AST-aware detectors (months away).
- Use `--allow-fail=CCI-005` globally on every CI run (loses
  protection on every other file in the repo).

None of these are acceptable. Policy Language is the answer:
**per-file, per-rule, per-detail-tag allow exceptions, with
required justification text, in a versioned YAML file that lives
in git and is reviewable in PRs.**

This ADR also formalizes that **`phub` is the reference
implementation** for the Policy Language v0.1 spec, mirroring
ADR-0020's designation of `@primitivehub/verify` as the reference
implementation for Trust Contract v0.1.

## Decision

### 1. Adopt `docs/context-policy-v0.1.md` as the canonical spec

The spec inherits the discipline pattern proven by Trust Contract v0.1:

- **Versioning policy** identical to ADR-0015 (SemVer, 12-month
  deprecation window, explicit `version` field required).
- **Conformance suite as the executable contract** per ADR-0021
  (`docs/context-policy/conformance/` with schema, valid fixtures,
  invalid fixtures, and scenario fixtures testing the evaluation
  algorithm).
- **Reference-implementation rule** per ADR-0020: `packages/phub/`
  is the TS reference; when the spec text and the implementation
  disagree on an unspecified edge case, the conformance suite
  arbitrates. A future PR may add a Python sibling for symmetry
  with the detector parity rule in ADR-0023.

### 2. v0.1 surface area

Three knobs, designed for "the smallest thing that closes the bug
documented in `docs/bugs.md #25`":

| Knob | YAML field | What it does |
|---|---|---|
| Global strictness | `strict: bool` | Mirrors CLI `--strict`. Warning → fail in exit code logic. |
| Per-rule severity override | `rules.<CCI-NNN>.severity` | `error` / `warning` / `note` / `off`. `off` disables entirely. |
| Per-file allow exceptions | `allow[].{reason, files, rules}` | The killer feature. Match by glob path + rule ID + optional detail_tag. `reason` is REQUIRED. |

CLI flags (`--strict`, `--allow-fail`, `--policy`) compose with
the file; CLI wins on `strict=true`, CLI `--allow-fail` entries
append to `policy.allow`. The discipline preserves single-source
configurability while keeping the CLI ergonomic.

### 3. The `reason` field is REQUIRED on every allow entry

Anonymous exceptions defeat the entire point — the goal is an
auditable trail of "why is this rule suppressed?" Surfaced in
human + JSON output so reviewers see the justification at runtime.

### 4. Reserved forward-compat fields

`extends`, `actors`, `metadata`, `notify` are reserved in v0.1
schema and MUST be rejected with an error mentioning the intended
v0.2 semantics. Locking the names now prevents user-defined
fields from colliding with future schema additions.

### 5. Path matching: deliberately small glob subset

`*`, `**`, `?`, literal segments — no regex anchors (security
surface), no character classes (`[abc]`). v0.1's pattern set is
small enough to hand-roll, audit, and document in a single table
(spec § 4.2). Implementations match against the full path OR the
basename, so `CLAUDE.md` matches at any depth.

### 6. Discovery + default-policy semantics

- Explicit `--policy <path>` wins.
- Otherwise walk from `cwd` up to the git root looking for
  `.primitivehub/policy.yaml`.
- Otherwise apply the implicit default policy (spec § 7) —
  exactly equivalent to `phub scan` pre-policy behavior.

The implicit default exists so that adoption is gradual: a repo
with no policy file gets the same behavior as before, and adding
one is purely additive.

### 7. SARIF + JSON output discipline

- SARIF: rules disabled via `severity: off` emit no result. Hints
  permitted by allow rules emit no result. The Code Scanning UI
  reflects post-policy state — clean.
- JSON: `--json` output adds `policySource`, `policyAllowed` (per-
  hint allow records with `reason`), and a `summary` block with
  counts. Lets CI tools surface "X findings permitted by policy"
  even when exit code is 0.

## Alternatives considered

1. **JSON instead of YAML** for the policy file. Rejected. CI/CD
   configs in the target audience (security teams, platform teams)
   are overwhelmingly YAML. Forcing JSON adds adoption friction
   for marginal benefit. Cost: one runtime dep (`yaml`, audited,
   pure-TS).

2. **Inline `# phub: allow CCI-005 reason="..."` comments** in
   the source markdown. Considered. Powerful but undermines the
   spec's "policy is reviewable separately from the code that
   trips it" property; also adds a parser dependency to every
   downstream detector. Rejected for v0.1; reconsider when
   per-line annotations come up organically.

3. **Defer the spec; ship a "v0.1-flavored" `phub-policy` flag
   shape and stabilize later.** Rejected. The whole point of
   Phase 5.5 was standards-first execution — vocabulary is the
   moat. A spec under SemVer + conformance suite + an ADR is
   what makes the policy file an integration point for non-phub
   tools (GitHub apps, code-review plugins, …) without us
   negotiating each one individually.

4. **Path matching via `minimatch` / `picomatch` library.**
   Rejected. Adds runtime dep weight to phub for ~150 lines of
   functionality we control fully. The hand-rolled matcher in
   `src/policy/glob.ts` is auditable and matches the spec's
   tightly-scoped glob subset; if v0.2 needs richer patterns
   we can drop in a library then.

5. **Allow `severity: critical` above `error`.** Considered.
   Rejected for v0.1 — SARIF only has three levels (`error`,
   `warning`, `note`) and adding a fourth would either require
   custom SARIF extensions (badly supported) or collapse to
   `error` in Code Scanning anyway (confusing). v0.2 could
   introduce custom severities once a real use case emerges.

6. **Require `phub policy lint` to validate before any scan**
   (vs. inline validation on every load). Rejected as overkill
   for v0.1 — the loader's schema validation runs cheaply on
   every scan; a separate command would be useful eventually
   (especially for CI policy-review jobs) but isn't load-bearing
   yet. Future PR.

## Consequences

### Positive

- **`docs/bugs.md #25` is now resolvable today**, in a
  reviewable git-tracked way, by writing 6 lines of YAML.
- **Adoption is gradual**: no policy file = no behavior change.
  Teams adopt by writing exceptions for findings they triage,
  then promoting `severity: warning` → `error` per rule as the
  backlog clears.
- **Audit trail is intrinsic**: required `reason` field +
  policy file lives in git = every suppression has a who/why/when
  via git blame.
- **SARIF stays clean**: suppressed findings disappear from Code
  Scanning instead of cluttering the Security tab, but they're
  visible in `--json` output for tools that want them.
- **Spec is portable**: non-phub tools (custom GitHub Apps, IDE
  plugins, code-review bots) can implement the same schema +
  semantics and claim "Context Policy v0.1 conformance" via the
  conformance suite.
- **Forward-compatible**: reserved fields lock the namespace for
  v0.2 features (inheritance, actor-based allow, metadata) before
  users squat them.

### Negative

- **One new runtime dep** on phub (`yaml`). Justified: YAML is the
  expected format, the package is widely audited, pure-TS, no
  transitive deps. Documented in CHANGELOG.
- **Policy is global state during a scan** — the `--policy <path>`
  flag and `.primitivehub/policy.yaml` are loaded once per
  invocation. Per-PR dynamic policies (e.g. "be stricter on
  PRs touching auth code") require a v0.2 mechanism.
- **`severity: off` is a foot-gun.** Disabling a rule globally
  is exactly what the CLI's `--allow-fail` warned against; the
  YAML form is no better. Mitigation: docs explicitly warn
  against `off` and recommend per-file allows instead;
  `phub scan --json` always reports which rules are disabled.
- **Reserved fields are a constraint on future spec design.**
  Once v0.1 ships, the names `extends`, `actors`, `metadata`,
  `notify` are committed for their stated v0.2 purposes. If v0.2
  evolves elsewhere, we either bend to the names or break the
  reservation contract (renaming-with-deprecation per ADR-0015).

### Neutral

- **Per-line allow exceptions are deferred to v0.2** pending a
  partialFingerprint-keyed allow scheme. Lines move; line-keyed
  allows brittle. SARIF partialFingerprints (already shipped per
  ADR-0024) give us a stable cross-run identity to key off when
  ready.
- **The conformance suite is small** (6 valid + 5 invalid + 6
  scenarios = 17 fixtures). Adequate for v0.1 surface area;
  grows with each spec increment.

## Implementation

`packages/phub/src/policy/`:
- `types.ts` — `Policy`, `PolicyAllowEntry`, etc. + `IMPLICIT_DEFAULT_POLICY`
- `schema-v0.1.ts` — vendored copy of `docs/context-policy/conformance/schema/v0.1.json`
- `validator.ts` — hand-rolled mini JSON Schema validator (zero deps)
- `glob.ts` — spec-§-4.2 glob matcher (zero deps)
- `loader.ts` — YAML parse + schema validate + defaults + discovery
- `evaluator.ts` — evaluation algorithm (spec § 6)

CLI wiring:
- `--policy <path>` flag in `cli.ts`
- `--allow-fail=<id>` appended to `policy.allow` as synthetic entry
- `--strict` CLI flag wins over `policy.strict: false`
- Human output appends "N findings permitted by policy (source): [CCI-NNN] reason" summary
- JSON output adds `policySource`, `policyAllowed`, `summary` fields

Tests:
- `test/policy-glob.test.ts` — 11 cases for the glob matcher
- `test/policy-loader.test.ts` — 21 cases: suite invariants, every
  valid/invalid fixture, error-message specificity, defaults,
  resolve + discover
- `test/policy-evaluator.test.ts` — 8 cases: every `scenarios/*.json`
  fixture from the conformance suite + edge cases
- `test/cli.test.ts` — added 2 cases for `--policy <path>` CLI path
- 93/93 phub tests passing after this PR

Conformance suite (`docs/context-policy/conformance/`):
- `schema/v0.1.json` — JSON Schema (Draft 2020-12)
- `valid/*.yaml` — 8 fixtures
- `invalid/*.yaml` — 5 fixtures
- `scenarios/*.json` — 6 fixtures testing the evaluation algorithm

## What ships in subsequent PRs

- **Python reference (parity with detector parity)** — load the same
  YAML in `apps/api/`, apply the same algorithm, used by the
  server-side Context CI pipeline so server + CLI verdicts agree.
  Same lockstep-PR rule as ADR-0023.
- **`phub policy lint`** subcommand — validate a policy file
  without running a scan.
- **`phub policy explain <file>`** — show which allow entries
  would fire on a file (dry-run).
- **v0.2 features** — per-line allow via partialFingerprint,
  base-policy inheritance (`extends`), author-identity rules
  (`actors`), notification channels (`notify`), partialFingerprint-
  keyed allow entries.
- **Sample policy in `examples/`** — a working
  `.primitivehub/policy.yaml` for the project's own monorepo
  (resolves the `CLAUDE.md` T5 false positive permanently;
  documents how to scope detectors across the apps + docs trees).
  *Landed 2026-06-01:* see `.primitivehub/policy.yaml` at the repo
  root + the FP-001/FP-002 ledger entries in
  `docs/false-positive-resolution.md` § 6.

## False-positive resolution methodology (2026-06-01 supplement)

The Context Policy Language gives operators the *mechanism* to allow
false positives narrowly. It does NOT specify the *process* for
deciding when an allow is warranted, what justification is required,
or when the allow expires. That process discipline lives in
[`docs/false-positive-resolution.md`](../false-positive-resolution.md):

- The four resolution paths (true positive / domain WAI /
  detector defect / escalate) every finding MUST be classified into.
- The append-only `FP-NNN` ledger that every `allow:` entry MUST
  reference via its `reason:` field.
- The quarterly + minor-version-bump re-review cadence that
  prevents allowlist rot.

A policy entry without a matching ledger entry is a defect under this
ADR. CI gates of `.primitivehub/policy.yaml` in PR review SHOULD
check for the FP-NNN reference + the corresponding section in
`docs/false-positive-resolution.md`.

## References

- `docs/context-policy-v0.1.md` — the spec
- `docs/context-policy/conformance/` — the executable contract
- `docs/false-positive-resolution.md` — methodology + ledger (companion process doc)
- `packages/phub/src/policy/` — reference implementation
- `docs/bugs.md` #25 — the canonical motivating false positive
- ADR-0015 — versioning + deprecation model
- ADR-0016 — Top 10 stable IDs
- ADR-0020 — reference-implementation rule (pattern this ADR follows)
- ADR-0021 — conformance suite as executable contract
- ADR-0023 — phub CLI + detector parity (lockstep rule extends here)
- ADR-0024 — SARIF + GitHub Action (policy output integrates with both)
- `docs/execution-plan.md` Gate G-C — Enforcement surfaces shipped
