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
from .t5_unsafe_shell_install import T5UnsafeShellInstallDetector

if TYPE_CHECKING:
    from .protocol import Detector


def get_all_detectors() -> list[Detector]:
    """Return the active detector set in stable category-number order.

    Phase 5 fills this list one detector at a time. PR 5.1 shipped T1;
    PR 5.2 (this) adds T5 (Shai-Hulud); PR 5.3 adds T2 (unicode-steg);
    the remaining 7 land in PR 5.6.
    """
    return [
        T1PromptInjectionDetector(),
        T5UnsafeShellInstallDetector(),
    ]
