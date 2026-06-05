# Baseline FLOOR — the regression contract

**Spec:** [docs/decisions/0037-corpus-as-steering-wheel.md](../../docs/decisions/0037-corpus-as-steering-wheel.md)
**ADR:** ADR-0037
**Enforcement:** [`.github/workflows/scanner-bench.yml`](../../.github/workflows/scanner-bench.yml)

The most recent committed baseline JSON in this directory is the
**floor** that the next detector PR must hold. The corpus regression
gate (Round 1 of the elite-tier path) is wired to compute this
automatically — you do not pick the floor by hand.

## The rule

> Per detector, a PR may not drop F1 by more than **`REGRESSION_TOLERANCE = 0.02`**
> against the floor on either language without an explicit and
> approved recall trade declared in the PR description.

This rule applies to detector code, audit-pipeline code, and corpus
changes alike. **It applies even to corpus removals** — if a sample is
removed and a detector's F1 changes by more than tolerance, the PR
states why.

## What "explicit and approved recall trade" looks like

If a PR genuinely needs to drop F1 (e.g. a corpus-labeling defect was
discovered; a borderline sample is being re-classified; a known FP
class is being eliminated at the cost of one real recall), the PR
description must contain a block of the form:

```
RECALL-TRADE:
  detector: CCI-NNN
  before:   F1 X.XXX  (P Y.YYY, R Z.ZZZ)
  after:    F1 X.XXX  (P Y.YYY, R Z.ZZZ)
  reason:   <one-sentence engineering reason>
  ledger:   FP-NNN | FN-NNN | SAMPLE-RELABEL-S-NNN
  reviewer: @<security-reviewer-handle>
```

The CI gate does not parse this block — it is a discipline contract,
not a code path. The gate still fails on the F1 drop; the human
reviewer overrides it knowingly, with the trade documented in the
merge commit so future-us can audit.

If a PR has no `RECALL-TRADE:` block and CI fails, the PR is rejected.
"Rebench to re-baseline" is not a workaround. The floor moves
**up**, never down, except through a documented trade.

## How the floor advances

Each green merge to `main` writes a fresh `YYYY-MM-DD-{py,ts}.json`
into this directory; the next PR is gated against the most recent
file. The floor ratchets monotonically upward — the only way down is
the `RECALL-TRADE:` escape hatch above.

## Cross-language parity (ADR-0023)

The gate also runs [`bench/scripts/parity_check.py`](../scripts/parity_check.py),
which diffs the (tp, fp, tn, fn) tuples per detector across the latest
Py and TS baselines. **Any divergence fails the gate.** ADR-0023
parity is no longer a code-review discipline; it is a CI invariant.

## Running the gate locally

From the repo root:

```bash
# Single-shot for both languages + parity check:
bench/scripts/gate.sh

# Verbose (prints the full per-detector tables):
VERBOSE=1 bench/scripts/gate.sh

# Just one language (pass the latest baseline path explicitly):
uv run --project apps/api python bench/scripts/measure.py \
    --no-baseline --gate --baseline bench/baseline/2026-06-05-py.json
( cd bench/scripts && pnpm -s tsx measure.ts \
    --no-baseline --gate --baseline ../../bench/baseline/2026-06-05-ts.json )

# Just parity:
python3 bench/scripts/parity_check.py
```

## What the floor is NOT

- **Not a target.** The floor is the worst we will accept; it does not
  tell you what to aim for. Aim *up*. Round 3+4 of the elite-tier path
  ratchet the floor to F1 ≥ 0.90 per detector via Rounds 3 + corpus
  v0.2 expansion in Round 4.
- **Not a benchmark to optimize against in isolation.** That's how you
  get overfit. Round 4 introduces a holdout split; the floor on the
  measured 80% is independent of the holdout 20% report.
- **Not a substitute for the FP/FN ledgers.** A drop in F1 on a
  specific sample must be traced to a `FP-NNN` or `FN-NNN` entry. The
  ledgers exist so the trade is auditable years from now.
