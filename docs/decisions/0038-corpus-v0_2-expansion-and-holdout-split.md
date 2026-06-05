# ADR-0038: Adversarial corpus v0.2 + 80/20 holdout split

**Status:** Accepted
**Date:** 2026-06-05
**Related:** ADR-0023 (TS↔Py detector parity), ADR-0030 (FP
resolution + AV-vendor parallel), ADR-0032 (corpus v0.1 + measurement
harness), ADR-0037 (corpus-as-steering-wheel),
[`docs/false-negative-resolution.md`](../false-negative-resolution.md),
[`docs/false-positive-resolution.md`](../false-positive-resolution.md),
[`bench/corpus/manifest.yaml`](../../bench/corpus/manifest.yaml).

## Context

ADR-0032 shipped corpus v0.1 (85 samples). ADR-0037 wired the corpus
into a CI regression gate so every detector PR is measured against
it. Round 3 of the elite-tier path closed every v0.1 detector
defect — every detector reached **P = R = F1 = 1.000** on the v0.1
in-sample.

That perfect score is itself a warning sign. A scanner that scores
1.000 on the only corpus it has been tuned against is, by
construction, possibly overfit. The classical-AV equivalent is a
scanner with 100% AV-TEST results in March who quietly misses an
April novel-variant push. The right defense is the discipline
classical AV vendors adopted decades ago: **hold out a slice of the
corpus during tuning; report performance on the holdout separately;
treat large gaps between in-sample and holdout as evidence of
overfit.**

This ADR specifies the v0.2 corpus expansion (+20 samples), the
80/20 holdout split mechanics, the baseline format change, and the
ratchet contract that prevents future regressions on either side.

## Decision

### 1. Bump corpus to v0.2 with +20 new samples (S-086..S-105)

The expansion covers all 10 Top 10 detector families and is
distributed: 12 adversarial + 8 benign new samples. Each adversarial
sample targets at least one attack shape **not present** in v0.1
(long-context buried injection, bidi-control wrapping, URL encoding,
WebSocket fetch, env→query exfil, future-dated patent citation,
emoji-density bloat, etc). Each benign sample exercises a precision
hazard the v0.1 detectors haven't been tested against (defense
primers, multilingual brand names, Sigstore reference URLs,
docker-compose tutorials, license discussion prose).

The full provenance and labelling rationale lives in
[`bench/corpus/manifest.yaml`](../../bench/corpus/manifest.yaml)
under each `S-NNN` entry's `notes:` field. Per
[ADR-0032](./0032-adversarial-corpus-and-detector-precision-recall.md)
§ Governance, all adversarial entries carry
`incident_reference: "synthesized"` and await security-reviewer
sign-off (`parity_status: pending`).

### 2. Holdout flag on the manifest sample schema

Every sample in `manifest.yaml` may carry a `holdout: true` field.
Default is `false`. Six v0.2 samples are flagged holdout:

| Sample | Detector | Attack shape | Why holdout |
|---|---|---|---|
| S-086 | CCI-001 | Long-context buried injection | Defender-prose-around-attack shape |
| S-088 | CCI-002 | Bidi-control RLO/PDF | Rare glyph class |
| S-090 | CCI-003 | URL-encoded decode-and-run | New encoding family |
| S-092 | CCI-004 | WebSocket at load time | New transport class |
| S-096 | CCI-006 | env-var → query string exfil | New exfil syntax |
| S-100 | CCI-008 | Future-dated US Patent citation | New identifier class |

The holdout fraction within the v0.2 expansion is 6/20 = 30%. The
fraction across the whole v0.2 corpus is 6/105 = 5.7% — low overall
because v0.1 samples (S-001..S-085) remain in-sample by deliberate
design: they were used for v0.1-era detector tuning so they cannot
serve as a clean overfit signal. The holdout discipline applies to
samples added AFTER the detector was last tuned.

Future corpus expansions follow the same rule: 20–30% of each
expansion batch is marked holdout. As samples age past several
detector rounds without being touched, they may be promoted from
holdout → in-sample (a "passed novel-variant probation" move). The
promotion is itself a ledger event, not a silent edit; format follows
the same `relabel_log:` block discipline as Path B sample relabels in
[`docs/false-negative-resolution.md`](../false-negative-resolution.md)
§ 2.

### 3. Measurement harness reports both buckets separately

`bench/scripts/measure.py` and `bench/scripts/measure.ts` now
partition samples by the `holdout` flag and compute parallel stats:

- **in_sample** — what the regression gate enforces against.
- **holdout** — reported alongside; informational for the gate, but
  **load-bearing for paper-credibility**.

The baseline JSON gains an optional `holdout` block:

```json
{
  "version": "0.1",
  "language": "py",
  "samples_total": 99,
  "per_detector": { ... },
  "overall": { ... },
  "holdout": {
    "samples_total": 6,
    "per_detector": { ... },
    "overall": { ... }
  }
}
```

Absence of the `holdout` block means the manifest had no holdout
samples (back-compat with v0.1 baselines).

### 4. Floor ratchet — v0.2 baseline becomes the new floor

The corpus regression gate per
[ADR-0037](./0037-corpus-as-steering-wheel.md) enforces a per-detector
F1 floor. With the v0.2 expansion, the floor moves to whatever this
commit measures against the v0.2 manifest. That floor is
**necessarily lower than the v0.1 floor** on detectors where the new
samples surfaced gaps:

| Detector | v0.1 floor (F1) | v0.2 in-sample floor (F1) | Gap reason |
|---|---|---|---|
| CCI-001 | 1.000 | 0.889 | FP-014 (semantic-context filter under-aggressive) |
| CCI-005 | 1.000 | 0.889 | FN-009 (fence-skip too aggressive) |
| CCI-007 | 1.000 | 0.933 | FN-011 (Cyrillic homoglyph) |
| CCI-010 | 1.000 | 0.909 | FN-013 (emoji-density bloat) |
| CCI-002, 003, 004, 006, 008, 009 | 1.000 | 1.000 | — |
| **Macro** | **1.000** | **0.962** | 4 documented gaps |

Each gap maps to a numbered ledger entry (`FN-006..FN-013`,
`FP-014`). The v0.2 floor is honest measurement, including known
weaknesses. The gate enforces no further regression below it; closing
any of the documented gaps raises it.

### 5. Holdout drift is reported but not gated (this round)

The first v0.2 holdout measurement is **macro recall = 0.333** — only
two of the six holdout adversarial samples got caught (CCI-001's
long-context-buried and CCI-002's bidi-control). The other four are
documented as `FN-007 / FN-008 / FN-010 / FN-012`.

This is exactly the signal the holdout split is for. The fact that
in-sample R = ~1.000 and holdout R = ~0.333 on the same detector code
is paper-grade evidence of training-set overfit. A scanner that
scores 1.000 in-sample and 0.333 on novel variants is not "100%
accurate" — it is "100% accurate against the patterns the author has
already seen."

**For v0.2, holdout drift is informational.** We do not gate against
holdout F1 because:

1. The detector code hasn't had a round to address the holdout
   findings yet — gating immediately would block every PR.
2. The holdout itself is small (n=6); single-sample swings are too
   noisy to gate on without inflating tolerance.

**For v0.3, holdout becomes gated** once the corpus expansion brings
the holdout to ≥30 samples and detector ratchets (v0.2.3 / v0.2.4 per
the FN ledger) close the documented gaps. ADR-0039 will formalise
the holdout gating threshold.

## Consequences

**Positive:**

- We now have honest, measured evidence of detector blind spots
  beyond what the v0.1 corpus could surface. 7 FN + 1 FP newly
  documented in the ledgers.
- The holdout split makes the "100% accuracy" claim falsifiable.
  Future paper drafts cite *both* in-sample and holdout numbers.
- The v0.2 floor acts as the new lower-bound; gate prevents regression
  while detector ratchets close the gaps.
- The Py / TS measure scripts now compute the same partition the
  same way → cross-language parity holds across both buckets.

**Negative:**

- Baseline format change (optional `holdout` block) means older
  baseline-reading tools need a feature flag or no-op shim. Not yet
  built; deferred.
- Corpus governance burden grows: every new expansion batch needs
  the holdout-ratio + promotion-log discipline. Templates added to
  [`bench/README.md`](../../bench/README.md) in a follow-up.
- Authoring 20 quality adversarial samples takes real time.
  The ratio v0.2 → v0.3 cannot be sustained without a contributor
  rotation — captured under execution-plan Risk R-7.

## Alternatives considered

- **Skip the holdout — keep one pool.** Faster to ship but defeats
  the overfit-detection purpose; the v0.1 floor's "100% accuracy"
  would propagate untested into the paper. Rejected.
- **Mark holdout at random across v0.1 + v0.2.** Cleaner statistical
  story but invalidates the v0.1 floor (denominators change). Most
  v0.1 samples were used for tuning so they're not clean holdout
  candidates anyway. Rejected.
- **Use the in-sample/holdout split with a fixed seed.** Cleaner for
  reproducibility but adds infrastructure with no near-term payoff;
  the manifest-flag approach is auditable and explicit. Deferred to
  a future ADR if/when the corpus grows past ~500 samples.

## Effective immediately

This ADR is the merge contract for the PR that introduces it:
manifest v0.2, harness with `holdout` partitioning, baselines
written to `bench/baseline/2026-06-05-{py,ts}.json` reflecting the
v0.2 in-sample + holdout split, and the 8 newly-documented detector
gaps as FN-006..FN-013 + FP-014 in their respective ledgers. From
this commit forward, the corpus regression gate measures against the
v0.2 manifest with the holdout partition active.
