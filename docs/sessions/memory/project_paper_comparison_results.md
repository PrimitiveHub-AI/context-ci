---
name: project-paper-comparison-results
description: "Measured 'what we catch vs alternatives' comparison rows (corpus v0.2, py engine) earmarked for the PrimitiveHub conference paper's evaluation section"
metadata:
  node_type: memory
  type: project
---

The conference paper should carry a **comparison table** ("what we catch vs
alternatives"), not just PrimitiveHub's own precision/recall. First measured
rows produced 2026-10-23 by `bench/scripts/compare.py` against corpus v0.2
(py engine), attack-detection view (borderline-free; 52 in-sample adversarial
attacks, 25 holdout adversarial, 37 benign in-sample):

| Scanner | Attacks caught (in-sample) | Holdout | Benign false-positives |
|---|---|---|---|
| **primitivehub** | 52/52 (100%) | 25/25 (100%) | **0/37** (CCI-005 FP fixed, t5 v0.2.8, 2026-10-23) |
| no-scanner | 0/52 (0%) | 0/25 (0%) | 0/37 |
| keyword-grep | 42/52 (81%) | 21/25 (84%) | 28/37 (76% false-alarm rate) |

(Refreshed 2026-10-23 after the CCI-005 fix — was `1/37 (known CCI-005 FP)`;
reproduces `bench/baseline/2026-10-23-py.json`, Δ F1 0.0. Latest numbers live
in `bench/comparison/2026-10-23-comparison.json` + `docs/comparison.md`.)

**The headline framing (un-rigged):** the naive keyword scanner catches 81%
of attacks but false-positives on **76% of benign samples** — the corpus's
deliberately hard benigns (defender docs that *quote* attack phrasing, legit
install commands, real citations/licenses) are exactly where context-awareness
wins. High recall is cheap; holding precision on adversarial-looking-but-safe
content is the hard part, and that is the firewall's edge.

Provenance / honesty constraints (do NOT let the paper overstate):
- `no-scanner` and `keyword-grep` are **transparent in-repo baselines**
  (`bench/alternatives/`), NOT named third-party tools. The paper must label
  them as such — attributing a row to trufflehog/promptmap/etc. requires
  actually running that tool (roadmap item; see the phub-corpus-eval ledger).
- Numbers were **py-engine only** while the TS holdout parity gap was open.
  **That gap is CLOSED (2026-10-23): TS holdout recall is now 1.000**, so a TS
  "vs" column is unblocked — add it on the next compare.py pass (compare.py
  currently measures the py engine; wiring the TS column is a phub-corpus-eval
  task, flagged in that ledger).
- The `keyword-grep` **appendix macro F1 (0.708)** differs from the headline
  because the regression methodology folds borderline samples in as
  expected-pass; cite the attack-detection counts, not that macro, in prose.
- Reproducible: `uv run --project apps/api python bench/scripts/compare.py`
  self-verifies the PrimitiveHub column reproduces the committed baseline, and
  writes `bench/comparison/<date>-comparison.json` + `docs/comparison.md`.
  Re-run and re-quote after any corpus/engine change — the corpus-growth plan
  will intentionally lower these numbers (harder benchmark = more credible).

**Why:** a paper that reports only our own F1 (now 1.000) reads as overfit theater;
a measured comparison showing an alternative's 76% false-alarm rate on the
same corpus is the "proof incumbents can't fake" that earns the firewall claim.

**How to apply:** add/update the comparison table + framing in the paper's
evaluation (or a new "vs alternatives" subsection) from the latest
`bench/comparison/*.json`, keeping the honesty constraints above. Keep every
number traceable to a committed comparison JSON, same discipline as
[[project-paper-measured-truth]] and [[feedback-no-fake-numbers]].
