"""no-scanner baseline — the floor.

Models the status quo for the overwhelming majority of agent-context
pipelines today: nothing inspects the primitive before it is loaded into
the model's context. Every sample passes.

Interpretation of its scores:
  * recall = 0 for every detector (it catches zero attacks).
  * precision is undefined (no positives → None), reported as n/a.
  * It never raises a false positive, so it "costs nothing" operationally —
    which is precisely the trap: the entire attack corpus sails through.

This column exists so the "vs alternatives" table states the baseline
explicitly instead of implying it: without a context firewall, measured
attack-catch rate is 0%.
"""

from __future__ import annotations

from ._base import BaselineDetector, build_detectors


def _predicate_for(_cci_id: str):
    return lambda _ctx: False


def get_all_detectors() -> list[BaselineDetector]:
    return build_detectors(_predicate_for)
