# ADR-0037: Corpus-measured F1 is the only signal that decides a detector PR

**Status:** Accepted
**Date:** 2026-06-05
**Related:** ADR-0023 (TS↔Py detector parity), ADR-0030 (FP resolution
+ AV-vendor parallel), ADR-0032 (corpus v0.1 + measurement harness),
ADR-0036 (semantic-context awareness v0.2.2),
[`docs/false-positive-resolution.md`](../false-positive-resolution.md),
[`bench/baseline/FLOOR.md`](../../bench/baseline/FLOOR.md).

## Context

ADR-0032 shipped the corpus (`bench/corpus/`) and the measurement
harness (`bench/scripts/measure.py` + `measure.ts`). For the first
time we could compute per-detector precision, recall, and F1 against a
labeled dataset. **We did not, however, wire that measurement to PR
merge.**

The gap has cost us already. Two concrete incidents in the last 48h:

1. **Silent harness breakage on `main` for ~24h.** Commit `64b91a7`
   passed `file_path=s.path` into `DetectorContext` before the
   field existed on the Python side. The bench refused to run; the
   measurement loop was dead. Nobody noticed because nothing was
   gating PRs on it. The fix landed in `accc83a` on a feature
   branch alongside other work — the regression escaped main entirely.
   Symptom of the same root cause as bug-#25: a quality property the
   team believes in but no CI invariant defends.
2. **Detector tuning past the optimal point.** The latest baseline
   (committed 2026-06-05) shows **precision = 1.000 on every
   detector except CCI-008**. Any further FP-trimming PR can only
   move recall down; the optimisation surface has inverted. The
   author of the FP-cleanup round (`accc83a`, FP-006..FP-011) flagged
   this directly: *"more detector tuning without corpus measurement
   is dangerous — I might be tightening past the point where real
   attacks slip through, and I have no way to know."* This is not a
   discipline failure. It is a **missing fitness function in the
   feedback loop.**

The corpus exists. The measurement exists. The numbers exist. The
only thing missing is the rule that says *no detector PR ships
without the numbers moving in the right direction.*

## Decision

### 1. Corpus-measured F1 is the only merge signal for a detector PR

A PR is a "detector PR" if it touches any of:

- `apps/api/scanners/**`
- `packages/phub/src/scanners/**`
- `packages/phub/src/audit/**` (audit pipeline can change verdicts)
- `bench/**` (corpus or harness)
- `.github/workflows/scanner-bench.yml`

The corpus regression gate
([`.github/workflows/scanner-bench.yml`](../../.github/workflows/scanner-bench.yml))
runs Python and TypeScript measurements against the most recent
committed baseline (the *floor*, see
[`bench/baseline/FLOOR.md`](../../bench/baseline/FLOOR.md)). The PR
fails to merge if **any one** of the following is true:

| Failure mode | Detected by |
|---|---|
| Per-detector F1 drop > 0.02 on Python | `measure.py --gate --baseline <floor>` |
| Per-detector F1 drop > 0.02 on TypeScript | `measure.ts --gate --baseline <floor>` |
| Cross-language (tp, fp, tn, fn) divergence on any detector | `parity_check.py` |

The floor path is auto-discovered by [`bench/scripts/gate.sh`](../../bench/scripts/gate.sh)
— bash globs `bench/baseline/*-{py,ts}.json` and picks the
lexicographically-last entry (filenames are `YYYY-MM-DD-<lang>.json`,
so lex sort == chronological sort).

The 0.02 tolerance is chosen so that integer count flips on small
sample populations (e.g. 1 TP → 1 FN with 4 TPs total = 0.250 swing)
register cleanly while floating-point noise does not. The tolerance
is a constant in the measure scripts — change requires a follow-up
ADR.

### 2. Floor advances monotonically

Each green merge to `main` produces a fresh
`YYYY-MM-DD-{py,ts}.json` under `bench/baseline/`. The next PR is
gated against the most recent file. The floor only moves **up**.
The only way down is the `RECALL-TRADE:` escape hatch documented in
`FLOOR.md`: a PR description block stating which detector, before,
after, why, and the ledger entry (`FP-NNN` / `FN-NNN`) that justifies
the trade. The gate does not parse the block; the reviewer overrides
the failed check knowingly, and the trade lives in the merge commit
forever.

### 3. Cross-language parity is a CI invariant, not a discipline

ADR-0023 stated TS and Py verdicts on the same input must agree.
Until today that was a code-review claim. Now `parity_check.py`
diffs per-detector count tuples in CI; **any drift fails the gate.**
A detector change that only touches one language fails parity until
its sibling lands in the same PR.

### 4. The bench harness itself is a tested artifact

The harness shipped with a footgun: `--gate` is a no-op without
`--baseline`. To remove the footgun, `bench/scripts/gate.sh`:

1. Discovers the most recent baseline per language by lex-sorting
   `bench/baseline/*-{py,ts}.json` (filenames are dated, so lex sort
   == chronological sort).
2. Runs both `measure.py` and `measure.ts` with `--gate --baseline
   <floor>` explicitly. The harness scripts themselves stay simple
   — no flag mutation, no auto-discovery side effects, easy to test.
3. Runs `parity_check.py` against the same two baselines.

`gate.sh` is the single host-side and CI-side entrypoint. Future
changes to the harness itself are gated by the same rule —
`bench/**` is in the trigger paths.

## Consequences

**Positive:**

- The "diminishing returns on FP-trimming" failure mode is structurally
  prevented. A PR that drops recall to chase one more FP fails CI.
- ADR-0023 parity becomes a regression test, not a code-review claim.
- The paper's reproducibility claim (`measure against
  commit_sha → re-derive numbers`) is now defended by CI; a regression
  cannot quietly land.
- Onboarding cost for new detector contributors drops: the gate tells
  them, in numbers, whether their change is net-positive.

**Negative:**

- CI runtime increases by the bench job (~minutes). Acceptable.
- The gate is only as good as the corpus. A detector class with thin
  corpus coverage (e.g. one borderline-only sample) can be tuned in
  ways the gate cannot detect. Round 2 of the elite-tier path
  diagnoses today's recall holes against today's corpus; Round 4
  expands the corpus to v0.2 (+25–40 samples + 80/20 holdout split).
  The gate strengthens as the corpus grows.
- The `RECALL-TRADE:` escape hatch is a human-judgment override and
  could be misused. Mitigation: it requires a ledger entry and named
  reviewer, both auditable in the merge commit; quarterly re-review
  per `docs/false-positive-resolution.md` § Governance scans for
  abuse patterns.

## Alternatives considered

- **Eyeball discipline ("just measure before merging").** Same posture
  as ADR-0023's pre-parity-test era. Rejected: humans forget, branches
  diverge, the harness broke on main for 24h with nobody noticing.
- **Gate on F1 macro-average only.** Simpler, but lets one detector
  collapse to F1 = 0 if six others rise by 0.02. Rejected: every
  detector defends a distinct attack category in the threat model;
  per-detector gating is the contract.
- **Block on per-sample verdict diff (every sample must produce the
  exact same TP/FP/TN/FN label across PRs).** Strictest possible.
  Rejected: too brittle for legitimate detector improvements; the
  F1-tolerance + parity-tuple gate captures the same property at the
  right grain.
- **Gate only on `main` push, not on PR.** Faster CI for PR iteration
  but moves regressions one merge later. Rejected: gating at PR is
  the entire point.

## Effective immediately

This ADR is the merge contract for the PR that introduces it. From
this commit forward, the corpus gate is the steering wheel — no
detector PR merges without it.
