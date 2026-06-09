# ADR-0041: The verdict & scoring engine — from regex-counting to risk

**Status:** Proposed
**Date:** 2026-06-05
**Supersedes:** ADR-0034 § 4 (the `100 − 25·FAIL − 10·WARN` trust-score
formula). The `/check` surface, rate-limit, and lookup semantics of
ADR-0034 are unchanged; only the aggregate-scoring clause is replaced.
**Related:** ADR-0023 (detector parity), ADR-0030 (FP resolution +
AV-vendor parallel), ADR-0032/0037/0038 (corpus + holdout),
ADR-0034 (public `/check`), ADR-0035/0036 (markdown + semantic
context), ADR-0040 (surface architecture + anti-bloat),
[`docs/false-positive-resolution.md`](../false-positive-resolution.md)
(FP-006 … FP-014 — all surfaced by scanning one real repo),
[`docs/principles.md`](../principles.md) Principles 19–20,
[`docs/doctrine.md`](../doctrine.md).

## Context

`/check` scanning a real, legitimate security-education repository
(`mukul975/anthropic-cybersecurity-skills`, 4,190 files, 28 MB
unpacked) returns **trust score 0/100, "High risk"** off **11 FAIL /
48 WARN against ~41,840 detector results (0.03 %)**. The repo is an
Anthropic-derived corpus of cybersecurity *skills*; the findings are
overwhelmingly dual-use teaching content — a prompt-injection-testing
skill that names `"ignore previous instructions"` in prose, a
homoglyph-detection skill that demonstrates `gооgle`, the RFC 3526
1536-bit MODP Diffie-Hellman prime flagged as a `base64-long-blob`,
official `anchore.io` `curl … | sh` install lines, a `CC-BY 4.0`
attribution marker.

We have spent FP-006 through FP-014 tightening **signatures** one
mention-shape at a time (T5 code-fences in v0.2.1; T1/T3/T4 in FP-011;
T8 in FP-012/13; T1 again in FP-014). That work is correct but it
attacks a combinatorial space linearly — every new real-world repo
surfaces a new shape, and the verdict still collapses to 0. **The
signatures are not the thing that is broken. The verdict engine is.**

The current engine is [`apps/api/checks/scan.py`](../../apps/api/checks/scan.py):

```python
# ADR-0034 § 4, locked
score = max(0, 100 − 25·count(FAIL) − 10·count(WARN))
```

Three structural defects, all visible in code:

1. **No verdict-class separation.** A `CC-BY` licensing marker
   (CCI-009 `cc-attribution-required`) subtracts the same −25 as a
   credential-exfiltration payload. Licensing hygiene and supply-chain
   compromise are the *same number*. That is a category error.
2. **No density / proportionality.** `aggregate_files()`
   ([scan.py:141](../../apps/api/checks/scan.py#L141)) flattens every
   file's verdicts into one tuple and applies the flat formula. A 2 KB
   primitive and a 4,190-file repo with the same 11 hits score
   identically. The formula floors at **four FAILs** — a number a
   large repo of *any* provenance reaches on dual-use content alone.
3. **No confidence axis.** A regex match and a confirmed attack are
   indistinguishable to the score. `curl … | sh` of the official
   grype installer and a Shai-Hulud payload both read as FAIL.

This is precisely the **"scanner becomes the noisy boy who cries wolf"**
failure mode ADR-0030 § 1 names as the thing the whole FP discipline
exists to prevent — reproduced inside our own headline number. A
product that "goes globally" cannot ship a verdict that is wrong on the
first legitimate security repo it meets, and cannot be gated on a human
authoring the next FP-NNN for every repo's novel mention-shape.

ADR-0040 locked the rule that **engine depth is free, surface breadth
is taxed**. The verdict engine is the deepest, most load-bearing piece
of engine behind the `/check`, `phub scan`, and `phub audit` surfaces.
This ADR invests there — no new surface — to make the one number every
surface emits actually mean *risk*.

## Decision

Replace the single severity→score collapse with a **verdict engine**
that classifies each finding on two axes, separates security risk from
policy hygiene, and aggregates density-aware. Everything below is
**deterministic** — versioned tables and explicit signals, no ML, no
probabilistic suppression — to stay inside ADR-0030 § 2.

### 1. Two axes per finding: pattern-confidence × malice-confidence

Every finding already carries **pattern-confidence** implicitly (the
detector fired). The engine adds **malice-confidence**: a deterministic
tier computed from explicit, auditable inputs:

```
malice_tier(f) = VERDICT_RUBRIC[
    f.cci_id,
    f.detail_tag,
    f.context_annotation,    # Layer 1 (ADR-0035/0036; default: unknown)
    artifact.role_class,     # Layer 2 (ADR-0043; default: unknown)
    f.registry_hit,          # known-constants / known-good-source (ADR-0043)
    artifact.provenance,     # Layer 4 (ADR-0013 attestation; default: none)
]
```

`VERDICT_RUBRIC` is a **versioned public table** (same governance shape
as the Top 10 and the corpus). When an input is `unknown` — i.e.
before Layers 1/2/4 land — the rubric **fails safe**: it never assigns
a tier *below* the detector's own severity. The engine can make the
score more honest; it can never silently clear a finding. (Path-D
discipline preserved: ambiguous stays visible.)

### 2. Four verdict classes replace the single severity ladder

| Class | Meaning | Effect on the security score |
|---|---|---|
| `MALICIOUS` | high malice-confidence — a live attack | dominates: forces high-risk band |
| `RISKY` | dual-use / needs human review | bounded, density-damped penalty |
| `POLICY` | licensing / attribution / hygiene | **none** — separate hygiene track |
| `CLEAN` | matched a known-good constant/source, or context-cleared | none |

The CCI-009 license family (`cc-attribution-required`,
`permissive-license-header`, `gpl-header`) maps to `POLICY` **today**,
with no new layer required — those detail-tags are already emitted.
That single reclassification stops a licensing marker from ever sinking
a *trust* score again.

### 3. The score is risk, density-aware, and a single finding cannot zero it

The security score is computed **only** over `MALICIOUS` + `RISKY`
findings — `POLICY` and `CLEAN` never touch it:

```
if any MALICIOUS:
    score = max(0, 40 − 20·n_malicious)      # one real attack ⇒ high-risk band
else:
    risky_penalty = min(RISKY_CAP, Σ weight(f) · density_damp(f))
    score = 100 − risky_penalty              # dual-use mentions are bounded
```

Two principles encoded:

- **The needle dominates the haystack — asymmetrically.** A *single*
  `MALICIOUS` finding lands the verdict in the high-risk band
  regardless of repo size: density-damping is applied to `RISKY` only,
  **never** to `MALICIOUS`. One real payload in 10,000 clean files must
  still scream.
- **The haystack cannot manufacture a scream.** No quantity of
  `RISKY` dual-use mentions can drive the score below `100 − RISKY_CAP`.
  A legitimate security-education repo with many demonstrated patterns
  lands in *caution-with-review*, not *high-risk*.

`density_damp(f)` collapses repeated identical findings (same
`cci_id` + `detail_tag` + snippet across many files) toward a single
weighted hit — a repo that documents one install pattern in 40 READMEs
is one finding, not forty. The rubric weights, `RISKY_CAP`, and the
band thresholds are **design parameters calibrated against the
repo-verdict corpus** (§5), not asserted constants — their correctness
is a reproducible number, never a claim.

### 4. The verdict is auditable — every finding shows its derivation

ADR-0030: *"the product cannot ship a badge backed by an allowlist no
one audited."* The same applies to the score. The response gains a
`derivation` block per finding — which inputs moved it to its class —
and a top-line breakdown: `{malicious, risky, policy, clean}` counts +
the penalty arithmetic. A reviewer reproduces `0`→`62` by hand from the
verdict shape alone, exactly as `trust_score()` is reproducible today.

### 5. Measure the repo-level verdict, not just per-detector F1

Per-detector precision/recall (ADR-0032) is necessary and radically
insufficient: a detector at F1 = 1.000 on single primitives coexists
with a `0/100` on a legitimate repo because **aggregation is
untested**. This ADR adds a **repo-verdict tier** to the corpus:
labeled whole repositories with an `expected_band` (this repo →
`caution`, expected class mix `{malicious: 0, risky: >0, policy: 1}`).
The corpus gate (ADR-0037) extends to assert the engine produces the
right *top-line*. That is the only number that matters when the product
goes global.

### 6. What this ADR ships standalone vs. what it defines an interface for

Shippable **now**, no new detection layer, strictly safer than today:

- verdict-class separation (POLICY out of the security score);
- density-damping + `RISKY_CAP` + the MALICIOUS-dominates structure;
- the `derivation` block + repo-verdict corpus tier.

This alone moves this repo from `0 / high-risk` to roughly
`caution-with-review` — by making the score *honest*, never by
*clearing* a finding it shouldn't.

Defined here as an **interface**, delivered by follow-on ADRs that plug
into `VERDICT_RUBRIC`:

- **ADR-0042** — promote the use-mention context layer (ADR-0035/0036)
  to a shared pipeline stage + conformance gate, so detectors stop
  re-deriving "used vs mentioned" per-detector (the FP-006…014
  treadmill). Supplies `context_annotation`.
- **ADR-0043** — role/intent gate (`security-education` etc., *inferred
  and flagged for review* pre-launch, signed-attestation at launch) +
  the known-constants / known-good-source registries (the EICAR /
  RFC-3526-prime / official-installer analogues). Supplies
  `role_class`, `registry_hit`, and the malice promotions to
  `MALICIOUS`.

Until those land, every corresponding input is `unknown` and the rubric
fails safe (§1).

## Alternatives considered

1. **Keep tightening signatures (more FP-NNN).** Rejected as the
   *primary* strategy. It is correct, ongoing work, but linear against a
   combinatorial space — it converges on *regexes*, never on the
   *verdict*. ADR-0030's FP ledger stays; it is no longer asked to
   carry a job (a sane top-line score) it was never designed for.
2. **A single tunable threshold ("only FAIL ≥ N is high-risk").**
   Rejected: still one axis. It cannot tell a licensing marker from a
   payload, and any global threshold is wrong for both a 2 KB skill and
   a 28 MB repo.
3. **ML / heuristic risk scoring.** Rejected by ADR-0030 § 2 — and on
   merit: an unauditable score is exactly what we refuse to ship. The
   rubric is deterministic and reviewer-reproducible.
4. **Normalize all findings by repo size.** Rejected: it hides the
   needle. Density-damping is applied to `RISKY` only; `MALICIOUS` is
   never normalized away.
5. **Patch the formula constants in place (e.g. −10 per FAIL).**
   Rejected: re-tuning a structurally wrong formula. The defect is the
   absence of classes and density, not the magnitude of a coefficient.

## Consequences

### Positive

- The headline number measures **risk**, not regex-hit-count. The
  crying-wolf failure mode (ADR-0030 § 1) is closed in our own product.
- **Convergence changes shape.** Honest verdicts no longer depend on a
  human authoring the next FP-NNN per repo. The FP ledger returns to
  its real job (detector precision); the engine carries the verdict.
- **Paper-grade.** A density-aware, class-separated, fully-derivable
  score is a reproducible artifact a reviewer re-derives — the
  `(corpus, commit)` reproducibility story (ADR-0032) now extends to
  the top-line verdict.
- **Global-scale ready.** The structure (needle dominates, haystack
  cannot scream, provenance/role plug in) is the mechanism that lets
  the product meet arbitrary real-world repos without per-repo triage.

### Negative

- **`VERDICT_RUBRIC` is a new versioned artifact** to govern (parity
  TS+Py per ADR-0023, re-review per ADR-0030 § 4). Deliberate cost; it
  is engine depth, which ADR-0040 says is free.
- **Calibration debt.** `RISKY_CAP`, weights, and band thresholds need
  the repo-verdict corpus (§5) to be tuned, not guessed. Until that
  corpus exists they are provisional and labeled as such (no-fake-
  numbers discipline).
- **Two scores to explain** (security vs. hygiene). Mitigated: the UI
  headline is the band + class breakdown; the number is auxiliary
  (already the ADR-0034 stance).

### Neutral

- ADR-0034's `/check` surface, rate-limit, and by-digest lookup are
  untouched. Only the `trust_score()` / `build_summary()` aggregation
  in `scan.py` is replaced.
- The four verdict classes are an engine concept; the public Top 10
  taxonomy is unchanged (no surface breadth — ADR-0040 § 2 respected).

## Implementation

Lands in this ADR's PR (standalone, safe — §6):

- `apps/api/checks/scan.py` — replace `trust_score()` with the
  class-separated, density-aware engine; add `classify_verdict()` and
  the `derivation` block to `build_summary()`. Mirror in
  `packages/phub/src/scanners/` aggregation per ADR-0023.
- `VERDICT_RUBRIC` v0.1 — the POLICY mappings (CCI-009 license family)
  + safe defaults (every other finding ≥ its current severity).
- `bench/corpus/` — repo-verdict tier: this repo as the first labeled
  whole-repo sample (`expected_band: caution`), and the corpus gate
  (ADR-0037) extended to assert the band.
- `docs/decisions/0034-public-check-lookup-surface.md` — § 4 marked
  superseded-by-0041.
- Regression tests in `apps/api/checks/tests/test_check_api.py` locking:
  POLICY findings do not move the security score; `RISKY_CAP` floors a
  dual-use-heavy repo above high-risk; one synthetic `MALICIOUS`
  dominates a large clean repo.

Tracked follow-ons (not blocking): ADR-0042 (context layer), ADR-0043
(role gate + registries), Layer-4 provenance wiring into
`artifact.provenance`.

## References

- ADR-0034 § 4 — the superseded formula
- ADR-0030 — FP discipline + the § 2 determinism guardrails this engine
  honors
- ADR-0032/0037/0038 — corpus, gate, holdout (the measurement bed §5
  extends)
- ADR-0040 — engine depth is free; this is engine depth
- `docs/false-positive-resolution.md` FP-006 … FP-014 — the linear
  treadmill this ADR ends
- `apps/api/checks/scan.py` — the engine being replaced
