"""Tests for the verdict "show your work" trust-UX (ADR-0041 § 4).

Scope — the guidance layer only (scoring/classification live elsewhere):
  * `finding_guidance()` — per-`detail_tag` "how do I tell a true
    positive from a false positive" copy, with a generic fallback.
  * `class_meaning()` — one-line plain-language meaning per class.
  * `classified_finding_to_wire()` carries both new keys (`classMeaning`,
    `howToJudge`) without dropping the existing stable shape.

These are pure functions — no Django DB needed. Plain pytest.
"""

from __future__ import annotations

from checks.verdict import (
    _CONTEXT_AWARE_NOTE,
    _FINDING_GUIDANCE,
    _GENERIC_GUIDANCE,
    ClassifiedFinding,
    VerdictClass,
    class_meaning,
    classified_finding_to_wire,
    finding_guidance,
)
from scanners.types import Severity

# Tags whose guidance is appended with the context-aware fence note — a
# surviving match for these is, by construction, in plain prose.
_CONTEXT_AWARE_TAGS = ("override-system-instructions", "credential-exfiltration-hint")


# ─────────────────────────────────────────────────────────────────────
# finding_guidance()
# ─────────────────────────────────────────────────────────────────────
class TestFindingGuidance:
    def test_each_known_tag_returns_its_specific_copy(self) -> None:
        for tag, expected in _FINDING_GUIDANCE.items():
            assert finding_guidance("CCI-001", tag) == expected
            assert finding_guidance("CCI-001", tag) != _GENERIC_GUIDANCE

    def test_unknown_tag_falls_back_to_generic(self) -> None:
        assert finding_guidance("CCI-001", "no-such-tag") == _GENERIC_GUIDANCE
        assert finding_guidance("CCI-999", "") == _GENERIC_GUIDANCE

    def test_context_aware_tags_carry_the_fence_note(self) -> None:
        for tag in _CONTEXT_AWARE_TAGS:
            assert tag in _FINDING_GUIDANCE, f"{tag} missing from guidance map"
            assert _CONTEXT_AWARE_NOTE in finding_guidance("CCI-001", tag)

    def test_generic_fallback_has_no_fence_note(self) -> None:
        # The fence note only holds for context-aware detectors — the
        # generic fallback must not claim a filter that may not apply.
        assert _CONTEXT_AWARE_NOTE not in _GENERIC_GUIDANCE

    def test_guidance_keys_on_tag_not_cci_id(self) -> None:
        # v0.1 keys purely on detail_tag; the cci_id is accepted for a
        # future multi-input rubric but must not change today's result.
        tag = next(iter(_FINDING_GUIDANCE))
        assert finding_guidance("CCI-001", tag) == finding_guidance("CCI-007", tag)

    def test_every_guidance_string_is_nonempty(self) -> None:
        assert _GENERIC_GUIDANCE.strip()
        for text in _FINDING_GUIDANCE.values():
            assert text.strip()


# ─────────────────────────────────────────────────────────────────────
# class_meaning()
# ─────────────────────────────────────────────────────────────────────
class TestClassMeaning:
    def test_every_class_has_a_meaning(self) -> None:
        for cls in VerdictClass:
            assert class_meaning(cls).strip(), f"{cls} has no meaning"

    def test_risky_meaning_flags_signature_is_not_proof(self) -> None:
        text = class_meaning(VerdictClass.RISKY).lower()
        assert "signature" in text
        assert "human" in text

    def test_clean_meaning_reads_as_no_signal(self) -> None:
        assert "no risk" in class_meaning(VerdictClass.CLEAN).lower()


# ─────────────────────────────────────────────────────────────────────
# classified_finding_to_wire() — the two new keys ride along
# ─────────────────────────────────────────────────────────────────────
class TestWireShape:
    def _finding(self) -> ClassifiedFinding:
        return ClassifiedFinding(
            cci_id="CCI-001",
            detail_tag="override-system-instructions",
            severity=Severity.FAIL,
            cls=VerdictClass.RISKY,
            detector_name="T1PromptInjectionDetector",
            line=12,
            snippet="ignore all previous instructions",
            suggestion="Fence teaching examples; remove live directives.",
            derivation={"engine": "0.1"},
        )

    def test_wire_carries_class_meaning_and_how_to_judge(self) -> None:
        wire = classified_finding_to_wire(self._finding())
        assert wire["classMeaning"] == class_meaning(VerdictClass.RISKY)
        assert wire["howToJudge"] == finding_guidance("CCI-001", "override-system-instructions")
        assert wire["classMeaning"].strip()
        assert _CONTEXT_AWARE_NOTE in wire["howToJudge"]

    def test_wire_keeps_existing_stable_keys(self) -> None:
        wire = classified_finding_to_wire(self._finding())
        for key in (
            "cciId",
            "detailTag",
            "severity",
            "verdictClass",
            "detectorName",
            "line",
            "snippet",
            "suggestion",
            "filePath",
            "derivation",
        ):
            assert key in wire, f"regressed stable wire key: {key}"
