"""T3 — Encoded payloads.

Base64, hex, or otherwise-encoded blobs in primitive content that
decode to executable instructions, URLs, or hidden agent directives.
The reviewer eyeballs the markdown and sees random-looking text; the
agent's tokenizer reads the same characters. If the agent is also
instructed to "decode and execute," the encoded blob becomes the
delivery vehicle for whatever the attacker hid.

What this detector flags
------------------------

  base64-long-blob
    Run of base64-alphabet characters (A-Za-z0-9+/=) at least
    MIN_BASE64_LEN characters long. Conservative — short base64
    strings have too many false positives (UUIDs, short hashes).

  hex-long-blob
    Run of hex characters (a-fA-F0-9) at least MIN_HEX_LEN long.
    Same conservative cutoff to avoid SHA-256 hashes.

  decode-and-execute-instruction
    Natural-language prose instructing the agent to decode AND
    execute the encoded blob: "base64-decode the following and run",
    "atob this and eval it", etc.

  rot13-instruction
    Explicit "rot13 the following text" instructions paired with
    suspicious content.

Known false positives + how we accept them
------------------------------------------

A primitive teaching cryptography or compression legitimately
includes encoded examples. Same v0.1 stance as T1/T5: flag and
review. Markdown-AST awareness in v0.2 distinguishes code-fence
examples from top-level instructions; v0.2 also adds optional
"decode and recursively scan the decoded content for T1/T5
patterns" per the Top 10 spec.

For now: false positives are preferable to false negatives.
"""

from __future__ import annotations

import re

from .markdown_context import (
    MarkdownContext,
    analyze_markdown_context,
    is_in_any_code_or_frontmatter,
)
from .types import DetectorContext, DiffHint, Severity, Verdict

# Conservative cutoffs — short base64/hex strings produce too many
# false positives. 80 chars is roughly the length below which random
# IDs / short hashes dominate; above that, a deliberate encoded
# payload is far more likely than coincidence.
_MIN_BASE64_LEN = 80
_MIN_HEX_LEN = 80

# Base64 alphabet, optional terminal '=' padding. Anchored at word
# boundaries to avoid matching mid-identifier substrings.
_BASE64_RE = re.compile(
    rf"\b[A-Za-z0-9+/]{{{_MIN_BASE64_LEN},}}={{0,2}}\b",
)

# Pure hex (case-insensitive) — only long runs, not 8-/16-char IDs.
_HEX_RE = re.compile(
    rf"\b[a-fA-F0-9]{{{_MIN_HEX_LEN},}}\b",
)

_DECODE_AND_EXECUTE_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\b(?:base64[\s_-]?decode|b64decode|atob|from_base64|decode\s+base64)\s+(?:the\s+|this\s+|following\s+)?.{0,40}(?:and\s+(?:run|execute|eval|exec)|then\s+(?:run|execute|eval|exec))",
        "decode-and-execute",
    ),
    (
        # v0.2.2 (Round 2 — closes corpus FN on S-019 "decode the
        # following base64 string and run"). Widened the article slot
        # from a single optional article (the/this/following) to up to
        # 30 chars of word/whitespace so multi-word noun phrases between
        # `decode` and the format keyword still match.
        r"\b(?:decode|deobfuscate)\s+[\w\s]{0,30}\b(?:hex|base64|payload|blob)\b.{0,80}?\s+(?:and|then)\s+(?:run|execute|eval|exec)",
        "decode-and-execute",
    ),
    (
        # v0.2.2 — closes corpus FN on S-021 "Run the result of decoding
        # hex on the following payload". Added `decod\w*` so participle
        # / gerund forms match alongside the bare verb.
        r"\b(?:run|exec|eval)\s+(?:the\s+)?(?:result|output|decoded)\s+of\s+(?:base64|hex|decod\w*)",
        "decode-and-execute",
    ),
)

_ROT13_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\b(?:rot13|caesar[\s_-]?cipher|shift[\s_-]?by[\s_-]?13)\s+(?:the\s+|this\s+|following\s+).{0,40}(?:and|then)\s+(?:run|execute|eval|read|follow)",
        "rot13-instruction",
    ),
    (
        r"\b(?:apply|decode)\s+rot13\s+(?:to\s+)?(?:the\s+|this\s+|following\s+)",
        "rot13-instruction",
    ),
)

_ALL_INSTRUCTION_PATTERNS = _DECODE_AND_EXECUTE_PATTERNS + _ROT13_PATTERNS

_COMPILED_INSTRUCTIONS = tuple(
    (re.compile(pattern, re.IGNORECASE | re.MULTILINE), tag)
    for pattern, tag in _ALL_INSTRUCTION_PATTERNS
)

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


def _truncate(s: str) -> str:
    return s[:_SNIPPET_MAX_CHARS] + ("…" if len(s) > _SNIPPET_MAX_CHARS else "")


def _line_for(content: str, position: int) -> int:
    return content.count("\n", 0, position) + 1


def _scan_long_encoded_blobs(
    content: str, md_ctx: MarkdownContext | None = None
) -> list[DiffHint]:
    """Find long base64 + hex runs.

    v0.2.0: skip matches inside frontmatter / fenced code / inline
    code. A long base64 blob in a ```python ... ``` example is
    demonstration material, not a hidden payload.
    """
    hints: list[DiffHint] = []
    for pattern, tag, label in (
        (_BASE64_RE, "base64-long-blob", "base64"),
        (_HEX_RE, "hex-long-blob", "hex"),
    ):
        for match in pattern.finditer(content):
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                return hints
            if md_ctx is not None and is_in_any_code_or_frontmatter(match.start(), md_ctx, match.end()):
                continue
            raw = match.group(0)
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=f"<{label} {len(raw)} chars: {_truncate(raw)}>",
                    suggestion=(
                        f"Long encoded blob ({tag}). If this is example data, wrap it in a "
                        "code fence and add a comment explaining what it decodes to. "
                        "If this is a real payload an agent is meant to decode + execute, "
                        "remove it — Trust Bundles must declare what content does."
                    ),
                    detail_tag=tag,
                )
            )
    return hints


def _scan_instructions(
    content: str, md_ctx: MarkdownContext | None = None
) -> list[DiffHint]:
    hints: list[DiffHint] = []
    for pattern, tag in _COMPILED_INSTRUCTIONS:
        for match in pattern.finditer(content):
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                return hints
            if md_ctx is not None and is_in_any_code_or_frontmatter(match.start(), md_ctx, match.end()):
                continue
            raw = match.group(0)
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(raw),
                    suggestion=(
                        f"Decode-and-execute instruction ({tag}). The primitive instructs "
                        "the agent to decode hidden content and run it — this is the T3 "
                        "attack shape. Remove the instruction or rephrase as a "
                        "non-actionable description."
                    ),
                    detail_tag=tag,
                )
            )
    return hints


class T3EncodedPayloadsDetector:
    """Concrete `Detector` for T3.

    Two pattern families run independently:
      1. Long encoded blobs (base64 / hex).
      2. Natural-language instructions telling the agent to decode +
         execute hidden content.

    Either family firing produces a FAIL verdict. v0.2 will add
    optional "decode + recursively scan the decoded content for the
    other Top 10 patterns" per the spec.
    """

    name = "t3.encoded_payloads"
    threat_category = "T3"
    cci_id = "CCI-003"
    detector_version = "0.2.0"

    def run(self, ctx: DetectorContext) -> Verdict:
        # v0.2.0 (2026-06-04): markdown-context awareness.
        md_ctx = analyze_markdown_context(ctx.content)
        hints: list[DiffHint] = []
        hints.extend(_scan_long_encoded_blobs(ctx.content, md_ctx))
        if len(hints) < _MAX_HINTS_PER_VERDICT:
            remaining = _MAX_HINTS_PER_VERDICT - len(hints)
            hints.extend(_scan_instructions(ctx.content, md_ctx)[:remaining])

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="No encoded-payload patterns matched.",
                detector_version=self.detector_version,
            )

        plural = "s" if len(hints) != 1 else ""
        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            cci_id=self.cci_id,
            severity=Severity.FAIL,
            passed=False,
            summary=(
                f"Matched {len(hints)} encoded-payload pattern{plural}; "
                "hidden content invisible to human reviewers."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )
