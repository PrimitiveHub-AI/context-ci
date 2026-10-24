"""Tests for the reachability / role classifier (RC2 Pass A).

The PARITY_CASES table is the lockstep contract — it MUST stay identical
(same path → same role) to packages/phub/test/reachability.test.ts so the
Python and TS classifiers never diverge (ADR-0023). This is a foundation-
only pass: the classifier is NOT wired into scoring, so none of these
change a verdict yet — they pin the taxonomy for review.
"""

from __future__ import annotations

import pytest

from scanners.reachability import (
    REACH_WEIGHT,
    ReachRole,
    classify_role,
    reach_weight,
)

# (path, expected role) — keep identical to the TS twin's PARITY_CASES.
PARITY_CASES: list[tuple[str, str]] = [
    # INSTRUCTION — surfaces an agent loads as live instruction context
    ("AGENTS.md", "instruction"),
    ("CLAUDE.md", "instruction"),
    ("SKILL.md", "instruction"),
    ("skills/ponytail/SKILL.md", "instruction"),
    (".claude/skills/foo/guide.md", "instruction"),
    (".claude/agents/bar.md", "instruction"),
    (".claude/commands/baz.md", "instruction"),
    (".cursorrules", "instruction"),
    (".cursor/rules/style.mdc", "instruction"),
    (".windsurfrules", "instruction"),
    (".github/copilot-instructions.md", "instruction"),
    ("primitives/review.md", "instruction"),
    ("prompts/system.md", "instruction"),
    ("skills/x/README.md", "instruction"),  # any .md under skills/ → skill
    ("tests/SKILL.md", "instruction"),  # fail-safe: SKILL.md anywhere
    # INERT — fixtures / tests / benchmarks (attack strings are legit here)
    ("tests/hooks.test.js", "inert"),
    ("test/helper.py", "inert"),
    ("__tests__/x.ts", "inert"),
    ("spec/behaviour.rb", "inert"),
    ("bench/corpus/attack.md", "inert"),
    ("fixtures/sample.md", "inert"),
    ("examples/demo.md", "inert"),
    ("conformance/case-01.json", "inert"),
    ("src/widget.test.ts", "inert"),  # .test. suffix
    ("src/widget.spec.ts", "inert"),  # .spec. suffix
    # AMBIENT — human-facing docs, not auto-loaded as instruction
    ("README.md", "ambient"),
    ("docs/guide.md", "ambient"),
    ("CHANGELOG.md", "ambient"),
    ("notes.md", "ambient"),
    ("docs/api.rst", "ambient"),
    # UNKNOWN — unrecognized; fails safe to full scrutiny
    ("", "unknown"),  # single-blob paste
    ("src/index.ts", "unknown"),
    ("package.json", "unknown"),
    ("mcp.json", "unknown"),  # mcp-config is not text-scannable
    ("lib/util.py", "unknown"),
]


@pytest.mark.parametrize(("path", "expected"), PARITY_CASES)
def test_classify_role(path: str, expected: str) -> None:
    assert classify_role(path).value == expected


def test_reach_weights_are_fail_safe() -> None:
    # inert < ambient <= instruction; unknown fails safe to full scrutiny.
    assert REACH_WEIGHT[ReachRole.INERT] < REACH_WEIGHT[ReachRole.AMBIENT]
    assert REACH_WEIGHT[ReachRole.AMBIENT] <= REACH_WEIGHT[ReachRole.INSTRUCTION]
    assert REACH_WEIGHT[ReachRole.UNKNOWN] == 1.0
    assert REACH_WEIGHT[ReachRole.INSTRUCTION] == 1.0
    # Never zero — down-weight, never suppress (attacker hiding in tests/
    # still scores).
    assert all(w > 0 for w in REACH_WEIGHT.values())


def test_reach_weight_helper_matches_table() -> None:
    assert reach_weight("tests/hooks.test.js") == REACH_WEIGHT[ReachRole.INERT]
    assert reach_weight("SKILL.md") == REACH_WEIGHT[ReachRole.INSTRUCTION]
    assert reach_weight("") == REACH_WEIGHT[ReachRole.UNKNOWN]
