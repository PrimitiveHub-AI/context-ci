"""Shared types for the Context CI scanner pipeline.

These are crossed by every detector. They're frozen dataclasses (not
Pydantic, not Django models) so they:
  * serialize trivially into the attestation predicate's JSON
  * survive a Procrastinate task boundary as plain dicts
  * are mockable + comparable in tests without ORM noise
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Severity(StrEnum):
    """Detector outcome severity.

    Membership in `FAIL` is the only level that *can* block a primitive
    from reaching `verdict=Trusted` (policy enforcement lands in
    PR 5.4 — pipeline orchestration). `WARN` is reviewer-facing;
    `INFO` is "we ran the check, all clear."
    """

    INFO = "info"
    WARN = "warn"
    FAIL = "fail"


@dataclass(frozen=True, slots=True)
class DiffHint:
    """A reviewer-actionable pointer to a suspicious site in the content.

    `line` is 1-indexed when available; `None` means "applies to the
    whole document" (e.g. token-budget violations from T10 won't have
    a single line). `snippet` is truncated at 120 chars defensively —
    malicious content shouldn't reach the reviewer UI verbatim if it
    contains, say, a base64-encoded payload that would render badly.
    """

    line: int | None
    snippet: str
    suggestion: str
    detail_tag: str = ""  # short identifier for the matched pattern (e.g. "role-hijack")


@dataclass(frozen=True, slots=True)
class Verdict:
    """The result of running one detector against one primitive version.

    `passed` is derived from `severity`: only `Severity.FAIL` flips it
    to `False`. The detector itself decides whether `WARN` should be
    fail-soft (reviewer triages) or fail-hard (auto-block) — currently
    every WARN is `passed=True`, every FAIL is `passed=False`.

    `detector_version` is stored so the attestation predicate is
    reproducible: a re-run against the same content with the same
    detector version MUST produce the same verdict.

    `diff_hints` is capped at 10 by convention to keep the predicate
    bounded — if a primitive triggers more than 10 hits of the same
    pattern, listing all of them adds no information.
    """

    detector_name: str
    threat_category: str
    severity: Severity
    passed: bool
    summary: str
    diff_hints: tuple[DiffHint, ...] = field(default_factory=tuple)
    detector_version: str = "0.1.0"
    # Context CI Top 10 v0.1 stable identifier (CCI-001..CCI-010).
    # Per ADR-0016 this is the canonical taxonomy reference; the legacy
    # `threat_category` field stays for back-compat with existing
    # database attestations. New code SHOULD prefer `cci_id`.
    # Empty string when the detector predates the CCI scheme; only
    # detectors that explicitly opt in via their `cci_id` class attr
    # populate this. See `docs/context-ci-top-10-v0.1.md` § 5.
    cci_id: str = ""

    def as_predicate_dict(self) -> dict[str, object]:
        """Serialize for the attestation predicate's `validation[]` block.

        Stable shape — verifiers depend on it. Adding fields is backward-
        compatible; renaming or removing is not. `cci_id` is the v0.1
        addition (ADR-0016); v0.x consumers ignore unknown keys, so this
        is non-breaking.
        """
        payload: dict[str, object] = {
            "detector_name": self.detector_name,
            "threat_category": self.threat_category,
            "severity": self.severity.value,
            "passed": self.passed,
            "summary": self.summary,
            "detector_version": self.detector_version,
            "diff_hints": [
                {
                    "line": h.line,
                    "snippet": h.snippet,
                    "suggestion": h.suggestion,
                    "detail_tag": h.detail_tag,
                }
                for h in self.diff_hints
            ],
        }
        if self.cci_id:
            payload["cci_id"] = self.cci_id
        return payload


@dataclass(frozen=True, slots=True)
class DetectorContext:
    """Everything a detector might need about the primitive being scanned.

    `content` is the UTF-8 decoded text — most detectors operate on it.
    `raw_bytes` is the original bytes (kept separate because T2
    unicode-steganography and T3 encoded-payloads care about byte-level
    artifacts that decoding can lose).
    `file_path` is the in-archive relative path for multi-file scans
    (e.g. `/check`'s npx + github paths). Detectors that vary behavior
    by filename (T9 skipping LICENSE files; future per-file rules) read
    it. Empty string when the context is a single blob with no
    filename (`mode=content`).
    """

    primitive_slug: str
    semver: str
    content: str
    raw_bytes: bytes
    file_path: str = ""
