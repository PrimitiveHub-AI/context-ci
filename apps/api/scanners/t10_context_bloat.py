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
HEADING_PROLIFERATION_RATIO = 200  # one h2 per N chars triggers the flag
# v0.1.1 (2026-06-04) lowered from 500 → 200 (~50 tokens/section). The
# 500 floor was over-strict — legitimate catalog / cheatsheet primitives
# with 4–6 short sections in 2 KB routinely tripped it. 200 still
# catches the outline-spam attack pattern (15+ empty h2 headings in
# <1 KB) without flagging well-structured short docs.
HEADING_PROLIFERATION_MIN_COUNT = 6  # must have at least N h2 headings to flag
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
    if h2_count < HEADING_PROLIFERATION_MIN_COUNT:
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


# v0.1.2 (Round 6 fix 4 — closes FN-013): emoji-density check. v0.1
# thresholds (oversized, repetition, whitespace, heading proliferation)
# all measure structure; an attacker-built primitive padded with
# consecutive emoji glyphs stays small in chars/h2/whitespace metrics
# but visually hides the actual instruction below the bloat. T10
# v0.1.2 flags either > 5% emoji density across non-whitespace
# codepoints OR any single line with ≥ 10 consecutive emoji-presentation
# codepoints.
#
# Codepoint coverage: Misc Symbols + Dingbats (U+2600..U+27BF) and
# the Extended Pictographs blocks (U+1F300..U+1FAFF). Covers the v0.2
# corpus attack shape; ZWJ-joined sequences + skin-tone modifiers are
# out of scope (their components match the same blocks). Lockstep
# with packages/phub/src/scanners/t10-context-bloat.ts § v0.1.2.
EMOJI_DENSITY_RATIO = 0.05
EMOJI_CONSECUTIVE_RUN_THRESHOLD = 10


def _is_emoji_presentation(cp: int) -> bool:
    return (0x2600 <= cp <= 0x27BF) or (0x1F300 <= cp <= 0x1FAFF)


def _check_emoji_density(content: str) -> DiffHint | None:
    emoji_count = 0
    non_ws_count = 0
    max_run = 0
    cur_run = 0
    for ch in content:
        if ch == "\n":
            if cur_run > max_run:
                max_run = cur_run
            cur_run = 0
            continue
        if ch.isspace():
            cur_run = 0
            continue
        non_ws_count += 1
        if _is_emoji_presentation(ord(ch)):
            emoji_count += 1
            cur_run += 1
        else:
            if cur_run > max_run:
                max_run = cur_run
            cur_run = 0
    if cur_run > max_run:
        max_run = cur_run
    if non_ws_count == 0:
        return None
    density_ratio = emoji_count / non_ws_count
    if (
        density_ratio <= EMOJI_DENSITY_RATIO
        and max_run < EMOJI_CONSECUTIVE_RUN_THRESHOLD
    ):
        return None
    return DiffHint(
        line=1,
        snippet=(
            f"<{emoji_count} emoji of {non_ws_count} non-whitespace codepoints "
            f"({round(density_ratio * 100)}%); max consecutive run {max_run}>"
        ),
        suggestion=(
            f"Emoji density ({round(density_ratio * 100)}%) or longest consecutive "
            f"emoji run ({max_run} codepoints) exceeds the v0.2 bloat threshold "
            f"({round(EMOJI_DENSITY_RATIO * 100)}% / "
            f"{EMOJI_CONSECUTIVE_RUN_THRESHOLD}-emoji run). Visual padding wastes "
            "context budget and obscures the primitive's actual instruction."
        ),
        detail_tag="emoji-density",
    )


# v0.1.3 (Round 10 PR 10.3 — closes FN-017 on S-109 markdown-table-
# density bury attack). The v0.1.2 thresholds miss a small primitive
# (~6 KB, below the oversized cap) padded with a long innocuous
# markdown table burying the directive at the bottom. Signal: when
# > 50% of non-blank lines are markdown table rows AND the rows are
# structurally repetitive (most share the same column count), the
# primitive is using table bloat to bury an instruction below the
# attention budget. Lockstep with packages/phub/src/scanners/t10-context-bloat.ts § v0.1.3.
TABLE_DENSITY_RATIO = 0.5
TABLE_REPETITION_RATIO = 0.8
TABLE_MIN_NON_BLANK_LINES = 30
TABLE_MIN_TABLE_ROWS = 20

_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")


def _check_table_density(content: str) -> DiffHint | None:
    lines = content.split("\n")
    non_blank = [ln for ln in lines if ln.strip()]
    if len(non_blank) < TABLE_MIN_NON_BLANK_LINES:
        return None
    table_rows = [ln for ln in non_blank if _TABLE_ROW_RE.match(ln)]
    if len(table_rows) < TABLE_MIN_TABLE_ROWS:
        return None
    table_ratio = len(table_rows) / len(non_blank)
    if table_ratio < TABLE_DENSITY_RATIO:
        return None
    col_counts = [ln.count("|") for ln in table_rows]
    most_common_count = max(set(col_counts), key=col_counts.count)
    repetition_ratio = col_counts.count(most_common_count) / len(col_counts)
    if repetition_ratio < TABLE_REPETITION_RATIO:
        return None
    return DiffHint(
        line=1,
        snippet=(
            f"<{len(table_rows)} of {len(non_blank)} non-blank lines are "
            f"table rows ({round(table_ratio * 100)}%); "
            f"{round(repetition_ratio * 100)}% share {most_common_count - 1} "
            "columns>"
        ),
        suggestion=(
            f"Markdown-table density {round(table_ratio * 100)}% "
            f"(threshold {round(TABLE_DENSITY_RATIO * 100)}%) with structural "
            f"repetition {round(repetition_ratio * 100)}% (threshold "
            f"{round(TABLE_REPETITION_RATIO * 100)}%). The primitive is using "
            "a long innocuous table to bury its actual instruction; the "
            "instruction sits below the attention budget. Move the active "
            "directive above the table or split the reference data into a "
            "separate primitive."
        ),
        detail_tag="table-density",
    )


# File paths that look like a primitive being authored. T10's bloat
# semantics are calibrated for single primitives; firing on every
# README/docs/changelog in a normal repo is the case ADR-0030 § 1
# warns about — "scanner becomes the noisy boy who cries wolf." For
# multi-file scans (file_path is set), only run T10 against files
# whose path indicates they're a primitive.
_PRIMITIVE_PATH_MARKERS: tuple[str, ...] = (
    "/primitives/",
    "/skills/",
    "/skill/",
    "/prompts/",
    "/agents/",
    "/.claude/skills/",
    "/.cursor/rules/",
)
_PRIMITIVE_BASENAMES: frozenset[str] = frozenset({
    "skill.md",
    "agents.md",
    "claude.md",
    "cursor.md",
    "codex.md",
    "system.md",
    "prompt.md",
    "primitive.md",
    ".cursorrules",
})


def _looks_like_primitive(file_path: str) -> bool:
    """True when `file_path` looks like a primitive markdown / agent context.

    Empty path → True (single-blob mode, no filename info, keep the
    v0.1 behavior of running T10 against every input).
    """
    if not file_path:
        return True
    lowered = file_path.lower()
    basename = lowered.rsplit("/", 1)[-1]
    if basename in _PRIMITIVE_BASENAMES:
        return True
    return any(marker in f"/{lowered}/" for marker in _PRIMITIVE_PATH_MARKERS)


class T10ContextBloatDetector:
    """Concrete `Detector` for T10. Mechanical-threshold-only in v0.1.

    Each pattern family produces at most one hint — bloat is a
    whole-document property, not a per-line one. The verdict
    aggregates the families that fired.
    """

    name = "t10.context_bloat"
    threat_category = "T10"
    cci_id = "CCI-010"
    detector_version = "0.1.3"

    def run(self, ctx: DetectorContext) -> Verdict:
        # v0.1.1 (2026-06-04): multi-file scan callers pass `file_path`;
        # skip T10 when the file isn't a primitive (e.g. README in a
        # repo). The bloat-threshold semantics don't apply to general
        # documentation. Single-blob (Forge / mode=content) callers
        # pass empty file_path and keep the original behavior.
        if not _looks_like_primitive(ctx.file_path):
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="Skipped — file is not a primitive (T10 v0.1.1 scope).",
                detector_version=self.detector_version,
            )

        hints: list[DiffHint] = []
        for check in (
            _check_oversized,
            _check_excessive_repetition,
            _check_whitespace_stuffing,
            _check_heading_proliferation,
            _check_emoji_density,
            _check_table_density,
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
