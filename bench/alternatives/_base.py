"""Shared scaffolding for comparison baselines.

An "alternative scanner" in this directory is a stand-in for *something
other than PrimitiveHub* run against the exact same corpus, scored by the
exact same harness (`bench/scripts/measure.py` → `score_sample`). This lets
`bench/scripts/compare.py` produce an apples-to-apples "what we catch vs
alternatives" matrix: every column is computed with one scoring algorithm,
one split, one manifest.

Each baseline module here exposes `get_all_detectors()` returning ten
objects conforming to `scanners.protocol.Detector` — one per CCI-001..010 —
so it drops straight into `measure.measure(samples, detectors)`.

HONESTY CONTRACT (measured-truth, no fake numbers):
  * These baselines are TRANSPARENT, fully-specified algorithms whose rules
    live in this repo. They are NOT named commercial/OSS products. A row
    labelled "keyword-grep baseline" means exactly the ruleset in
    `keyword_baseline.py` — nothing is attributed to a tool we did not run.
  * Running actual named third-party tools (trufflehog, gitleaks, promptmap,
    llm-guard, rebuff, …) in pinned containers against this corpus is a
    separate, planned deliverable — see docs/comparison.md § Roadmap.
  * The baselines are designed from each threat's *semantics* (what a
    competent engineer would grep for), not reverse-engineered from the
    corpus to lose. Whatever precision/recall they score is reported as-is.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

# Make `apps.api.scanners` importable when a baseline module is imported
# directly (compare.py also does this; doing it here keeps the modules
# standalone-importable for unit tests).
REPO_ROOT = Path(__file__).resolve().parents[2]
APPS_API = REPO_ROOT / "apps" / "api"
if str(APPS_API) not in sys.path:
    sys.path.insert(0, str(APPS_API))

from scanners.types import DetectorContext, Severity, Verdict  # noqa: E402

# Canonical CCI id ↔ legacy threat-category ↔ human name. Mirrors
# scanners/registry.py ordering so baseline output lines up with the engine.
CCI_CATALOG: tuple[tuple[str, str, str], ...] = (
    ("CCI-001", "T1", "prompt-injection"),
    ("CCI-002", "T2", "unicode-steganography"),
    ("CCI-003", "T3", "encoded-payloads"),
    ("CCI-004", "T4", "remote-fetch"),
    ("CCI-005", "T5", "unsafe-shell-install"),
    ("CCI-006", "T6", "credential-exfiltration"),
    ("CCI-007", "T7", "poisoned-naming"),
    ("CCI-008", "T8", "fake-citation"),
    ("CCI-009", "T9", "copyright-contamination"),
    ("CCI-010", "T10", "context-bloat"),
)


@dataclass(frozen=True, slots=True)
class BaselineDetector:
    """A single-category detector conforming to `scanners.protocol.Detector`.

    `predicate(ctx) -> bool` returns True when this baseline considers the
    sample a hit for its category. A hit maps to `Severity.FAIL` (the only
    level the scoring harness treats as "detected"); a miss maps to
    `Severity.INFO` (the engine's "ran, all clear").
    """

    cci_id: str
    threat_category: str
    name: str
    predicate: "object"  # Callable[[DetectorContext], bool]; typed loosely to stay frozen+slots
    detector_version: str = "baseline-0.1.0"

    def run(self, ctx: DetectorContext) -> Verdict:
        hit = bool(self.predicate(ctx))  # type: ignore[operator]
        severity = Severity.FAIL if hit else Severity.INFO
        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            severity=severity,
            passed=not hit,
            summary=f"{self.name}: {'hit' if hit else 'clear'}",
            cci_id=self.cci_id,
        )


def build_detectors(predicate_for) -> list[BaselineDetector]:
    """Build the 10-detector set from a `predicate_for(cci_id) -> predicate`.

    `predicate_for` returns the per-category predicate callable; use a
    no-op `lambda ctx: False` for categories a baseline cannot address.
    """
    return [
        BaselineDetector(
            cci_id=cci,
            threat_category=tcat,
            name=f"{prefix_name(predicate_for)}.{short}",
            predicate=predicate_for(cci),
        )
        for (cci, tcat, short) in CCI_CATALOG
    ]


def prefix_name(predicate_for) -> str:
    """Best-effort scanner label from the factory's __module__."""
    mod = getattr(predicate_for, "__module__", "") or ""
    return mod.rsplit(".", 1)[-1] or "baseline"
