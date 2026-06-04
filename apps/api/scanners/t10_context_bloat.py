"""T10 — Context bloat.

The threat model: a primitive whose size or redundancy
disproportionately consumes the consuming agent's context window —
crowding out other primitives, raising inference cost, and (in
adversarial cases) burying actual instructions in noise.

What this detector flags (v0.1, mechanical thresholds)
------------------------------------------------------

  oversized-primitive
    Body length exceeds OVERSIZED_THRESHOLD_CHARS characters
    (approximately 8K tokens). Calibrated against the project's own primitives
    — the largest legitimate primitives are < 32 KB; the threshold
    sits at 2x headroom over that.

  excessive-repetition
    Of the non-trivial lines (> 50 chars after strip), more than
    EXCESSIVE_REPETITION_THRESHOLD are exact duplicates. Catches
    boilerplate stuffing and copy-paste bloat.

  whitespace-stuffing
    For primitives with > 100 lines, more than
    WHITESPACE_STUFFING_THRESHOLD of lines are blank. Catches
    visual-padding bloat.

  heading-proliferation
    Body has too many `## ` headings relative to character count
    — one h2 per HEADING_PROLIFERATION_RATIO chars or denser.
    Catches outline-spam patterns.

Known false positives
---------------------

A long, well-structured reference primitive (deep API documentation,
threat-model corpus) may legitimately approach the oversize
threshold. v0.1 stance per ADR-0030: flag and bounce to manual
review; the FP-resolution methodology + policy allows cover the
legitimate-but-large case.
"""

from __future__ import annotations

import re

from .types import DetectorContext, DiffHint, Severity, Verdict

OVERSIZED_THRESHOLD_CHARS = 32000  # approximately 8K tokens; 2x headroom over the largest project primitive
EXCESSIVE_REPETITION_THRESHOLD = 0.20  # 20% of non-trivial lines duplicated
WHITESPACE_STUFFING_THRESHOLD = 0.40  # 40% blank lines
HEADING_PROLIFERATION_RATIO = 500  # one h2 per N chars triggers the flag
MIN_LINES_FOR_WHITESPACE_CHECK = 100
NON_TRIVIAL_LINE_MIN_CHARS = 50

_H2_RE = re.compile(r"^##\s+\S", re.MULTILINE)
_SNIPPET_MAX_CHARS = 120


def _truncate(s: str) -> str:
    return s[:_SNIPPET_MAX_CHARS] + ("…" if len(s) > _SNIPPET_MAX_CHARS else "")


def _check_oversized(content: str) -> DiffHint | None:
    n = len(content)
    if n <= OVERSIZED_THRESHOLD_CHARS:
        return None
    return DiffHint(
        line=1,
        snippet=f"<primitive: {n} chars; threshold {OVERSIZED_THRESHOLD_CHARS}>",
        suggestion=(
            f"Primitive body is {n} chars (≈ {n // 4:d} tokens), exceeding the v0.1 "
            f"bloat threshold of {OVERSIZED_THRESHOLD_CHARS} chars. Split into focused "
            "smaller primitives, or remove redundant sections."
        ),
        detail_tag="oversized-primitive",
    )


def _check_excessive_repetition(content: str) -> DiffHint | None:
    lines = content.split("\n")
    non_trivial = [ln.strip() for ln in lines if len(ln.strip()) >= NON_TRIVIAL_LINE_MIN_CHARS]
    if len(non_trivial) < 10:
        return None
    duplicate_count = len(non_trivial) - len(set(non_trivial))
    ratio = duplicate_count / len(non_trivial)
    if ratio <= EXCESSIVE_REPETITION_THRESHOLD:
        return None
    return DiffHint(
        line=1,
        snippet=f"<{duplicate_count} duplicate lines of {len(non_trivial)} non-trivial ({ratio:.0%})>",
        suggestion=(
            f"{ratio:.0%} of non-trivial lines (≥ {NON_TRIVIAL_LINE_MIN_CHARS} chars) "
            "are exact duplicates. Deduplicate or refactor — the agent reads the same "
            "instruction multiple times for no benefit."
        ),
        detail_tag="excessive-repetition",
    )


def _check_whitespace_stuffing(content: str) -> DiffHint | None:
    lines = content.split("\n")
    if len(lines) < MIN_LINES_FOR_WHITESPACE_CHECK:
        return None
    blank_count = sum(1 for ln in lines if not ln.strip())
    ratio = blank_count / len(lines)
    if ratio <= WHITESPACE_STUFFING_THRESHOLD:
        return None
    return DiffHint(
        line=1,
        snippet=f"<{blank_count} blank lines of {len(lines)} ({ratio:.0%})>",
        suggestion=(
            f"{ratio:.0%} of lines are blank. Visual padding wastes context budget; "
            "consolidate sections."
        ),
        detail_tag="whitespace-stuffing",
    )


def _check_heading_proliferation(content: str) -> DiffHint | None:
    n = len(content)
    if n < 1000:
        return None
    h2_count = len(_H2_RE.findall(content))
    if h2_count < 2:
        return None
    chars_per_h2 = n / h2_count
    if chars_per_h2 >= HEADING_PROLIFERATION_RATIO:
        return None
    return DiffHint(
        line=1,
        snippet=f"<{h2_count} h2 headings in {n} chars; {chars_per_h2:.0f} chars/h2>",
        suggestion=(
            f"{h2_count} h2 sections in {n} chars (≈ {chars_per_h2:.0f} chars/section) "
            f"is below the v0.1 floor of {HEADING_PROLIFERATION_RATIO} chars/h2. "
            "Consolidate adjacent sections or split into focused primitives."
        ),
        detail_tag="heading-proliferation",
    )


class T10ContextBloatDetector:
    """Concrete `Detector` for T10. Mechanical-threshold-only in v0.1.

    Each pattern family produces at most one hint — bloat is a
    whole-document property, not a per-line one. The verdict
    aggregates the families that fired.
    """

    name = "t10.context_bloat"
    threat_category = "T10"
    cci_id = "CCI-010"
    detector_version = "0.1.0"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        for check in (
            _check_oversized,
            _check_excessive_repetition,
            _check_whitespace_stuffing,
            _check_heading_proliferation,
        ):
            hint = check(ctx.content)
            if hint is not None:
                hints.append(hint)

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="No context-bloat patterns matched.",
                detector_version=self.detector_version,
            )

        plural = "s" if len(hints) != 1 else ""
        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            cci_id=self.cci_id,
            severity=Severity.WARN,
            passed=False,
            summary=(
                f"Matched {len(hints)} bloat pattern{plural}; primitive consumes "
                "context disproportionately."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )
