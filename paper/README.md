# `paper/` — arXiv submission source

> **Status:** Full draft in the **IEEE conference template**
> (`IEEEtran`, two-column). All eight sections carry publication prose.
> Every number traces to `bench/baseline/2026-06-07-{py,ts}.json` via
> `docs/evaluation.md` — including the imperfect ones. The paper reports
> the measured state: in-sample macro F1 = 0.991 (one CCI-005 false
> positive), and a held-out cross-engine recall gap (Python 1.000,
> TypeScript 0.832). Re-run `bench/scripts/gate.sh` and bump the version
> macros in `main.tex` before submission so the tables stay current.
>
> **Target venue:** arXiv (cs.CR + cs.SE cross-list), IEEE-conference
> formatted for a security venue submission.
> **Target submission date:** TBD — set once the cross-engine holdout
> gap is closed and the corpus has matured past v0.2.

## What's here

```
paper/
├── README.md                   this file
├── main.tex                    document root
├── references.bib              BibTeX from docs/paper-bibliography.md
└── sections/
    ├── abstract.tex
    ├── introduction.tex
    ├── threat-model.tex
    ├── system-design.tex
    ├── implementation.tex
    ├── evaluation.tex
    ├── related-work.tex
    └── conclusion.tex
```

## How this stays in sync with the repo

Every numeric claim in the paper has a single source of truth in the
repo. The paper cites the source, not the number directly:

| Paper claim | Source | Update path |
|---|---|---|
| Per-detector P/R/F1 | `docs/evaluation.md` | Re-run `bench/scripts/gate.sh` → re-generate via `bench/scripts/render-evaluation.py` → re-render paper |
| Threat taxonomy | `docs/threat-model.md` + `docs/top10-corpus-map.md` | Update the corresponding section in those files first; paper text echoes them |
| Detector implementation | `apps/api/scanners/` + `packages/phub/src/scanners/` | Version numbers cited via the `\tonever`..`\ttenver` macros in `main.tex` |
| Reproducibility command | `bench/scripts/gate.sh` + `bench/cli/replay.py` | Cited verbatim in the Evaluation section |
| External citations | `docs/paper-bibliography.md` | Source of truth for `references.bib`; regenerate when bibliography rows change |

This discipline is enforced socially in v0.1 and will be CI-enforced
in a future round (`paper/Makefile` will diff the paper's claim
strings against the source-of-truth files).

## How to build

```
make paper        # latexmk -pdf main.tex   (needs TeX Live / MacTeX)
make paper-check  # citation-coverage gate  (no TeX needed; CI runs this)
make paper-clean  # rm latexmk aux files
```

`make paper-check` is the CI gate: it verifies every `\cite{}` key in
`sections/*.tex` resolves in `references.bib`. The document class is
`IEEEtran` (conference mode); the full draft renders with any standard
TeX distribution.

## Authoring discipline

- **No invented numbers.** Every percent / fraction / count comes
  from `docs/evaluation.md`, `bench/baseline/*.json`, or the corpus
  manifest. If the paper needs a number that isn't yet computed, add
  it to the corpus → measurement → render-evaluation pipeline first.
- **Banned vocabulary applies.** Phrases under
  `docs/brand-voice.md` § "Banned vocabulary" don't ship in the
  paper either. The paper is the project's most-cited piece of
  prose; voice consistency starts here.
- **Cryptographic vocabulary locked.** "Content digest" / "signature"
  / "attestation" / "provenance chain" per CLAUDE.md. Never write
  "SHA-256 signed."
- **Every Top 10 claim links a sample.** When the paper says "the
  detector catches the curl|sh attack," it cites the canonical
  sample ID from `docs/top10-corpus-map.md`. The paper's appendix
  enumerates all samples used in its evaluation.

## Section status

| Section | Status | Owner |
|---|---|---|
| Abstract | full prose; measured numbers | mhm |
| Introduction | full prose | mhm |
| Threat Model | full prose (10 subsections, one per CCI) | mhm |
| System Design | full prose (5 surfaces, 3 pillars) | mhm |
| Implementation | full prose (parity, gate, ledgers, reproducer) | mhm |
| Evaluation | full prose; in-sample + held-out tables | mhm |
| Related Work | full prose | mhm |
| Conclusion | full prose | mhm |

All sections carry publication-ready prose. The numbers reflect the
`2026-06-07` baseline; the one in-sample false positive and the
cross-engine held-out recall gap are reported in the Evaluation section
rather than smoothed over.

## Decision log

- **2026-06-06 (Round 8 PR 8.1) — repository structure decided.**
  `paper/main.tex` is the root; sections live as `\input{}`'d files
  under `paper/sections/`. References in `paper/references.bib`.
  This mirrors the standard arXiv submission structure and lets the
  paper draft evolve PR-by-PR (each section as its own commit).
- **2026-06-07 — recast into the IEEE conference template + measured
  numbers.** `main.tex` switched from `article` to `IEEEtran`
  (conference). All sections rewritten as full prose. Evaluation aligned
  to the committed `bench/baseline/2026-06-07` JSONs: the earlier
  all-`1.000` claims were stale relative to the measured artifacts, so
  the paper now reports macro F1 = 0.991 in-sample and the held-out
  Python-vs-TypeScript recall gap. Detector-version macros updated to
  the current scanner versions.
