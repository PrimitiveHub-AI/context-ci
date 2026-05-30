# ADR-0012: Detector Protocol for Context CI

**Status:** Accepted
**Date:** 2026-05-30
**Supersedes:** none

## Context

Phase 5 builds Context CI — the detection pipeline that turns "Trusted"
from a sticker into a cryptographic claim about safety. Ten detectors,
one per threat category from `docs/threat-model.md` (T1 through T10).

We need a contract for "what a detector is" that:

1. Lets each threat have its own algorithm without the surrounding
   pipeline knowing the internals.
2. Survives the Procrastinate task boundary (workers run outside the
   request cycle; detectors must work as stateless callables).
3. Produces structured output that flows into the in-toto attestation
   predicate's `validation[]` block without per-detector special-casing.
4. Lets us add a new detector in one file without touching the
   pipeline, sign task, or migration layer.
5. Is testable in isolation — no Django DB, no network, no fixtures.

## Decision

A minimal `Detector` Protocol in `apps/api/scanners/protocol.py`:

```python
class Detector(Protocol):
    name: str               # stable id, e.g. "t1.prompt_injection"
    threat_category: str    # "T1" .. "T10"
    detector_version: str   # semver — recorded in every Verdict

    def run(self, ctx: DetectorContext) -> Verdict: ...
```

Four attributes, one method. Stateless. Pure function of
`DetectorContext → Verdict`. The output (`scanners/types.py`) is a
frozen dataclass that serializes trivially via `as_predicate_dict()`.

Registry (`scanners/registry.py`) is a single function
`get_all_detectors() -> list[Detector]` that returns the active set
in threat-category order. The Procrastinate sign task iterates this
list, runs each detector, and merges the verdicts into the
attestation predicate before calling `SigstoreBackend.sign()`.

## Alternatives considered

1. **Inheritance from a `BaseDetector` ABC.** Rejected. The Protocol
   gives us structural typing without forcing a class hierarchy.
   Detectors that want to share helpers can; detectors that don't
   stay one file.

2. **Django apps per detector.** Rejected. Detectors don't need ORM,
   migrations, or admin. Bundling them under a single `scanners` app
   keeps `INSTALLED_APPS` short and discoverable.

3. **Plugin entry-points (`importlib.metadata`).** Rejected for v1.
   Plugins are useful when third parties write detectors; we ship
   all 10 in-tree for the launch. Plugin discovery adds complexity
   that doesn't earn its keep yet. **Revisit in Phase 11** when
   federation lands.

4. **Detector returns just `pass/fail bool`.** Rejected. The
   attestation predicate is the long-lived artifact that consumers
   verify; we need to record SEVERITY (info/warn/fail), DIFF HINTS
   (line + snippet + suggestion), and DETECTOR VERSION (for
   reproducible verification). A `Verdict` dataclass with these
   fields is the contract that makes "Trusted" a real claim.

5. **Detectors emit events; pipeline aggregates.** Rejected as
   premature event-sourcing. Detectors are synchronous and bounded;
   a function return is the right shape.

6. **Stage-rows-as-Detector.** I.e. one Django model row per detector
   run. Considered. We DO write `validation.PipelineStage` rows for
   the UI surface (Phase 5 PR 5.4), but the detector itself returns
   plain Verdicts — the row is a projection of the Verdict for
   query/display, not the detector's primary output. Separation
   keeps Verdicts JSON-serializable for the predicate.

## Consequences

### Positive
- **Adding a detector is one file.** `scanners/t<n>_<name>.py` +
  one import line in `scanners/registry.py`. PR scope per detector
  is small and reviewable.
- **Verdicts are predicate-ready.** `Verdict.as_predicate_dict()`
  returns the exact shape the in-toto Statement uses; no separate
  serializer.
- **Stateless = trivial tests.** No Django DB, no fixtures. Each
  detector's test file is plain pytest + parametrize.
- **Stateless = parallelizable.** Phase 5 PR 5.4 will run detectors
  concurrently in the sign task; the Protocol's purity makes this
  safe by construction.
- **Verifier story is clean.** A future `phub verify` CLI loads the
  attestation, reads `predicate.validation[]`, sees every
  detector's name + version + verdict + diff hints. Reproducible
  without round-tripping through PrimitiveHub.

### Negative
- **No detector-level configuration.** All detectors run on every
  upload with default settings. Per-org policy (e.g. "disable T7
  for trusted partners") will require a config layer on top —
  Phase 6 or 7. Acceptable: v1 ships with one global policy and
  the in-toto Statement records what ran.
- **No async detectors.** A detector that wants to call an LLM
  (e.g. "T8 fake-citation" could benefit from a fact-checking LLM)
  would block the sign task. v0 detectors are all regex/heuristic;
  Phase 6+ may add an `AsyncDetector` Protocol if LLM-backed
  detectors land.
- **Detector failures crash the sign task.** A buggy detector that
  raises will abort the sign. v0.1 mitigation: every detector test
  has a "doesn't raise on empty input" assertion. v0.2: wrap each
  detector call in try/except, record a `Severity.WARN` verdict
  for the failed detector, continue the pipeline.

### Neutral
- **The Protocol is in `scanners/protocol.py`, not `scanners/types.py`.**
  Keeps the Protocol declaration close to its consumers (detectors
  import from `types.py`; the registry imports from `protocol.py`).

## Implementation

- `apps/api/scanners/__init__.py` — module docstring
- `apps/api/scanners/apps.py` — Django AppConfig
- `apps/api/scanners/types.py` — `Severity`, `DiffHint`, `Verdict`,
  `DetectorContext` (frozen dataclasses + `StrEnum`)
- `apps/api/scanners/protocol.py` — `Detector` Protocol
- `apps/api/scanners/registry.py` — `get_all_detectors()` factory
- `apps/api/scanners/t1_prompt_injection.py` — first concrete
  detector; 4 pattern families (override, role-hijack,
  hidden-instructions, exfil-hint), pre-compiled regex pool
- `apps/api/tests/test_scanners_t1.py` — 24 tests
- `apps/api/jobs/sign_tasks.py` — fetch content from R2, build
  `DetectorContext`, run all detectors, merge verdicts into
  `attestation.predicate["validation"]`, then sign

## What ships in subsequent Phase 5 PRs

- **PR 5.2** — T5 (unsafe-shell-install). Most-cited threat in the
  supply-chain narrative; killer demo content.
- **PR 5.3** — T2 (unicode-steganography). Zero-width chars, RTL
  overrides, lookalike Cyrillic. "Didn't think of that" factor for
  the arXiv paper.
- **PR 5.4** — Pipeline orchestration. `validation.PipelineStage`
  rows materialized from the predicate; `verdict=Trusted` gated on
  all-pass; parallel detector execution.
- **PR 5.5** — Malicious-primitive test suite. One purposely-evil
  primitive per category. Becomes the demo content + the paper's
  evaluation set.
- **PR 5.6** — Remaining 7 detectors (T3, T4, T6, T7, T8, T9, T10),
  batched 2-3 per micro-PR.
- **PR 5.7** — Web UI surfaces live `validation.PipelineStage` rows
  (currently mocked).

## References

- `apps/api/scanners/` — implementation
- `docs/threat-model.md` — the 10 threat categories
- `docs/spec.md` § Predicate — predicate schema that consumes
  `validation[]`
- ADR-0011 — the SigstoreBackend abstraction; this ADR mirrors its
  Protocol-over-inheritance design choices
