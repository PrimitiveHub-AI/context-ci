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
    analyze_markdown_context,
    is_in_any_code_or_frontmatter,
)
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

_ALL_PATTERNS = (
    _SHELL_PIPE_PATTERNS
    + _NPX_INSTALL_PATTERNS
    + _PIP_INSTALL_PATTERNS
    + _INSTALL_INSTRUCTION_PATTERNS
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
    detector_version = "0.2.1"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        # v0.2.1 (ADR-0035): skip matches inside frontmatter, inline
        # code spans, or fenced code blocks — these are reference /
        # documentary contexts, not execution instructions.
        md_ctx = analyze_markdown_context(ctx.content)

        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                if is_in_any_code_or_frontmatter(match.start(), md_ctx):
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
