"""T2 — Unicode Steganography.

Hidden payloads encoded in Unicode codepoints that render invisibly,
or characters that look identical to ASCII letters but are from
different scripts. The reviewer eyeballs the markdown, sees a
benign-looking primitive, signs it. The agent's tokenizer reads the
hidden codepoints — and obeys instructions the human never saw.

This is the "didn't think of that" category. It's well-documented in
the academic literature (Boucher & Anderson, "Trojan Source", 2021)
and there's no legitimate use for any of these patterns inside a
PrimitiveHub markdown document.

What this detector flags
------------------------

  zero-width-invisible
    U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+2060 (WJ),
    U+FEFF (BOM / ZWNBSP). Render as nothing; let an attacker
    smuggle text past visual inspection.

  bidi-control
    U+202A..U+202E + U+2066..U+2069 — RTL/LTR overrides and isolates.
    Trojan Source attacks reorder visible characters so the source
    reads one way but the parser sees another. No legitimate use
    in markdown content (real RTL text doesn't need overrides).

  tag-character
    U+E0000..U+E007F. Historical encoding range; modern usage is
    almost exclusively steganography (encoding ASCII letters as
    invisible tag chars).

  mixed-script-confusable
    A word containing characters from two different scripts where
    one set is visually identical to the other — e.g. Latin small
    letter A (U+0061) + the Cyrillic homoglyph at U+0430. Used to
    impersonate package names, command names, identifiers. (A spoofed
    "admin" with the U+0430 codepoint in place of the first ASCII
    letter looks identical but is a different string to the agent.)

Known false positives
---------------------

Almost none — every flagged codepoint has no legitimate use in a
PrimitiveHub primitive (which is markdown content about software, not
typeset RTL prose). The mixed-script check could flag a primitive
that legitimately discusses Cyrillic + Latin in the same word, but
those primitives are vanishingly rare; reviewer override is cheap.
"""

from __future__ import annotations

import re
import unicodedata

from .types import DetectorContext, DiffHint, Severity, Verdict

# ─────────────────────────────────────────────────────────────────────
# Codepoint sets
# ─────────────────────────────────────────────────────────────────────

# Each entry: codepoint → (descriptive name, detail tag).
# Lookups are dict-direct, not regex, because Unicode-class regex
# requires the `regex` package — sticking to stdlib `re`.
_INVISIBLE_CHARS: dict[str, tuple[str, str]] = {
    "​": ("ZERO WIDTH SPACE (U+200B)", "zero-width-invisible"),
    "‌": ("ZERO WIDTH NON-JOINER (U+200C)", "zero-width-invisible"),
    "‍": ("ZERO WIDTH JOINER (U+200D)", "zero-width-invisible"),
    "⁠": ("WORD JOINER (U+2060)", "zero-width-invisible"),
    "﻿": ("ZERO WIDTH NO-BREAK SPACE / BOM (U+FEFF)", "zero-width-invisible"),
    "‪": ("LEFT-TO-RIGHT EMBEDDING (U+202A)", "bidi-control"),
    "‫": ("RIGHT-TO-LEFT EMBEDDING (U+202B)", "bidi-control"),
    "‬": ("POP DIRECTIONAL FORMATTING (U+202C)", "bidi-control"),
    "‭": ("LEFT-TO-RIGHT OVERRIDE (U+202D)", "bidi-control"),
    "‮": ("RIGHT-TO-LEFT OVERRIDE (U+202E)", "bidi-control"),
    "⁦": ("LEFT-TO-RIGHT ISOLATE (U+2066)", "bidi-control"),
    "⁧": ("RIGHT-TO-LEFT ISOLATE (U+2067)", "bidi-control"),
    "⁨": ("FIRST STRONG ISOLATE (U+2068)", "bidi-control"),
    "⁩": ("POP DIRECTIONAL ISOLATE (U+2069)", "bidi-control"),
}

# Tag-character range U+E0000..U+E007F (used for ASCII-to-invisible encoding).
_TAG_RANGE_START = 0xE0000
_TAG_RANGE_END = 0xE007F

# Script ranges we track for mixed-script-confusable detection.
# Source: Unicode block ranges. Latin includes Basic Latin + Latin-1
# Supplement + Latin Extended A/B. Cyrillic + Greek are the two most
# commonly abused for confusables in English-language attacks.
_LATIN_RANGES: tuple[tuple[int, int], ...] = (
    (0x0041, 0x005A),  # A-Z
    (0x0061, 0x007A),  # a-z
    (0x00C0, 0x024F),  # Latin Extended
)
_CYRILLIC_RANGES: tuple[tuple[int, int], ...] = (
    (0x0400, 0x04FF),
    (0x0500, 0x052F),
)
_GREEK_RANGES: tuple[tuple[int, int], ...] = ((0x0370, 0x03FF),)

# Word-boundary tokenizer that captures runs of letters (any script).
# Conservative: only letter codepoints, not digits/punctuation.
_WORD_RE = re.compile(r"\w+", re.UNICODE)

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


def _script_for(codepoint: int) -> str | None:
    """Return 'Latin', 'Cyrillic', 'Greek', or None."""
    for lo, hi in _LATIN_RANGES:
        if lo <= codepoint <= hi:
            return "Latin"
    for lo, hi in _CYRILLIC_RANGES:
        if lo <= codepoint <= hi:
            return "Cyrillic"
    for lo, hi in _GREEK_RANGES:
        if lo <= codepoint <= hi:
            return "Greek"
    return None


def _line_for(content: str, position: int) -> int:
    """1-indexed line number for a character position."""
    return content.count("\n", 0, position) + 1


def _truncate(s: str) -> str:
    return s[:_SNIPPET_MAX_CHARS] + ("…" if len(s) > _SNIPPET_MAX_CHARS else "")


def _scan_invisible_and_tag_chars(content: str) -> list[DiffHint]:
    """Find every invisible / bidi / tag codepoint, with line numbers."""
    hints: list[DiffHint] = []
    for i, ch in enumerate(content):
        if len(hints) >= _MAX_HINTS_PER_VERDICT:
            break
        if ch in _INVISIBLE_CHARS:
            name, tag = _INVISIBLE_CHARS[ch]
            hints.append(
                DiffHint(
                    line=_line_for(content, i),
                    snippet=f"<invisible: {name}>",
                    suggestion=f"Remove the hidden codepoint ({tag}); no legitimate use in a primitive document.",
                    detail_tag=tag,
                )
            )
            continue
        cp = ord(ch)
        if _TAG_RANGE_START <= cp <= _TAG_RANGE_END:
            hints.append(
                DiffHint(
                    line=_line_for(content, i),
                    snippet=f"<tag-char: U+{cp:04X}>",
                    suggestion="Remove tag-range codepoint (U+E0000-U+E007F); used for steganographic encoding.",
                    detail_tag="tag-character",
                )
            )
    return hints


def _scan_mixed_script_words(content: str) -> list[DiffHint]:
    """Find words that mix Latin with Cyrillic or Greek codepoints."""
    hints: list[DiffHint] = []
    for match in _WORD_RE.finditer(content):
        if len(hints) >= _MAX_HINTS_PER_VERDICT:
            break
        word = match.group(0)
        # Skip single-character "words" — no possible mixed-script ambiguity.
        if len(word) < 2:
            continue
        scripts: set[str] = set()
        for ch in word:
            script = _script_for(ord(ch))
            if script is not None:
                scripts.add(script)
        # Latin + (Cyrillic OR Greek) in the same word is the
        # confusable attack shape.
        if "Latin" in scripts and (scripts & {"Cyrillic", "Greek"}):
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(repr(word)[1:-1]),  # show codepoints clearly
                    suggestion=(
                        f"Word mixes scripts {sorted(scripts)} — likely a "
                        "homoglyph attack impersonating an ASCII identifier."
                    ),
                    detail_tag="mixed-script-confusable",
                )
            )
    return hints


class T2UnicodeSteganographyDetector:
    """Concrete `Detector` for T2. Stateless; scans codepoint-by-codepoint
    for invisible/bidi/tag chars, plus word-by-word for mixed scripts."""

    name = "t2.unicode_steganography"
    threat_category = "T2"
    detector_version = "0.1.0"

    def run(self, ctx: DetectorContext) -> Verdict:
        # Normalize for inspection — but check the raw content. NFC
        # normalization would hide some attacks (combining-character
        # tricks); we want to see the bytes the agent will see.
        hints: list[DiffHint] = []
        hints.extend(_scan_invisible_and_tag_chars(ctx.content))
        # Don't waste cap-budget on mixed-script if we already hit cap on
        # invisible chars; they're orthogonal but both signal manipulation.
        if len(hints) < _MAX_HINTS_PER_VERDICT:
            remaining = _MAX_HINTS_PER_VERDICT - len(hints)
            mixed = _scan_mixed_script_words(ctx.content)[:remaining]
            hints.extend(mixed)

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                severity=Severity.INFO,
                passed=True,
                summary="No Unicode-steganography patterns matched.",
                detector_version=self.detector_version,
            )

        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            severity=Severity.FAIL,
            passed=False,
            summary=(
                f"Matched {len(hints)} Unicode-steganography pattern"
                f"{'s' if len(hints) != 1 else ''}; "
                "hidden content invisible to human reviewers."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )


# Suppress unused-import warning for the `unicodedata` module which
# we'll need in v0.2+ when NFKC-based confusable detection lands.
_ = unicodedata
