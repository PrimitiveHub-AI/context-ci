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
from .t2_unicode_steganography import T2UnicodeSteganographyDetector
from .t3_encoded_payloads import T3EncodedPayloadsDetector
from .t4_remote_fetch import T4RemoteFetchDetector
from .t5_unsafe_shell_install import T5UnsafeShellInstallDetector
from .t6_credential_exfiltration import T6CredentialExfiltrationDetector
from .t7_poisoned_naming import T7PoisonedNamingDetector
from .t8_fake_citation import T8FakeCitationDetector
from .t9_copyright_contamination import T9CopyrightContaminationDetector
from .t10_context_bloat import T10ContextBloatDetector

if TYPE_CHECKING:
    from .protocol import Detector


def get_all_detectors() -> list[Detector]:
    """Return the active detector set in stable category-number order.

    Phase 5 fills this list one detector at a time. PR 5.1 shipped T1;
    PR 5.2 added T5 (Shai-Hulud); PR 5.3 added T2 (Unicode-
    steganography) — the launch-demo trifecta. PR 5.6 added T3 (encoded
    payloads), T4 (remote fetch), T6 (credential exfiltration). PR
    5.6.2 added T7 (poisoned naming / typosquats) and T8 (fake
    citations / invalid CVE/RFC/arXiv). PR 5.6.3 closes the Top 10
    at 10/10: T9 (copyright contamination) + T10 (context bloat).
    """
    return [
        T1PromptInjectionDetector(),
        T2UnicodeSteganographyDetector(),
        T3EncodedPayloadsDetector(),
        T4RemoteFetchDetector(),
        T5UnsafeShellInstallDetector(),
        T6CredentialExfiltrationDetector(),
        T7PoisonedNamingDetector(),
        T8FakeCitationDetector(),
        T9CopyrightContaminationDetector(),
        T10ContextBloatDetector(),
    ]
