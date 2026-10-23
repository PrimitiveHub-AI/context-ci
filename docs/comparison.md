# What we catch vs alternatives

> **AUTO-GENERATED** by `bench/scripts/compare.py`. Source of record: the latest
> `bench/comparison/*-comparison.json`. Every column is scored over the *same* corpus
> and split — only the scanner varies. Re-run:
> `uv run --project apps/api python bench/scripts/compare.py`.

- **Corpus:** v0.2 (Top 10 v0.1) — 99 in-sample + 25 holdout (52 adversarial attacks + 37 benign in-sample)
- **Generated:** 2026-10-23
- **Reproducibility:** ✓ the PrimitiveHub column re-measured here reproduces the committed regression baseline `2026-10-23-py.json` exactly (max F1 Δ 0.0e+00) — same numbers the CI gate publishes.

## What the baselines are

Transparent, **in-repo** algorithms (`bench/alternatives/`), not named third-party products.
A row means exactly its ruleset — nothing is attributed to a tool we did not run. Running
actual OSS/commercial scanners in pinned containers is the next deliverable (see Roadmap).

- **primitivehub** (engine): PrimitiveHub Context CI Top-10 detectors (the firewall).
- **no-scanner** (baseline): Status quo: nothing inspects the primitive before load. The floor.
- **keyword-grep** (baseline): Naive per-category signature grep + unicode/size checks. No context model.

## Headline — attack detection

Of the **52 in-sample adversarial attacks**: how many each scanner
caught, and how many of the **37 benign** samples it falsely flagged.

| Scanner | Attacks caught (in-sample) | Attacks caught (holdout) | Benign false-positives | FP firings |
|---|---:|---:|---:|---:|
| **primitivehub** | 52/52 (100%) | 25/25 (100%) | 0/37 | 0 |
| no-scanner | 0/52 (0%) | 0/25 (0%) | 0/37 | 0 |
| keyword-grep | 42/52 (81%) | 21/25 (84%) | 28/37 | 33 |

*Attacks caught = adversarial samples whose detector fired at the expected severity. Benign false-positives = distinct benign samples wrongly flagged. FP firings = total detector firings on benign samples (one benign sample can trip several detectors).*

## Per-category attacks caught — in-sample

| Scanner | CCI-001 | CCI-002 | CCI-003 | CCI-004 | CCI-005 | CCI-006 | CCI-007 | CCI-008 | CCI-009 | CCI-010 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **primitivehub** | 3/3 | 2/2 | 6/6 | 6/6 | 4/4 | 6/6 | 7/7 | 6/6 | 7/7 | 5/5 |
| no-scanner | 0/3 | 0/2 | 0/6 | 0/6 | 0/4 | 0/6 | 0/7 | 0/6 | 0/7 | 0/5 |
| keyword-grep | 2/3 | 2/2 | 4/6 | 6/6 | 4/4 | 5/6 | 7/7 | 5/6 | 6/7 | 1/5 |

## How to read this

- **no-scanner** is the floor: nothing inspects the primitive, so it catches **0 of 52** attacks. The status quo for most agent pipelines today.
- **keyword-grep** is the naive-scanner trap: signature matching catches many obvious attacks
  but has no context model, so it false-positives on the corpus's deliberately hard benign
  samples — pedagogical docs that *quote* attack phrasing, legitimate install commands, real
  citations, real license files. Recall at the cost of precision.
- **primitivehub** is context-aware (negation, meta-discussion framing, code-fence, byte-level
  analysis), holding precision on exactly those hard benigns while keeping recall — including
  on the held-out slice it was never tuned against.

## Appendix — regression-methodology macro (reproduces the CI gate)

The macro precision/recall/F1 computed by `bench/scripts/measure.py` — the exact number the
regression gate publishes in [`docs/evaluation.md`](./evaluation.md). This methodology folds
borderline samples in as expected-pass, so a do-nothing scanner scores non-zero here; that is
why the headline above uses the direct attack-detection counts instead.

| Scanner | Precision | Recall | F1 | Holdout F1 |
|---|---:|---:|---:|---:|
| **primitivehub** | 1.000 | 1.000 | 1.000 | 1.000 |
| no-scanner | 1.000 | 0.124 | 0.337 | n/a |
| keyword-grep | 0.671 | 0.826 | 0.708 | 0.965 |

## Roadmap — named third-party columns

Next iteration adds columns for real OSS tools run in pinned containers against this same
corpus (candidates: trufflehog / gitleaks → CCI-006; promptmap / rebuff / llm-guard → CCI-001;
unicode linters → CCI-002). That is a heavier deliverable (container pinning + per-tool category
mapping) tracked in the phub-corpus-eval ledger. Until a tool is actually executed here, it gets
no row — measured truth only.

