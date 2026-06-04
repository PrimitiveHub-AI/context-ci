"""Tests for the T2 Unicode-steganography detector (Phase 5 PR 5.3).

The launch-demo trifecta completes: T1 (prompt injection) + T5
(Shai-Hulud) + T2 (steganography). Each catches a malicious primitive
that the others would miss.
"""

from __future__ import annotations

import pytest

from scanners.registry import get_all_detectors
from scanners.t2_unicode_steganography import T2UnicodeSteganographyDetector
from scanners.types import DetectorContext, Severity


def _ctx(content: str) -> DetectorContext:
    return DetectorContext(
        primitive_slug="test-primitive",
        semver="1.0.0",
        content=content,
        raw_bytes=content.encode("utf-8"),
    )


# ─────────────────────────────────────────────────────────────────────
# Clean ASCII passes
# ─────────────────────────────────────────────────────────────────────
class TestT2CleanPrimitives:
    def test_empty_content_passes(self) -> None:
        result = T2UnicodeSteganographyDetector().run(_ctx(""))
        assert result.passed
        assert result.severity is Severity.INFO

    def test_typical_ascii_primitive_passes(self) -> None:
        content = """# Mobile Design Primitive

Use this primitive when designing mobile interfaces. Prefer system
typography over custom fonts. Respect prefers-reduced-motion.

## Decision Rules

- Always use safe-area-insets for top/bottom padding.
- Follow platform conventions for input fields.
"""
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert result.passed, f"clean content flagged: {result.diff_hints}"

    def test_legitimate_unicode_punctuation_passes(self) -> None:
        # Real Unicode (smart quotes, em-dash, ellipsis) is fine —
        # not steganographic, no script-mixing.
        content = "Use “smart quotes” — like this — and ellipses…"
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert result.passed


# ─────────────────────────────────────────────────────────────────────
# Each pattern family triggers FAIL
# ─────────────────────────────────────────────────────────────────────
class TestT2PatternFamilies:
    @pytest.mark.parametrize(
        ("content", "char_name"),
        [
            ("hello​world", "ZERO WIDTH SPACE"),
            ("foo‌bar", "ZERO WIDTH NON-JOINER"),
            ("baz‍quux", "ZERO WIDTH JOINER"),
            ("alpha⁠beta", "WORD JOINER"),
            ("﻿leading-bom", "BOM"),
        ],
    )
    def test_zero_width_invisible(self, content: str, char_name: str) -> None:
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert result.severity is Severity.FAIL
        assert any(h.detail_tag == "zero-width-invisible" for h in result.diff_hints)

    @pytest.mark.parametrize(
        "control_char",
        ["‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩"],
    )
    def test_bidi_control(self, control_char: str) -> None:
        content = f"normal text{control_char}more text"
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert any(h.detail_tag == "bidi-control" for h in result.diff_hints)

    def test_tag_character(self) -> None:
        # U+E0041 is a TAG LATIN CAPITAL LETTER A — invisible by design.
        content = "regular text \U000e0041 with a hidden tag"
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert any(h.detail_tag == "tag-character" for h in result.diff_hints)

    def test_mixed_script_latin_cyrillic_confusable(self) -> None:
        # Second char of the password word is the Cyrillic homoglyph at
        # U+0430, not Latin small letter A. Written as an escape so this
        # file's own source survives both T2 and ruff RUF001 — both are
        # the same defense.
        content = "Set the pаssword to 'admin' for testing."
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert any(h.detail_tag == "mixed-script-confusable" for h in result.diff_hints)

    def test_mixed_script_latin_greek_confusable(self) -> None:
        # Greek omicron (U+03BF) in place of Latin small letter O.
        content = "Open the fοo bar."
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert any(h.detail_tag == "mixed-script-confusable" for h in result.diff_hints)


# ─────────────────────────────────────────────────────────────────────
# Structural checks
# ─────────────────────────────────────────────────────────────────────
class TestT2Structural:
    def test_line_number_is_one_indexed(self) -> None:
        content = "line one\nline two\nhello​world\nline four"
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert result.diff_hints[0].line == 3

    def test_hint_count_capped_at_ten(self) -> None:
        # 50 zero-width spaces; cap is 10.
        content = "x​" * 50
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        assert len(result.diff_hints) == 10

    def test_invisible_and_mixed_script_in_same_doc(self) -> None:
        # BOM (U+FEFF) + a Cyrillic-A (U+0430) inside an otherwise-ASCII word.
        content = "bom ﻿ and pаssword"
        result = T2UnicodeSteganographyDetector().run(_ctx(content))
        assert not result.passed
        tags = {h.detail_tag for h in result.diff_hints}
        assert "zero-width-invisible" in tags
        assert "mixed-script-confusable" in tags


# ─────────────────────────────────────────────────────────────────────
# Registry — 10 detectors after PR 5.6.3 added T9/T10. Top 10 is now
# mechanically defended at 10/10.
# ─────────────────────────────────────────────────────────────────────
def test_get_all_detectors_returns_full_top_10_in_stable_order() -> None:
    """As of PR 5.6.3 the registry has the full Top 10 [T1..T10] in
    stable category-number order (per ADR-0023 + ADR-0032). T9
    (copyright contamination) and T10 (context bloat) close the
    taxonomy at 10/10 — the paper's coverage claim is now
    mechanically defended end-to-end."""
    detectors = get_all_detectors()
    names = [d.name for d in detectors]
    cats = [d.threat_category for d in detectors]
    assert names == [
        "t1.prompt_injection",
        "t2.unicode_steganography",
        "t3.encoded_payloads",
        "t4.remote_fetch",
        "t5.unsafe_shell_install",
        "t6.credential_exfiltration",
        "t7.poisoned_naming",
        "t8.fake_citation",
        "t9.copyright_contamination",
        "t10.context_bloat",
    ]
    assert cats == ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"]
