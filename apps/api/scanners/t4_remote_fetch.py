"""T4 — Remote content fetching at load time.

A primitive that instructs the consuming agent to fetch external
content (HTTP, file://, git+) at the moment the primitive is loaded.
Turns a static markdown document into a dynamic loader — the
attacker controls what gets executed AFTER the primitive was signed.

The discipline: a Trust Bundle attests the primitive's CONTENT at
sign time. Nothing in the cryptographic chain binds what the agent
fetches later. T4 is the threat model's name for that gap.

What this detector flags
------------------------

  fetch-and-include
    Instructions like "fetch URL and append to context", "load
    https://… as your reference", "include the contents of <url>".

  load-time-fetch
    "Before responding, download …", "at the start of every
    conversation, fetch …" — the trigger is the agent's load /
    response cycle.

  agent-side-include
    Markdown / HTML import directives: `<link rel="import" href=...>`,
    `@import url(...)`, `<iframe src=...>`. None of these have a
    legitimate place in a primitive document.

Known false positives
---------------------

A primitive teaching about Sigstore / Rekor / Trust API integration
will legitimately reference URLs to fetch attestations. Those are
verified after the bundle's content digest matches — they're not
T4. The detector flags any "fetch URL and use the content" pattern;
v0.2 markdown-AST awareness will distinguish code-fence example URLs
from imperative load-time fetches.
"""

from __future__ import annotations

import re

from .markdown_context import analyze_markdown_context, is_in_any_code_or_frontmatter
from .types import DetectorContext, DiffHint, Severity, Verdict

_FETCH_AND_INCLUDE_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\b(?:fetch|download|retrieve|pull|load)\s+(?:the\s+)?(?:contents?\s+of\s+)?https?://\S+\s+(?:and|then)\s+(?:append|include|add|use|merge|insert|inject)",
        "fetch-and-include",
    ),
    (
        # v0.2.1 (Round 2 — closes corpus FN on S-030 "Inject the
        # response body of curl -s https://..."). Two fixes vs v0.2.0:
        #   (a) the noun slot accepts compound forms like "response
        #       body" / "payload data", not just single nouns.
        #   (b) the flag/value gap between command and URL allows up
        #       to 8 whitespace-separated tokens (bounded — prevents
        #       catastrophic backtracking; covers realistic curl
        #       invocations per FN-004 peer-review addendum).
        r"\b(?:include|inject|append|merge)\s+(?:the\s+(?:contents?|response|body|payload|data)(?:\s+(?:body|payload|content|data))?\s+of\s+)?(?:curl|wget|fetch)\s+(?:[\w-]+\s+){0,8}https?://",
        "fetch-and-include",
    ),
    (
        r"\b(?:read|load)\s+(?:the\s+)?(?:contents?\s+of\s+)?file://\S+\s+(?:as|into|and)\s+(?:your|the)\s+(?:context|prompt|memory)",
        "fetch-and-include",
    ),
)

_LOAD_TIME_FETCH_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        # v0.2.3 (Round 13 PR 13.1 — closes FN-022 on S-118 SolarWinds
        # DGA-style "on every session start, fetch..."). Extends the
        # temporal noun set to include session/start/init/connect/
        # boot/spawn/wake/resume and the determiner set to include
        # `every|each`. Lockstep with packages/phub/src/scanners/
        # t4-remote-fetch.ts § v0.2.3.
        r"\b(?:before\s+(?:you\s+)?(?:respond(?:ing)?|answer(?:ing)?|repl(?:y|ying)|proceed(?:ing)?)|at\s+(?:the\s+)?start\s+of\s+(?:every|each)\s+(?:conversation|session|turn)|on\s+(?:every\s+|each\s+)?(?:session\s+)?(?:start|init|connect|boot|spawn|wake|resume|load|read|consume)),?\s+(?:fetch|download|curl|wget|retrieve|pull|load)\s+",
        "load-time-fetch",
    ),
    (
        r"\b(?:fetch|download|curl|wget|retrieve)\s+(?:from\s+)?https?://\S+\s+(?:before|prior\s+to|each\s+time)\s+(?:responding|answering|replying)",
        "load-time-fetch",
    ),
    (
        r"\b(?:always|first|initially|on\s+startup),?\s+(?:fetch|download|retrieve|pull)\s+https?://",
        "load-time-fetch",
    ),
    (
        # v0.2.2 (Round 7 closure 2 — closes holdout FN-008 on S-092
        # "On session start, open a WebSocket connection to wss://...").
        # WebSocket / EventSource / Server-Sent Events are streaming
        # remote-fetch channels — same threat surface as HTTP-fetch
        # but the existing patterns only matched curl/wget/fetch.
        # Temporal anchor required so we don't fire on legitimate
        # teaching prose describing the WebSocket API. Lockstep with
        # packages/phub/src/scanners/t4-remote-fetch.ts § v0.2.2.
        #
        # v0.2.3 (Round 13 PR 13.1 — closes FN-022 on S-118 SolarWinds
        # DGA-style "on every session start"): allow optional
        # `(?:every|each)\s+` between `on` and the temporal noun;
        # extend the temporal noun set with boot/spawn/wake/resume.
        # Same widening applied to the fetch-imperative half so it
        # catches "on every session start, fetch ..." prose.
        r"\b(?:on\s+(?:every\s+|each\s+)?(?:session\s+)?(?:start|load|init|connect|boot|spawn|wake|resume)|at\s+load[\s-]?time|on\s+(?:every\s+)?(?:load|read|consume))[,\s]+(?:open|connect|establish|create|fetch|download|retrieve|pull)\s+(?:a\s+|the\s+)?(?:WebSocket|EventSource|SSE|server[\s-]?sent[\s-]?events?|\S+\s+(?:manifest|config|instructions))?\s*(?:connection\s+)?(?:to\s+|from\s+)?(?:wss?|https?)://",
        "load-time-fetch",
    ),
    (
        r"\bnew\s+WebSocket\s*\(\s*[\"']?wss?://",
        "load-time-fetch",
    ),
)

# Markdown / HTML import-style directives that have NO legitimate
# place in a primitive document. These are exact-form matches.
_AGENT_SIDE_INCLUDE_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r'<link\s+[^>]*rel\s*=\s*["\']?(?:import|preload|prefetch|stylesheet)["\']?[^>]*href\s*=\s*["\']?https?://',
        "agent-side-include",
    ),
    (
        r'<iframe\s+[^>]*src\s*=\s*["\']?https?://',
        "agent-side-include",
    ),
    (
        r"@import\s+(?:url\()?[\"']?https?://",
        "agent-side-include",
    ),
    (
        # Markdown ![](url) is normal IMAGE syntax; the attack shape
        # is a deliberate prose claim that the image-include macro
        # delivers executable instructions. We match the prose form,
        # not the image syntax itself, to avoid massive FPs.
        r"\b(?:treat|interpret|use)\s+(?:the\s+)?(?:embedded|imported|linked)\s+content\s+as\s+(?:instructions|prompt|context)",
        "agent-side-include",
    ),
)

_ALL_PATTERNS = (
    _FETCH_AND_INCLUDE_PATTERNS + _LOAD_TIME_FETCH_PATTERNS + _AGENT_SIDE_INCLUDE_PATTERNS
)

_COMPILED = tuple(
    (re.compile(pattern, re.IGNORECASE | re.MULTILINE), tag) for pattern, tag in _ALL_PATTERNS
)

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


def _hint_for_match(content: str, match: re.Match[str], tag: str) -> DiffHint:
    line_no = content.count("\n", 0, match.start()) + 1
    raw = match.group(0)
    snippet = raw[:_SNIPPET_MAX_CHARS] + ("…" if len(raw) > _SNIPPET_MAX_CHARS else "")
    return DiffHint(
        line=line_no,
        snippet=snippet,
        suggestion=(
            f"Remote-fetch instruction ({tag}). The primitive turns into a dynamic "
            "loader at runtime — the attacker controls what gets included AFTER the "
            "bundle was signed. Remove the fetch instruction or inline the content "
            "(then re-sign)."
        ),
        detail_tag=tag,
    )


class T4RemoteFetchDetector:
    """Concrete `Detector` for T4. Stateless; pre-compiled regex pool."""

    name = "t4.remote_fetch"
    threat_category = "T4"
    cci_id = "CCI-004"
    detector_version = "0.2.3"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        # v0.2.0 (2026-06-04): markdown-context awareness. Skip
        # matches inside frontmatter / fenced code / inline code. An
        # `<iframe>` quoted inside ```html ... ``` is a teaching
        # example, not a runtime fetch instruction.
        md_ctx = analyze_markdown_context(ctx.content)
        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                if is_in_any_code_or_frontmatter(match.start(), md_ctx, match.end()):
                    continue
                hints.append(_hint_for_match(ctx.content, match, tag))
                if len(hints) >= _MAX_HINTS_PER_VERDICT:
                    break
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="No remote-fetch patterns matched.",
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
                f"Matched {len(hints)} remote-fetch pattern{plural}; "
                "primitive turns into a dynamic loader at runtime."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )
