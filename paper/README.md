# `paper/` — arXiv submission source

> **Status:** v0.1 skeleton. Section outlines + claim-stubs in place;
> prose fill-in is the next round's work. Numbers and corpus references
> come from the auto-generated artifacts under `docs/` so the paper
> stays in sync with the gate.
>
> **Target venue:** arXiv (cs.CR + cs.SE cross-list).
> **Target submission date:** TBD — set once the corpus has matured
> past v0.2 holdout-completeness.

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
| Detector implementation | `apps/api/scanners/` + `packages/phub/src/scanners/` | Version numbers cited via `\detectorversion{tN}` macros in `main.tex` (TBD) |
| Reproducibility command | `bench/scripts/gate.sh` + `bench/cli/replay.py` | Cited verbatim in the Evaluation section |
| External citations | `docs/paper-bibliography.md` | Source of truth for `references.bib`; regenerate when bibliography rows change |

This discipline is enforced socially in v0.1 and will be CI-enforced
in a future round (`paper/Makefile` will diff the paper's claim
strings against the source-of-truth files).

## How to build

Not yet wired. v0.2 will add a `Makefile` with:

```
make paper        # latexmk -pdf main.tex
make paper-check  # diff cited numbers vs docs/evaluation.md
make paper-clean  # rm aux files
```

For now: each `.tex` file is a skeleton with subsections, claim
stubs (one per intended argument), and `% TODO:` comments marking
the prose that still needs to be written.

## Authoring discipline (v0.1)

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
| Abstract | skeleton (claim stubs) | mhm |
| Introduction | skeleton (claim stubs) | mhm |
| Threat Model | skeleton (10 subsections, one per CCI) | mhm |
| System Design | skeleton (5 subsections) | mhm |
| Implementation | skeleton (4 subsections) | mhm |
| Evaluation | skeleton (numbers + Limitations stub) | mhm |
| Related Work | skeleton (cites paper-bibliography.md) | mhm |
| Conclusion | skeleton | mhm |

All sections are READ-OUT-LOUD-able as a structural outline; none
have publication-ready prose.

## Decision log

- **2026-06-06 (Round 8 PR 8.1) — repository structure decided.**
  `paper/main.tex` is the root; sections live as `\input{}`'d files
  under `paper/sections/`. References in `paper/references.bib`.
  This mirrors the standard arXiv submission structure and lets the
  paper draft evolve PR-by-PR (each section as its own commit).
