/**
 * Tests for the reachability / role classifier (RC2 Pass A).
 *
 * The PARITY_CASES table is the lockstep contract — it MUST stay identical
 * (same path → same role) to apps/api/tests/test_reachability.py so the TS
 * and Python classifiers never diverge (ADR-0023). Foundation-only pass:
 * the classifier is not wired into scoring, so none of these move a verdict
 * yet — they pin the taxonomy for review.
 */
import { describe, expect, it } from "vitest"

import {
  classifyRole,
  REACH_WEIGHT,
  type ReachRole,
  reachWeight,
} from "../src/scanners/reachability.js"

// (path, expected role) — keep identical to the Python twin's PARITY_CASES.
const PARITY_CASES: Array<[string, ReachRole]> = [
  // INSTRUCTION — surfaces an agent loads as live instruction context
  ["AGENTS.md", "instruction"],
  ["CLAUDE.md", "instruction"],
  ["SKILL.md", "instruction"],
  ["skills/ponytail/SKILL.md", "instruction"],
  [".claude/skills/foo/guide.md", "instruction"],
  [".claude/agents/bar.md", "instruction"],
  [".claude/commands/baz.md", "instruction"],
  [".cursorrules", "instruction"],
  [".cursor/rules/style.mdc", "instruction"],
  [".windsurfrules", "instruction"],
  [".github/copilot-instructions.md", "instruction"],
  ["primitives/review.md", "instruction"],
  ["prompts/system.md", "instruction"],
  ["skills/x/README.md", "instruction"], // any .md under skills/ → skill
  ["tests/SKILL.md", "instruction"], // fail-safe: SKILL.md anywhere
  // INERT — fixtures / tests / benchmarks (attack strings are legit here)
  ["tests/hooks.test.js", "inert"],
  ["test/helper.py", "inert"],
  ["__tests__/x.ts", "inert"],
  ["spec/behaviour.rb", "inert"],
  ["bench/corpus/attack.md", "inert"],
  ["fixtures/sample.md", "inert"],
  ["examples/demo.md", "inert"],
  ["conformance/case-01.json", "inert"],
  ["src/widget.test.ts", "inert"], // .test. suffix
  ["src/widget.spec.ts", "inert"], // .spec. suffix
  // AMBIENT — human-facing docs, not auto-loaded as instruction
  ["README.md", "ambient"],
  ["docs/guide.md", "ambient"],
  ["CHANGELOG.md", "ambient"],
  ["notes.md", "ambient"],
  ["docs/api.rst", "ambient"],
  // UNKNOWN — unrecognized; fails safe to full scrutiny
  ["", "unknown"], // single-blob paste
  ["src/index.ts", "unknown"],
  ["package.json", "unknown"],
  ["mcp.json", "unknown"], // mcp-config is not text-scannable
  ["lib/util.py", "unknown"],
]

describe("reachability role classifier (RC2 Pass A)", () => {
  it.each(PARITY_CASES)("classifies %s as %s", (path, expected) => {
    expect(classifyRole(path)).toBe(expected)
  })

  it("weights are fail-safe (inert < ambient <= instruction; unknown=1.0; never 0)", () => {
    expect(REACH_WEIGHT.inert).toBeLessThan(REACH_WEIGHT.ambient)
    expect(REACH_WEIGHT.ambient).toBeLessThanOrEqual(REACH_WEIGHT.instruction)
    expect(REACH_WEIGHT.unknown).toBe(1.0)
    expect(REACH_WEIGHT.instruction).toBe(1.0)
    for (const w of Object.values(REACH_WEIGHT)) expect(w).toBeGreaterThan(0)
  })

  it("reachWeight helper matches the table", () => {
    expect(reachWeight("tests/hooks.test.js")).toBe(REACH_WEIGHT.inert)
    expect(reachWeight("SKILL.md")).toBe(REACH_WEIGHT.instruction)
    expect(reachWeight("")).toBe(REACH_WEIGHT.unknown)
  })
})
