"""Markdown context analyzer — v0.2.1 (ADR-0035).

Pure function that classifies character offsets in a markdown document
into one of three context types the detector roster cares about:

    - frontmatter (YAML block at file head delimited by ^---$ ... ^---$)
    - fenced code block (delimited by ^``` or ^~~~ runs)
    - inline code span (single-line `...` or ``...`` etc.)

No new runtime deps. Hand-rolled to match the markdown subset the
threat model cares about — NOT a general-purpose parser. Edge cases
NOT handled (documented as v0.2.x follow-up):
    - indented code blocks (4-space indent, no fence)
    - HTML <code> embedded in markdown
    - nested fences with different markers
    - multi-line inline code (spec-permitted but vanishingly rare)

Lockstep partner: packages/phub/src/scanners/markdown-context.ts —
both sides MUST produce identical boundaries for the same input.
Parity is enforced via the corpus measurement scripts (ADR-0032).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable

OffsetRange = tuple[int, int]


# ─────────────────────────────────────────────────────────────────────
# Artifact-language helper (RC3). Orthogonal to the offset analysis
# below: answers "is this a source-code file?" from the path alone. The
# markdown context model (fences / inline code / quotes) does not exist
# in a .js/.py/... file, so a match there is almost always a string
# literal, a comment, or a detector fixture rather than live in-band
# prose. A detector can use this to DOWN-WEIGHT code-artifact prose
# matches (reviewer-triage) instead of FAILing them as if they were
# instructions. Lockstep with packages/phub/src/scanners/markdown-context.ts.
# ─────────────────────────────────────────────────────────────────────
_CODE_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".mjs",
        ".cjs",
        ".py",
        ".rb",
        ".go",
        ".rs",
        ".java",
        ".kt",
        ".scala",
        ".c",
        ".h",
        ".cpp",
        ".cc",
        ".hpp",
        ".cs",
        ".php",
        ".sh",
        ".bash",
        ".zsh",
        ".ps1",
        ".lua",
        ".pl",
        ".swift",
    }
)


def is_code_artifact(file_path: str) -> bool:
    """True when ``file_path`` has a recognized source-code extension.

    An empty path (pasted content), markdown/text, and config/data files
    all return False, so they keep full markdown-context scrutiny (a hard
    FAIL). Only explicitly-recognized code gets the down-weight — fail-safe.
    RC3.
    """
    base = file_path.replace("\\", "/").rsplit("/", 1)[-1].lower()
    dot = base.rfind(".")
    return dot > 0 and base[dot:] in _CODE_EXTENSIONS


@dataclass(frozen=True, slots=True)
class MarkdownContext:
    """Context boundaries returned by ``analyze_markdown_context``.

    ``frontmatter_end_offset`` is 0 when no frontmatter is present.
    Ranges in ``fenced_ranges`` / ``inline_code_ranges`` are
    half-open [start, end).
    """

    frontmatter_end_offset: int = 0
    fenced_ranges: tuple[OffsetRange, ...] = field(default_factory=tuple)
    inline_code_ranges: tuple[OffsetRange, ...] = field(default_factory=tuple)


_FENCE_RE = re.compile(r"^( {0,3})(`{3,}|~{3,})\s*([^`\n]*)$")


def analyze_markdown_context(content: str) -> MarkdownContext:
    """Analyze the markdown content. Returns context boundaries.

    Algorithm mirrors the TS sibling (packages/phub/src/scanners/
    markdown-context.ts) so the two implementations produce
    byte-identical boundary offsets for the same input.
    """
    frontmatter_end = _detect_frontmatter(content)
    fenced = _detect_fenced_ranges(content, frontmatter_end)
    inline = _detect_inline_code_ranges(content, frontmatter_end, fenced)
    return MarkdownContext(
        frontmatter_end_offset=frontmatter_end,
        fenced_ranges=tuple(fenced),
        inline_code_ranges=tuple(inline),
    )


def _detect_frontmatter(content: str) -> int:
    if not (content.startswith("---\n") or content.startswith("---\r\n")):
        return 0
    start_of_body = content.find("\n", 0) + 1
    pos = start_of_body
    n = len(content)
    while pos < n:
        line_end = _next_line_break_or_end(content, pos)
        line = content[pos:line_end].rstrip("\r")
        if line == "---":
            if line_end >= n:
                return n
            # Step over the line break after the closing "---".
            if content[line_end] == "\r" and line_end + 1 < n and content[line_end + 1] == "\n":
                return line_end + 2
            return line_end + 1
        pos = line_end + 2 if content[line_end : line_end + 2] == "\r\n" else line_end + 1
    # Unclosed frontmatter — treat as no frontmatter to avoid
    # swallowing the whole document.
    return 0


def _next_line_break_or_end(content: str, from_pos: int) -> int:
    n = len(content)
    i = from_pos
    while i < n:
        c = content[i]
        if c == "\n":
            return i
        if c == "\r" and i + 1 < n and content[i + 1] == "\n":
            return i
        i += 1
    return n


def _detect_fenced_ranges(content: str, skip_until: int) -> list[OffsetRange]:
    ranges: list[OffsetRange] = []
    pos = skip_until
    n = len(content)
    while pos < n:
        line_end = _next_line_break_or_end(content, pos)
        line = content[pos:line_end].rstrip("\r")
        m = _FENCE_RE.match(line)
        if m:
            marker = m.group(2)
            marker_char = marker[0]
            marker_len = len(marker)
            range_start = pos
            cursor = line_end + 2 if content[line_end : line_end + 2] == "\r\n" else line_end + 1
            closed = False
            close_re = re.compile(
                r"^( {0,3})(" + re.escape(marker_char) + r"{" + str(marker_len) + r",})\s*$"
            )
            while cursor < n:
                inner_end = _next_line_break_or_end(content, cursor)
                inner_line = content[cursor:inner_end].rstrip("\r")
                if close_re.match(inner_line):
                    if content[inner_end : inner_end + 2] == "\r\n":
                        step_over = inner_end + 2
                    else:
                        step_over = inner_end + 1
                    ranges.append((range_start, step_over))
                    pos = step_over
                    closed = True
                    break
                if content[inner_end : inner_end + 2] == "\r\n":
                    cursor = inner_end + 2
                else:
                    cursor = inner_end + 1
            if not closed:
                # Unclosed fence — fenced through EOF (CommonMark).
                ranges.append((range_start, n))
                return ranges
        else:
            pos = line_end + 2 if content[line_end : line_end + 2] == "\r\n" else line_end + 1
    return ranges


def _detect_inline_code_ranges(
    content: str,
    skip_until: int,
    fenced_ranges: list[OffsetRange],
) -> list[OffsetRange]:
    ranges: list[OffsetRange] = []
    pos = skip_until
    n = len(content)
    while pos < n:
        line_end = _next_line_break_or_end(content, pos)
        if _is_in_ranges(pos, fenced_ranges):
            pos = line_end + 2 if content[line_end : line_end + 2] == "\r\n" else line_end + 1
            continue
        _scan_line_for_inline_code(content, pos, line_end, ranges)
        pos = line_end + 2 if content[line_end : line_end + 2] == "\r\n" else line_end + 1
    return ranges


def _scan_line_for_inline_code(
    content: str,
    line_start: int,
    line_end: int,
    out: list[OffsetRange],
) -> None:
    i = line_start
    while i < line_end:
        if content[i] == "`":
            run_start = i
            while i < line_end and content[i] == "`":
                i += 1
            run_len = i - run_start
            j = i
            while j < line_end:
                if content[j] == "`":
                    close_run_start = j
                    while j < line_end and content[j] == "`":
                        j += 1
                    if j - close_run_start == run_len:
                        out.append((run_start, j))
                        break
                else:
                    j += 1
            # Orphan run if no close found — treated as literal text.
        else:
            i += 1


def _is_in_ranges(offset: int, ranges: Iterable[OffsetRange]) -> bool:
    return any(start <= offset < end for start, end in ranges)


def is_in_frontmatter(offset: int, ctx: MarkdownContext) -> bool:
    """True iff ``offset`` is inside the frontmatter block."""
    return offset < ctx.frontmatter_end_offset


def is_in_fence(offset: int, ctx: MarkdownContext) -> bool:
    """True iff ``offset`` is inside any fenced code block."""
    return _is_in_ranges(offset, ctx.fenced_ranges)


def fence_containing(offset: int, ctx: MarkdownContext) -> OffsetRange | None:
    """Return the fence range containing ``offset``, or None if outside
    every fence. Lockstep partner:
    ``packages/phub/src/scanners/markdown-context.ts::fenceContaining``.
    """
    for start, end in ctx.fenced_ranges:
        if start <= offset <= end:
            return (start, end)
    return None


def is_in_inline_code(offset: int, ctx: MarkdownContext) -> bool:
    """True iff ``offset`` is inside any inline code span."""
    return _is_in_ranges(offset, ctx.inline_code_ranges)


def is_in_any_code_or_frontmatter(
    offset: int, ctx: MarkdownContext, end: int | None = None
) -> bool:
    """Convenience for detectors that opt into the v0.2.1 set.

    v0.2.2 (Round 2 lockstep, 2026-06-05): accepts an optional ``end``
    so range-spanning matches are caught — canonical motivating case is
    CCI-005's install-instruction regex matching "Install via `pip..."
    (start outside inline code, end inside). Single-offset callers
    keep v0.2.1 semantics.
    """
    if is_in_frontmatter(offset, ctx) or is_in_fence(offset, ctx) or is_in_inline_code(offset, ctx):
        return True
    if end is not None and end > offset:
        tail = end - 1
        if is_in_frontmatter(tail, ctx) or is_in_fence(tail, ctx) or is_in_inline_code(tail, ctx):
            return True
    return False
