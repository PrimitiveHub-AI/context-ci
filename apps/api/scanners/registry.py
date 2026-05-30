"""Registry of active Context CI detectors.

Single source of truth for "what detectors run in the pipeline." The
sign task calls `get_all_detectors()` and iterates. Adding a new
detector = one import line here.

The order matters loosely — failing detectors are reported in this
order in the attestation predicate, which is what reviewer dashboards
display. We sort by threat-category number so the visual output is
stable (T1 first, T10 last).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .t1_prompt_injection import T1PromptInjectionDetector

if TYPE_CHECKING:
    from .protocol import Detector


def get_all_detectors() -> list[Detector]:
    """Return the active detector set in stable category-number order.

    Phase 5 fills this list one detector at a time. PR 5.1 ships T1
    alone; T2/T5 land in PR 5.2/5.3; the remaining 7 in 5.6.
    """
    return [
        T1PromptInjectionDetector(),
    ]
