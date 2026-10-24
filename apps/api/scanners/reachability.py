"""Reachability / role classifier — RC2 Pass A (foundation only).

Answers one question about a scanned file: "would an agent LOAD this as
live instruction context, or is it an inert fixture / human-facing doc?"

The role is intended to become a CONFIDENCE MULTIPLIER on a finding's score
(RC2 Pass B), so the same attack string weighs more in a loaded SKILL.md
than in a test fixture — WITHOUT ever whitelisting: INERT is down-weighted,
never zeroed, and UNKNOWN fails safe to full scrutiny.

As of Pass A this module is PURE, deterministic, and NOT wired into scoring
or any detector. It ships with tests so the taxonomy can be reviewed before
it moves a single verdict.

INSTRUCTION detection reuses a faithful port of the existing artifact
classifier — the single source of truth for "is this a recognized
agent-instruction surface". Lockstep partner:
packages/phub/src/scanners/reachability.ts (which imports the TS original
packages/phub/src/audit/classifier.ts). A shared test table enforces parity.
"""

from __future__ import annotations

import re
from enum import StrEnum

# ─────────────────────────────────────────────────────────────────────
# Artifact classification — faithful port of packages/phub/src/audit/
# classifier.ts (ADR-0025). Returns one of the closed artifact classes,
# or None when the path is not a recognized context artifact. Any change
# here MUST land in lockstep with classifier.ts.
# ─────────────────────────────────────────────────────────────────────

_TEXT_SCANNABLE: frozenset[str] = frozenset(
    {
        "agents-md",
        "claude-md",
        "cursor-rules",
        "windsurf-rules",
        "copilot-instructions",
        "claude-skill",
        "claude-agent",
        "claude-command",
        "primitive",
        "skill",
        "prompt",
    }
)


def _classify_artifact(rel_path: str) -> str | None:
    """Port of classifier.ts `classify()`. Pure; no I/O."""
    norm = rel_path.replace("\\", "/")
    segments = [s for s in norm.split("/") if s]
    if not segments:
        return None
    base = segments[-1]

    # Dotfile bases — exact basename.
    if base == ".cursorrules":
        return "cursor-rules"
    if base == ".windsurfrules":
        return "windsurf-rules"
    if base in (".aider.conf.yml", ".aiderignore"):
        return "aider-config"

    # GitHub copilot instructions — `.github/copilot-instructions.md`.
    for i in range(len(segments) - 1):
        if (
            segments[i] == ".github"
            and segments[i + 1] == "copilot-instructions.md"
            and i + 1 == len(segments) - 1
        ):
            return "copilot-instructions"

    # .claude/{skills,agents,commands}/**/*.md
    if ".claude" in segments and base.endswith(".md"):
        idx = segments.index(".claude")
        nxt = segments[idx + 1] if idx + 1 < len(segments) else None
        if nxt == "skills":
            return "claude-skill"
        if nxt == "agents":
            return "claude-agent"
        if nxt == "commands":
            return "claude-command"

    # .cursor/rules/** — Cursor MDC rules subtree.
    if (
        ".cursor" in segments
        and "rules" in segments
        and (base.endswith(".md") or base.endswith(".mdc"))
    ):
        return "cursor-rules"

    # MCP config (JSON) — basename match.
    if base == "mcp.json" or base.endswith(".mcp.json"):
        return "mcp-config"

    # Bare project files anywhere in the tree.
    if base == "AGENTS.md":
        return "agents-md"
    if base == "CLAUDE.md":
        return "claude-md"
    if base == "SKILL.md":
        return "skill"

    # Directory-bucket classes — only for .md files.
    if not base.endswith(".md"):
        return None
    if "primitives" in segments:
        return "primitive"
    if "skills" in segments:
        return "skill"
    if "prompts" in segments:
        return "prompt"

    return None


def _is_text_scannable(cls: str | None) -> bool:
    return cls is not None and cls in _TEXT_SCANNABLE


# ─────────────────────────────────────────────────────────────────────
# Reachability role
# ─────────────────────────────────────────────────────────────────────


class ReachRole(StrEnum):
    INSTRUCTION = "instruction"
    AMBIENT = "ambient"
    INERT = "inert"
    UNKNOWN = "unknown"


#: Provisional confidence weights (RC2 Pass B spends these in the scorer).
#: INERT < AMBIENT < INSTRUCTION; UNKNOWN fails safe to 1.0. Never 0 — an
#: inert finding is down-weighted, not suppressed, so an attacker hiding a
#: payload in tests/ still scores. Provisional until Pass B corpus calibration.
REACH_WEIGHT: dict[ReachRole, float] = {
    ReachRole.INSTRUCTION: 1.0,
    ReachRole.AMBIENT: 0.7,
    ReachRole.INERT: 0.4,
    ReachRole.UNKNOWN: 1.0,
}

_INERT_SEGMENTS: frozenset[str] = frozenset(
    {
        "tests",
        "test",
        "__tests__",
        "spec",
        "specs",
        "fixtures",
        "fixture",
        "bench",
        "benchmarks",
        "examples",
        "example",
        "conformance",
        "__mocks__",
        "testdata",
        "e2e",
    }
)

_AMBIENT_SEGMENTS: frozenset[str] = frozenset({"docs", "doc"})
_AMBIENT_EXTS: frozenset[str] = frozenset({".md", ".mdx", ".markdown", ".rst", ".txt"})
_AMBIENT_BASENAME_RE = re.compile(
    r"^(readme|changelog|contributing|history|notice|authors)\b", re.IGNORECASE
)


def _segments(rel_path: str) -> list[str]:
    return [s for s in rel_path.replace("\\", "/").split("/") if s]


def _is_inert(rel_path: str) -> bool:
    segs = _segments(rel_path)
    base = (segs[-1] if segs else "").lower()
    if ".test." in base or ".spec." in base:
        return True
    return any(s.lower() in _INERT_SEGMENTS for s in segs)


def _is_ambient(rel_path: str) -> bool:
    segs = _segments(rel_path)
    base = segs[-1] if segs else ""
    if not base:
        return False
    if _AMBIENT_BASENAME_RE.search(base):
        return True
    if any(s.lower() in _AMBIENT_SEGMENTS for s in segs):
        return True
    dot = base.rfind(".")
    return dot > 0 and base[dot:].lower() in _AMBIENT_EXTS


def classify_role(file_path: str) -> ReachRole:
    """Map a repo-relative path (forward slashes; empty for a single-blob
    paste) to a reachability role.

    Precedence is fail-safe: a recognized instruction surface wins even
    under tests/ (over-scrutiny beats under-scrutiny), and anything
    unrecognized is UNKNOWN (full scrutiny), never silently inert.
    """
    if _is_text_scannable(_classify_artifact(file_path)):
        return ReachRole.INSTRUCTION
    if _is_inert(file_path):
        return ReachRole.INERT
    if _is_ambient(file_path):
        return ReachRole.AMBIENT
    return ReachRole.UNKNOWN


def reach_weight(file_path: str) -> float:
    """Convenience: the provisional confidence weight for a path's role."""
    return REACH_WEIGHT[classify_role(file_path)]
