"""The Detector Protocol — the boundary between Context CI and the
specific algorithms that detect specific threat categories.

The Protocol is intentionally minimal (4 attrs + 1 method) so detectors
are trivial to add. New detector = one file in `scanners/`, registered
in `scanners/registry.py`. No Django model, no inheritance hierarchy,
no plug-in framework — just stateless callables.

See ADR-0012 for the full rationale; mirrors the SigstoreBackend
abstraction's design choices (ADR-0011).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from .types import DetectorContext, Verdict


class Detector(Protocol):
    """One detector for one threat category from docs/threat-model.md.

    Attributes
    ----------
    name
        Stable identifier (e.g. `"t1.prompt_injection"`). Recorded in
        every Verdict and in the attestation predicate. Verifiers
        depend on it. Never rename a detector — supersede it with a
        new name and bump its `detector_version`.
    threat_category
        Short code from docs/threat-model.md (`"T1"` through `"T10"`).
        One detector per category in the v1 pipeline.
    detector_version
        Semver. Bumped whenever the detection algorithm changes
        materially. Lets verifiers tell "was this signed by a stale
        detector?".

    Method
    ------
    run(ctx)
        Pure function. No I/O, no Django ORM calls, no network. Runs
        in a Procrastinate task without a request context. Must
        complete in O(seconds) for a typical primitive — slow
        detectors block the signing pipeline.
    """

    name: str
    threat_category: str
    detector_version: str

    def run(self, ctx: DetectorContext) -> Verdict: ...
