# PrimitiveHub Adversarial Corpus + Measurement Harness

[![License: CC BY 4.0 (corpus content)](https://img.shields.io/badge/Corpus%20License-CC%20BY%204.0-lightgrey.svg)](./LICENSE)

**Spec:** [docs/corpus-v0.1.md](../docs/corpus-v0.1.md)
**ADR:** [ADR-0032](../docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md)

A labeled dataset of agent-context primitives used to measure the
precision and recall of PrimitiveHub's Context CI scanners. Both the
TypeScript detectors (`packages/phub/src/scanners/`) and the Python
detectors (`apps/api/scanners/`) measure against the **same**
corpus, making cross-language parity (ADR-0023) measurable rather
than reviewer-attested.

## Quick run

TypeScript side:

```bash
cd bench/scripts
pnpm install
pnpm tsx measure.ts                      # measure + write baseline JSON
pnpm tsx measure.ts --baseline ../baseline/2026-06-04-ts.json  # compare
pnpm tsx measure.ts --gate               # CI mode: exit 1 on regression
```

Python side:

```bash
cd apps/api
uv run python ../../bench/scripts/measure.py
uv run python ../../bench/scripts/measure.py --gate
```

## Layout

```
bench/
├── README.md                                 (this file)
├── LICENSE                                   CC BY 4.0 (corpus content only)
├── corpus/
│   ├── manifest.yaml                         single source of truth
│   └── samples/
│       ├── cci-001-prompt-injection/
│       ├── cci-002-unicode-steganography/
│       └── cci-005-unsafe-shell-install/
├── scripts/
│   ├── measure.ts                            TS measurement harness
│   ├── measure.py                            Python measurement harness
│   ├── package.json                          for the TS side
│   └── tsconfig.json
└── baseline/
    ├── 2026-06-04-ts.json                    pinned baselines, per language
    └── 2026-06-04-py.json
```

## Contributing a sample

1. Place the markdown under
   `bench/corpus/samples/<cci-id>-<short-name>/<label>-<NNN>-<slug>.md`.
2. Append a manifest entry to `bench/corpus/manifest.yaml` with the
   next available `S-NNN` id. **IDs are never re-used.**
3. Cite provenance: real URL OR the literal string `"synthesized"`
   in `incident_reference`. Empty references on adversarial samples
   are defects.
4. Open a PR; CI runs both measurement scripts. Reviewers verify the
   manifest entry matches the file and the provenance is real.
5. Security-reviewer sign-off is required for `label: adversarial`
   entries.

See [docs/corpus-v0.1.md § Governance](../docs/corpus-v0.1.md) for the
full contribution + removal + versioning rules.

## What the seed corpus covers (v0.1)

Three categories, matched to the launch-demo detector trifecta:

| Category | Detector | Samples |
|---|---|---|
| CCI-001 | T1 prompt injection | 5 (3 adversarial, 1 benign, 1 borderline) |
| CCI-002 | T2 Unicode steganography | 4 (2 adversarial, 1 benign, 1 borderline) |
| CCI-005 | T5 unsafe shell install | 6 (3 adversarial, 2 benign, 1 borderline) |

**Total: 15 samples.** Per [ADR-0032 § 2](../docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md),
the v0.3 launch-day target is 500+ samples across all 10 Top 10
categories. The seed is the scaffold; the volume is patient work
tracked under `docs/execution-plan.md` Risk R-7.

## Cross-language parity

The manifest's `parity_status` field is computed by the measurement
harness, not edited by hand. After running both `measure.ts` and
`measure.py`, the harness diffs the per-sample verdicts. Any sample
where TS and Python disagree gets `parity_status: drift` and the
lockstep-PR rule (ADR-0023) requires both sides to be touched in
the same PR to merge.

## Citation

When citing the corpus in a paper:

> PrimitiveHub Adversarial Corpus v0.1 (CC BY 4.0). Measured against
> Context CI Top 10 v0.1 at commit `<sha>`. Available at
> `<repo>/bench/corpus/`.

The launch paper will cite a specific `(corpus_version, top10_version,
language, commit_sha)` tuple; reviewers reproduce the numbers by
checking out that commit and re-running the measurement scripts.
