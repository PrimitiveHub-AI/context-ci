"""T5 — Unsafe Shell Install (the Shai-Hulud vector).

The pattern: a primitive instructs an AI agent to fetch + execute
code from the network without verification. The agent runs the
instruction; arbitrary code executes in the developer's environment.

This is the single most cited threat in the agent-supply-chain
literature — npm's 2024 incidents, the xz-style backdoor playbook,
and the Shai-Hulud variant where the install command is hidden in
an LLM's response.

What this detector flags
------------------------

  shell-pipe-from-network
    `curl ... | sh`, `curl ... | bash`, `wget ... | sh`, plus the
    `python -c "$(curl ...)"`, `bash <(curl ...)`, `sh -c "$(...)"`
    variants. These are the classic remote-code-execution shapes.

  npx-arbitrary-install
    `npx <package>` invocations, especially with a remote URL or a
    package name that isn't from a recognized scope. npx silently
    installs and runs; the threat surface is identical to
    `curl | sh` for a Node ecosystem target.

  pip-arbitrary-install
    `pip install <url>` and `pip install <package>` with patterns
    that suggest install-and-execute, including
    `python -m pip install --pre <name>` for unsigned packages.

  install-instruction-to-agent
    Natural-language instructions to install: "run `curl ... | sh`
    first", "install this package", "execute the following command".
    Distinct from raw shell because the primitive is INSTRUCTING the
    agent to issue the command, not documenting that the user might.

Known false positives + how we accept them
------------------------------------------

A primitive teaching about CI/CD or package management may legitimately
show install commands as EXAMPLES. Same v0.1 stance as T1: flag and
review. Markdown-AST awareness in v0.2+ will distinguish code-fence
quotes from top-level instructions.

For now: false positives are preferable to false negatives. A flagged
primitive bounces to manual review; a missed install instruction
becomes Shai-Hulud in someone's repo.
"""

from __future__ import annotations

import re

from .markdown_context import (
    MarkdownContext,
    analyze_markdown_context,
    fence_containing,
    is_in_any_code_or_frontmatter,
)
from .semantic_context import is_in_negation_context

# v0.2.4 (Round 6 fix 2 — closes FN-009): imperative directive
# keywords that, when appearing within ±3 lines BEFORE a fence,
# mark that fence as "directive-referenced". The detector then
# treats the fence's content as live attack instruction rather
# than documentary example.
_DIRECTIVE_RE = re.compile(
    r"\b(?:before\s+(?:you\s+)?(?:respond(?:ing)?|answer(?:ing)?|repl(?:y|ying)|proceed(?:ing)?)"
    r"|as\s+the\s+(?:first|next)\s+step"
    r"|first[,\s]+|then[,\s]+|now[,\s]+"
    r"|on\s+(?:every\s+)?(?:load|read|consume|startup)"
    r"|at\s+(?:the\s+)?start\s+of\s+(?:every|each)\s+(?:conversation|session|turn))?"
    r"\s*(?:run|execute|launch|install|bootstrap|initialise|initialize)"
    r"\s+(?:the\s+|this\s+|that\s+)?"
    r"(?:install(?:er|ation)?|hook|setup|init|bootstrap|script|command)\b",
    re.IGNORECASE,
)

_DIRECTIVE_LOOKBACK_LINES = 3


def _is_directive_referenced_fence(content: str, fence: tuple[int, int]) -> bool:
    """Is ``fence`` immediately preceded (within ±3 lines) by an
    imperative-directive sentence?"""
    lines_seen = 0
    cursor = fence[0]
    while cursor > 0 and lines_seen < _DIRECTIVE_LOOKBACK_LINES + 1:
        nl = content.rfind("\n", 0, cursor)
        if nl < 0:
            cursor = 0
            break
        cursor = nl
        lines_seen += 1
    window = content[max(0, cursor) : fence[0]]
    return bool(_DIRECTIVE_RE.search(window))


def _is_in_directive_referenced_fence(
    content: str, offset: int, md_ctx: MarkdownContext
) -> bool:
    """True iff ``offset`` is inside a fence whose preceding prose
    directs the agent to execute its contents."""
    fence = fence_containing(offset, md_ctx)
    if fence is None:
        return False
    return _is_directive_referenced_fence(content, fence)
from .types import DetectorContext, DiffHint, Severity, Verdict

# ─────────────────────────────────────────────────────────────────────
# Pattern families. Each (regex, tag) tuple — the tag becomes
# `DiffHint.detail_tag`. Case-insensitive + multiline at compile.
# ─────────────────────────────────────────────────────────────────────

_SHELL_PIPE_PATTERNS: tuple[tuple[str, str], ...] = (
    # curl/wget piped to a shell — the canonical "curl | sh" pattern
    (
        r"\b(?:curl|wget|fetch)\s+(?:-\w+\s+)*[^\s|]*https?://[^\s|]+\s*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|csh)\b",
        "shell-pipe-from-network",
    ),
    # v0.2.3 (Round 3 — closes test_shell_pipe_family inline-code case).
    # Verb-anchored variant: "Run `curl ... | sh`" / "Then execute
    # `wget ... | bash`". match.start() is at the VERB (outside the
    # backticks), so the v0.2.1 inline-code skip doesn't apply, but the
    # negation guard still does — "Never run `curl ... | sh`" stays
    # skipped because "Never" precedes the verb within the sentence.
    # AV-strict position: prose that tells the agent to copy-paste a
    # curl|sh from inline code IS the Shai-Hulud vector.
    (
        r"(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+`\s*(?:sudo\s+)?(?:curl|wget|fetch)\s+(?:-\w+\s+)*[^\s|`]*https?://[^\s|`]+\s*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|csh)\b",
        "shell-pipe-from-network",
    ),
    # python -c "$(curl ...)" and friends
    (
        r"\bpython(?:3)?\s+-c\s+[\"']?\$\(\s*(?:curl|wget)",
        "shell-pipe-from-network",
    ),
    # bash <(curl ...) / sh -c "$(curl ...)" — process-substitution variants
    (
        r"\b(?:bash|sh|zsh)\s+<\(\s*(?:curl|wget)",
        "shell-pipe-from-network",
    ),
    (
        r"\b(?:bash|sh|zsh)\s+-c\s+[\"']?\$\(\s*(?:curl|wget)",
        "shell-pipe-from-network",
    ),
    # eval $(curl ...) — direct eval of network content
    (
        r"\beval\s+[\"']?\$\(\s*(?:curl|wget)",
        "shell-pipe-from-network",
    ),
)

_NPX_INSTALL_PATTERNS: tuple[tuple[str, str], ...] = (
    # npx -y <package> or npx <package> — auto-installs and runs
    (
        r"\bnpx\s+(?:-y\s+|--yes\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-][a-zA-Z0-9@/_.-]+",
        "npx-arbitrary-install",
    ),
    # v0.2.3 (Round 3 — closes test_npx_install_family inline-code case).
    # Verb-anchored variant: "Then run `npx -y attacker-cli`". Same
    # discipline as the shell-pipe verb-anchored entry. The existing
    # bare-prose npx pattern (which IS inline-code-skip-blocked) still
    # protects benign vendor docs like "`npx shadcn@latest add Button`"
    # shown without a "run/execute/launch" verb before the backtick.
    (
        r"(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+`\s*npx\s+(?:-y\s+|--yes\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-][a-zA-Z0-9@/_.-]+",
        "npx-arbitrary-install",
    ),
)

_PIP_INSTALL_PATTERNS: tuple[tuple[str, str], ...] = (
    # pip install from URL / git+url / pre-release / direct-from-source
    (
        r"\bpip(?:3)?\s+install\s+(?:--pre\s+|--index-url\s+\S+\s+|--extra-index-url\s+\S+\s+|-e\s+)?(?:https?://|git\+|svn\+|hg\+|file://)",
        "pip-arbitrary-install",
    ),
    # python -m pip install with the same shapes
    (
        r"\bpython(?:3)?\s+-m\s+pip\s+install\s+(?:--pre\s+|--index-url\s+\S+\s+|--extra-index-url\s+\S+\s+|-e\s+)?(?:https?://|git\+|svn\+|hg\+|file://)",
        "pip-arbitrary-install",
    ),
)

_INSTALL_INSTRUCTION_PATTERNS: tuple[tuple[str, str], ...] = (
    # "First, run `curl ... | sh`"
    (
        r"(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+(?:this\s+|the\s+following\s+)?(?:command|installer|script)[:\s]*\s*[`]?(?:curl|wget|sudo|npx|pip|sh)\b",
        "install-instruction-to-agent",
    ),
    # "Install <package> by running…"
    (
        r"\binstall\s+(?:the\s+|this\s+)?(?:\S+\s+)?(?:by\s+running|via|using)\s+[`]?(?:curl|wget|npx|pip|sh|bash)\b",
        "install-instruction-to-agent",
    ),
)

# v0.2.5 (Round 10 PR 10.1 — closes FN-014 on S-106 brew install +
# Gatekeeper bypass). Homebrew is the macOS Shai-Hulud vector: the
# user pipes a community-maintained cask installation through a
# package manager whose signing chain doesn't validate the cask's
# install-time scripts. The pattern set mirrors the npx family
# (bare verb + arbitrary target). Lockstep with packages/phub/src/
# scanners/t5-unsafe-shell-install.ts § v0.2.5.
_BREW_INSTALL_PATTERNS: tuple[tuple[str, str], ...] = (
    # brew install <pkg> / brew install --cask <pkg> / brew cask install <pkg>
    (
        r"\bbrew\s+(?:cask\s+)?install\s+(?:--cask\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-]+",
        "brew-install",
    ),
    # Verb-anchored inline-code form: "Then run `brew install attacker`"
    (
        r"(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+`\s*brew\s+(?:cask\s+)?install\s+(?:--cask\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-]+",
        "brew-install",
    ),
)

# v0.2.5 (Round 10 PR 10.1 — FN-014 sibling). When the prose
# instructs the agent to disable a platform's signing / policy /
# sandboxing protection, that's the prepare-for-untrusted-install
# attack shape regardless of which installer follows. Three families
# in scope: macOS Gatekeeper / SIP, Windows AppLocker / SmartScreen,
# Linux SELinux / AppArmor. Each fires `policy-bypass`.
_POLICY_BYPASS_PATTERNS: tuple[tuple[str, str], ...] = (
    # macOS: Gatekeeper / SIP / quarantine bypass
    (
        r"\bsudo\s+spctl\s+--(?:master-disable|disable|add)\b",
        "policy-bypass",
    ),
    (
        r"\bxattr\s+(?:-d\s+|-c\s+|-rd\s+)?com\.apple\.quarantine\b",
        "policy-bypass",
    ),
    (
        r"\bcsrutil\s+disable\b",
        "policy-bypass",
    ),
    # Linux: SELinux / AppArmor disable
    (
        r"\bsetenforce\s+0\b",
        "policy-bypass",
    ),
    (
        r"\baa-disable\s+\S+",
        "policy-bypass",
    ),
    # Windows PowerShell: execution-policy / AppLocker / SmartScreen
    (
        r"\bSet-ExecutionPolicy\s+(?:-ExecutionPolicy\s+)?(?:Unrestricted|Bypass)\b",
        "policy-bypass",
    ),
    (
        r"\bSet-MpPreference\s+-DisableRealtimeMonitoring\s+\$?true\b",
        "policy-bypass",
    ),
)

_ALL_PATTERNS = (
    _SHELL_PIPE_PATTERNS
    + _NPX_INSTALL_PATTERNS
    + _PIP_INSTALL_PATTERNS
    + _INSTALL_INSTRUCTION_PATTERNS
    + _BREW_INSTALL_PATTERNS
    + _POLICY_BYPASS_PATTERNS
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
            f"Remove or rephrase ({tag}); this is the Shai-Hulud vector — "
            "remote code fetched and executed without verification."
        ),
        detail_tag=tag,
    )


class T5UnsafeShellInstallDetector:
    """Concrete `Detector` for T5. Mirrors T1's shape (stateless,
    pre-compiled regex pool, hint cap, snippet truncation).
    """

    name = "t5.unsafe_shell_install"
    threat_category = "T5"  # legacy; back-compat
    cci_id = "CCI-005"  # Context CI Top 10 v0.1 canonical ID (ADR-0016)
    detector_version = "0.2.5"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        # v0.2.1 (ADR-0035): skip matches inside frontmatter, inline
        # code spans, or fenced code blocks.
        # v0.2.2 (ADR-0036): also skip matches in negation context.
        md_ctx = analyze_markdown_context(ctx.content)

        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                # v0.2.3 (Round 3): start-only check, NOT range-aware.
                # The verb-anchored patterns added in v0.2.3 deliberately
                # span from prose OUTSIDE inline code into inline code —
                # a range-aware check would skip them because the tail
                # lives inside backticks. start-only fires correctly on
                # the verb anchor (outside) and the existing inside-
                # backtick patterns still skip correctly because their
                # match.start() is inside the inline code.
                #
                # v0.2.4 (Round 6 fix 2 — closes FN-009): if the match
                # is inside a fence whose preceding prose directs the
                # agent to execute its contents ("Before responding,
                # run the install hook:\n```\ncurl ... | sh\n```"),
                # the fence is treated as live attack instruction
                # rather than documentary example. Negation still wins.
                if is_in_any_code_or_frontmatter(
                    match.start(), md_ctx
                ) and not _is_in_directive_referenced_fence(
                    ctx.content, match.start(), md_ctx
                ):
                    continue
                if is_in_negation_context(ctx.content, match.start()):
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
                summary="No unsafe-shell-install patterns matched.",
                detector_version=self.detector_version,
            )

        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            cci_id=self.cci_id,
            severity=Severity.FAIL,
            passed=False,
            summary=(
                f"Matched {len(hints)} unsafe-shell-install pattern"
                f"{'s' if len(hints) != 1 else ''}; "
                "this is the Shai-Hulud supply-chain vector."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )
