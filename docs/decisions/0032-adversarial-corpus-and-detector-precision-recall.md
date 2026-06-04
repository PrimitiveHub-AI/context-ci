# ADR-0032: Adversarial corpus v0.1 + detector precision/recall measurement

**Status:** Accepted
**Date:** 2026-06-04
**Related:** ADR-0016 (Top 10 versioning), ADR-0021 (conformance suite
as executable contract), ADR-0023 (phub CLI + detector parity),
ADR-0025 (active surfaces), ADR-0030 (FP resolution + AV-vendor
parallel), `docs/execution-plan.md` Risk R-7,
`docs/threat-model.md`.

## Context

PrimitiveHub ships scanners with stable IDs (`CCI-001` … `CCI-010`) and
claims they detect 10 categories of agent-context supply-chain attacks.
At submission time the launch paper needs an evaluation section that
answers two questions for every detector:

1. **Recall** — Out of all the attacks of category X, how many does
   our detector catch?
2. **Precision** — Out of everything our detector flags, how much is
   actually an attack?

Today the only test inputs are 4 markdown fixtures in
`packages/phub/test/fixtures/` and a handful per detector in
`apps/api/scanners/tests/`. That's enough to prove the detector
*compiles*, not enough to claim any operating point. The bug-#25
false positive on the project's own CLAUDE.md surfaced this exact
gap — the detector author's docstring honestly noted that the v0.1
detector "prefers false positives to false negatives" without any
numbers backing the trade-off.

Anti-virus vendors solved this problem 25 years ago. AV-TEST,
AV-Comparatives, VirusBulletin all publish quarterly precision/recall
numbers against curated labeled corpora. **A scanner without a
corpus is a scanner without a credibility loop.** This is the
single biggest paper-credibility gap (Risk R-7 in the execution
plan) and the most-cited weakness future reviewers will probe.

This ADR specifies the corpus methodology, the labeling discipline,
the manifest format, the measurement harness, and the governance
that keeps the corpus credible past v0.1.

## Decision

### 1. Ship a labeled adversarial corpus at the repo root

Location: `bench/corpus/`. Top-level (not under `packages/phub/`)
because the corpus is **framework-independent**: both the TypeScript
detectors (`packages/phub/src/scanners/`) and the Python detectors
(`apps/api/scanners/`) MUST be measurable against the same input.
ADR-0023's detector-parity rule means TS and Python verdicts on the
same sample MUST agree; the corpus is where that equivalence becomes
a regression test, not a code-review claim.

```
bench/
  README.md                                  entry point + how to contribute
  LICENSE                                    CC-BY 4.0 (paper-citable)
  corpus/
    manifest.yaml                            machine-readable labels
    samples/
      cci-001-prompt-injection/
        adversarial-NNN-<short-name>.md
        benign-NNN-<short-name>.md
      cci-002-unicode-steganography/
        ...
      cci-005-unsafe-shell-install/
        ...
      <one folder per CCI ID this corpus version supports>
  scripts/
    measure.ts                               TS measurement harness
    measure.py                               Python measurement harness
    package.json                             for the TS side
    tsconfig.json
  baseline/
    YYYY-MM-DD-ts.json                       pinned TS results per run
    YYYY-MM-DD-py.json                       pinned Python results per run
```

The corpus is a **paper-citable artifact**. The `LICENSE` is
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) so academic
work can re-use samples with attribution; the codebase license
(MIT for the scanner code) is separate.

### 2. Sample composition

Each Top 10 category that the v0.1 detector set supports gets
**balanced coverage**:

- **At least 5 adversarial samples per category.** Real attacks,
  drawn where possible from incident reports (Shai-Hulud, xz
  backdoor, prompt-injection writeups, ICLR adversarial-NLP papers).
  Severity varies (a single subtle injection vs. a multi-pattern
  payload).
- **At least 5 benign samples per category.** Content that
  *legitimately discusses* the attack pattern without performing it.
  CLAUDE.md-style hard-rule prose. Threat-model documentation.
  Framework install commands like `npx shadcn@latest` in teaching
  primitives. These are the precision tests — they are what the
  detector MUST NOT flag.
- **At least 2 "borderline" benign samples per category.** The hard
  cases: ambiguous prose, code-fenced examples, negated patterns
  ("never run curl pipe bash"). These drive precision past 90%
  rather than parking it at 70%.

Aspiration for the launch paper:

| Corpus version | Total samples | Categories covered | Minimum per category |
|---|---|---|---|
| v0.1 (this PR) | ~15 seed | T1 + T2 + T5 | 4–5 |
| v0.2 (within 4 weeks) | 100+ | T1 + T2 + T5 (deep) | 30+ |
| v0.3 (by launch) | 500+ | All 10 Top 10 categories | 50+ |
| v1.0 (post-launch) | 1500+ | All 10 + community contributions | 100+ |

v0.1 is the **scaffold**. The volume work is patient labeling over
weeks; the discipline shipping in this ADR is what makes the patient
work credible.

### 3. Manifest format (corpus v0.1)

`bench/corpus/manifest.yaml` is the machine-readable index. Every
sample on disk MUST have a manifest entry; every manifest entry MUST
point to a real file. Schema:

```yaml
version: "0.1"                                  # corpus format version
top10_version: "0.1"                            # Top 10 spec version
license: "CC-BY-4.0"
samples:
  - id: "S-001"                                 # zero-padded, never reused
    path: "samples/cci-001-prompt-injection/adversarial-001-classic.md"
    label: "adversarial"                        # adversarial | benign | borderline
    threat_category: "T1"                       # T1 .. T10 (back-compat)
    cci_id: "CCI-001"                           # Top 10 stable ID
    detail_tags:                                # Optional: which subfamily
      - "override-system-instructions"
    severity: "high"                            # high | medium | low | info
    expected_verdict: "FAIL"                    # PASS | WARN | FAIL
    contributor: "mhm"
    added: "2026-06-04"
    notes: |
      One- or two-line description of why this sample is in the corpus
      and what attack family it represents.
    incident_reference: null                    # URL or null
    parity_status: "ts-py-agree"                # ts-py-agree | ts-only | py-only | drift
```

Required fields: `id`, `path`, `label`, `cci_id`, `expected_verdict`,
`contributor`, `added`, `notes`. Optional: everything else.

**Hard rules:**

- IDs are zero-padded, monotonic, **never re-used**. Reserves a forever
  pointer for paper citations.
- `expected_verdict` is what a *correct* detector says about the
  sample. For adversarial samples typically `FAIL`; for benign
  typically `PASS`. Borderline samples are explicit about which way
  they go and the measurement script computes a separate "precision
  on borderline" metric.
- `contributor` is a real human or "auto:<source>" for samples
  imported from external incident reports. No anonymous entries.
- `parity_status` is computed by the measurement harness, not edited
  by hand. The default for a new entry is `pending`; it ratchets to
  `ts-py-agree` only when both measurement scripts return the
  expected verdict.

### 4. Measurement harness contract

Two scripts, one contract:

- `bench/scripts/measure.ts` — imports the TS detectors from
  `packages/phub/src/scanners/` directly (workspace dep), runs every
  detector against every sample, computes TP/FP/TN/FN per detector
  per category, emits precision/recall/F1, writes a baseline JSON to
  `bench/baseline/YYYY-MM-DD-ts.json`.
- `bench/scripts/measure.py` — same shape, but imports
  `apps/api.scanners` directly.

Both scripts MUST:

1. Read `bench/corpus/manifest.yaml` as the source of truth.
2. Resolve each `path` to a real file on disk; abort if missing.
3. For each sample, run **every** active detector (not just the one
   the sample is labeled for — a sample labeled CCI-001 SHOULD NOT
   trip CCI-002 or CCI-005, and any such cross-trip counts against
   *precision* on the tripping detector).
4. Compute per-detector aggregates:
   - **TP** (true positive): adversarial sample + detector verdict matches its `expected_verdict`
   - **FP** (false positive): benign sample + detector flagged it
   - **TN** (true negative): benign sample + detector cleared it
   - **FN** (false negative): adversarial sample + detector missed it
   - **Precision** = TP / (TP + FP). Undefined (emit `null`) when
     denominator is zero.
   - **Recall** = TP / (TP + FN). Same convention.
   - **F1** = 2 × P × R / (P + R). Same.
5. Output to stdout in a tabular human-readable format AND emit a
   JSON sidecar to `bench/baseline/<date>-{ts,py}.json` when invoked
   with `--write-baseline`.
6. Exit non-zero when invoked with `--gate` and the current measurement
   regresses against the most recent baseline by more than the
   tolerance (default: 0.02 absolute F1 drop on any detector).

### 5. CI integration

`bench/scripts/measure.ts` runs in `phub-ci.yml` on every PR that
touches `packages/phub/src/scanners/**` or `bench/corpus/**`.
`bench/scripts/measure.py` runs in `build-api.yml` on every PR that
touches `apps/api/scanners/**` or `bench/corpus/**`.

Both run with `--gate`. A detector regression that drops F1 by more
than 0.02 blocks the merge. Lockstep with ADR-0023: a detector edit
in either language that doesn't carry a corresponding measurement
update is a defect.

### 6. Governance — sample provenance, contribution, expiry

- **Provenance trail.** Every adversarial sample MUST cite either
  (a) a public incident report, (b) a published research paper, or
  (c) a synthesized example marked `incident_reference: "synthesized"`.
  No "found this somewhere" entries. The provenance protects the
  corpus from accidentally republishing private payloads from an
  internal security review.
- **Contribution flow.** A new sample lands via PR. The PR description
  cites the provenance. The measurement script runs in CI and writes
  the new baseline. Reviewer sign-off requires the security-reviewer
  role for adversarial entries.
- **Expiry.** Samples carry no expiry date. The corpus is append-only
  in the same spirit as `docs/false-positive-resolution.md` § 6 —
  removing a sample requires an ADR-level justification (e.g., the
  detector tightened and the sample is now redundant; the sample
  turned out to misrepresent the attack family). Removed samples
  stay in git history; the manifest ID is never re-issued.
- **Reciprocity with the FP ledger.** When a Path-C resolution
  (detector tightening) lands in `docs/false-positive-resolution.md`,
  the underlying false-positive case MUST be added to the corpus as
  a benign sample. This makes the FP discipline self-reinforcing:
  every detector tightening expands the corpus with the exact case
  that motivated the tightening.

### 7. Cross-language parity is measurable, not aspirational

Per ADR-0023 the TS and Python detectors carry the same `cciId`,
`detectorName`, `detectorVersion`. The corpus turns the parity rule
into a regression gate:

- After running both measurement scripts, the harness diffs the
  per-sample verdicts. Any sample where TS and Python disagree is a
  parity bug (manifest's `parity_status` flips to `drift`).
- The same gate that blocks a measurement regression also blocks a
  parity drift on any sample.
- The lockstep-PR rule extends: a regex change on one side that
  introduces parity drift CANNOT merge without the matching change
  on the other side.

## Alternatives considered

1. **Lazy in-memory corpus, no on-disk manifest.** Rejected. A
   paper-citable artifact needs file paths, IDs, and versions that
   reviewers can independently verify. In-memory test arrays don't
   survive review.

2. **Combine the corpus with `packages/phub/test/fixtures/`.**
   Rejected. The fixtures exist to prove the detector *runs*; the
   corpus exists to characterize its operating point. Different
   audiences (CI vs. paper reviewers), different cardinality (~4 vs.
   500+), different licensing (MIT code license vs. CC-BY corpus
   license).

3. **Generate the corpus via LLM augmentation.** Rejected at v0.1.
   LLM-generated adversarial samples look adversarial but rarely
   *are* — they mimic surface patterns without preserving the
   semantic attack. Real-world incident-derived samples are the gold
   standard. LLM augmentation is a v0.2+ research question once we
   have a labeled seed to anchor it.

4. **Defer until launch.** Rejected. The corpus is the highest-impact
   artifact that compounds with time — labeling 500 primitives takes
   weeks. Starting at launch-minus-4-weeks yields a thin corpus and a
   weak paper. Starting now means the launch-day corpus has 100+
   samples per category.

5. **Treat the corpus as private, sell access.** Rejected. Open
   corpus is the standard play (Sigstore's transparency log, OWASP
   Benchmark, NIST AI-RMF). Private corpus invites accusations of
   number-cooking. Open corpus invites academic adoption and
   citation, which is the actual win.

6. **Use category-only verdict matching (don't penalise
   cross-detector trips).** Rejected. Cross-trip is exactly what
   *precision* measures. A CCI-001 sample that also trips CCI-005
   means CCI-005 has a false positive. Pretending otherwise
   inflates the numbers in a way reviewers will catch immediately.

## Consequences

### Positive

- **Paper evaluation section finally has data.** Submitted numbers
  cite this corpus by version + ID range; reviewers can re-run the
  measurement scripts and verify.
- **Detector regression is structurally caught.** A regex change
  that improves recall by 0.05 but drops precision by 0.10 stops
  being a "feels right" judgment call; the measurement script
  blocks the merge.
- **The FP ledger and the corpus reinforce each other.** Every
  Path-C tightening flows into the corpus as a new benign sample,
  expanding the precision test bed each time the detectors tighten.
- **Cross-language parity becomes provable.** ADR-0023's parity
  rule was previously verified by code review; it is now verified
  by per-sample verdict equality. A drift becomes a gate, not a
  reviewer's vigilance.
- **External contribution path is real.** Security researchers can
  contribute a labeled sample via PR. The corpus becomes a citable
  artifact even before the paper drops.

### Negative

- **The corpus is patient work.** Labeling 500 high-quality samples
  takes weeks of careful effort. There is no shortcut. Mitigation:
  v0.1 starts at 15; v0.3 at launch is 500+; v1.0 post-launch grows
  community.
- **Maintaining provenance trails takes discipline.** Every
  adversarial entry needs a real reference. Synthesized samples are
  honest but not as paper-citable as real-incident samples.
- **CI runtime grows with the corpus.** A 500-sample × 3-detector
  measurement on each PR adds seconds. Mitigation: the measurement
  runs in parallel across detectors; samples are pure markdown +
  regex, so a full pass at 1500 samples is still sub-minute.

### Neutral

- **The corpus drift signal is orthogonal to the lock drift signal.**
  Drift detection (ADR-0026) is about state of an operator's
  project; corpus drift is about behavior of the scanners. Different
  fail modes, both gated separately.
- **Borderline samples are valuable but rare.** They take more
  effort per sample (we're choosing samples that are NEARLY
  adversarial), so the manifest's `label: borderline` count grows
  slower than the binary labels.

## Strategic implications

PrimitiveHub's positioning argument (per ADR-0030 + `docs/positioning.md`)
is "agent-context AV plus registry." The AV product family includes a
signature DB; we have one (Top 10 v0.1). The AV product family also
includes a **public detection rate published by an independent body**
(AV-TEST). PrimitiveHub doesn't have a third-party measurement service
yet, but this corpus is the artifact that makes one possible:

- Phase 1 (v0.1, this ADR): self-measured precision/recall.
- Phase 2 (post-launch): academic co-author or independent security
  group runs the measurement against the public corpus, publishes
  the numbers in a venue PrimitiveHub doesn't control.
- Phase 3 (Phase 12+ in the roadmap): the corpus is referenced in a
  standards-body document (OASIS / IETF) as the canonical evaluation
  set for agent-context scanners.

Without this corpus, that arc doesn't start.

## Implementation

Lands in this PR:

- `bench/README.md` — entry point + contribution guide
- `bench/LICENSE` — CC-BY 4.0
- `bench/corpus/manifest.yaml` — seed manifest (~15 entries
  covering CCI-001, CCI-002, CCI-005)
- `bench/corpus/samples/cci-{001,002,005}-*/` — the seed sample
  markdown files
- `bench/scripts/measure.ts` — TS measurement harness + JSON
  baseline output
- `bench/scripts/measure.py` — Python measurement harness
- `bench/scripts/package.json` + `tsconfig.json` — TS workspace
  for the measurement script
- `bench/baseline/2026-06-04-ts.json` — first TS baseline
- `bench/baseline/2026-06-04-py.json` — first Python baseline
- Cross-doc broadcast: `CLAUDE.md`, `docs/README.md`,
  `docs/execution-plan.md` (Risk R-7 status), `docs/roadmap.md`

Wires into the existing CI follow-up:

- `phub-ci.yml` adds a "measure precision/recall" step gated on
  `bench/corpus/**` or `packages/phub/src/scanners/**` changes
  (added in a follow-up PR; this PR ships the script + the
  baseline, the workflow wiring is one trivial step away).
- `build-api.yml` mirror for Python detectors.

## What ships in subsequent PRs

- **Volume labeling (target v0.2: 100+ samples, v0.3: 500+ samples).**
  Patient work; tracked in `docs/execution-plan.md` Risk R-7
  mitigation.
- **CI gate** wiring `bench/scripts/measure.{ts,py}` into
  `phub-ci.yml` + `build-api.yml` with `--gate` mode.
- **Coverage for CCI-003, CCI-004, CCI-006..CCI-010** as those
  detectors land (lockstep with the apps/api/scanners/ work).
- **Cross-language parity gate** — the measurement scripts already
  compute `parity_status`; the CI extension turns drift into a
  blocking signal.
- **External-contributor README + template** under
  `bench/CONTRIBUTING.md` (post-launch).

## References

- ADR-0016 — Top 10 versioning + `CCI-NNN` stable IDs
- ADR-0021 — Conformance suite as executable contract (sibling
  pattern for the Trust Contract spec)
- ADR-0023 — Detector parity (made measurable by this ADR)
- ADR-0030 — AV-vendor product-family parallel
- `docs/threat-model.md` — what the detectors are designed to find
- `docs/execution-plan.md` — Risk R-7 (corpus too small for credible
  paper claims); this ADR is the mitigation
- `docs/false-positive-resolution.md` — every Path-C resolution
  reciprocally expands the corpus
