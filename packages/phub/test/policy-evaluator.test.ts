/**
 * Evaluator tests, including the scenarios/*.json conformance fixtures.
 * Each scenario specifies (policy YAML, verdicts, filename, expected
 * exitCode + counts). The evaluator runs them through applyPolicy and
 * asserts the documented outcomes (spec § 6).
 */

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { applyPolicy } from "../src/policy/evaluator.js"
import { loadPolicyFromString } from "../src/policy/loader.js"
import { type Verdict } from "../src/scanners/types.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function findScenariosDir(): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const c = join(cursor, "docs", "context-policy", "conformance", "scenarios")
    if (existsSync(c)) return c
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error("could not locate docs/context-policy/conformance/scenarios")
}

const SCENARIOS_DIR = findScenariosDir()
const scenarioFiles = readdirSync(SCENARIOS_DIR)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => join(SCENARIOS_DIR, n))

interface Scenario {
  name: string
  description: string
  policy_yaml: string
  filename: string
  verdicts: Verdict[]
  expected: {
    exitCode: 0 | 1
    suppressedFindingsCount?: number
    survivingFailVerdicts?: number
    survivingWarningVerdicts?: number
    survivingHintsOnFirstVerdict?: number
    allowReasons?: string[]
  }
}

describe("evaluator scenarios (conformance suite)", () => {
  for (const path of scenarioFiles) {
    const name = path.split("/").pop()!
    it(`passes ${name}`, () => {
      const scenario: Scenario = JSON.parse(readFileSync(path, "utf8"))
      const policy = loadPolicyFromString(scenario.policy_yaml, scenario.name)
      const evaluation = applyPolicy(scenario.verdicts, policy, scenario.filename)

      expect(evaluation.exitCode, `${name}: exitCode`).toBe(scenario.expected.exitCode)

      if (scenario.expected.suppressedFindingsCount !== undefined) {
        expect(evaluation.summary.suppressedFindingsCount, `${name}: suppressedFindingsCount`).toBe(
          scenario.expected.suppressedFindingsCount,
        )
      }
      if (scenario.expected.survivingFailVerdicts !== undefined) {
        expect(evaluation.summary.survivingFailVerdicts, `${name}: survivingFailVerdicts`).toBe(
          scenario.expected.survivingFailVerdicts,
        )
      }
      if (scenario.expected.survivingWarningVerdicts !== undefined) {
        expect(evaluation.summary.survivingWarningVerdicts, `${name}: survivingWarningVerdicts`).toBe(
          scenario.expected.survivingWarningVerdicts,
        )
      }
      if (scenario.expected.survivingHintsOnFirstVerdict !== undefined) {
        const firstUnpassed = evaluation.adjusted.find((a) => !a.verdict.passed)
        expect(firstUnpassed?.verdict.diffHints.length, `${name}: survivingHintsOnFirstVerdict`).toBe(
          scenario.expected.survivingHintsOnFirstVerdict,
        )
      }
      if (scenario.expected.allowReasons !== undefined) {
        const reasons = evaluation.adjusted.flatMap((a) =>
          a.allowedHints.map((ah) => ah.allowEntry.reason),
        )
        for (const expected of scenario.expected.allowReasons) {
          expect(reasons, `${name}: allowReasons`).toContain(expected)
        }
      }
    })
  }
})

describe("evaluator edge cases", () => {
  it("empty verdicts + any policy → exit 0", () => {
    const policy = loadPolicyFromString('version: "0.1"\n')
    const e = applyPolicy([], policy, "anything.md")
    expect(e.exitCode).toBe(0)
    expect(e.summary).toEqual({
      suppressedFindingsCount: 0,
      survivingFailVerdicts: 0,
      survivingWarningVerdicts: 0,
      survivingNoteVerdicts: 0,
      fullySuppressedVerdicts: 0,
    })
  })

  it("passed=true verdict → preserved, no allow application", () => {
    const policy = loadPolicyFromString('version: "0.1"\n')
    const v: Verdict = {
      detectorName: "t1.prompt_injection",
      threatCategory: "T1",
      cciId: "CCI-001",
      severity: "info",
      passed: true,
      summary: "No matches.",
      detectorVersion: "0.1.0",
      diffHints: [],
    }
    const e = applyPolicy([v], policy, "x.md")
    expect(e.exitCode).toBe(0)
    expect(e.adjusted[0]!.verdict.passed).toBe(true)
  })
})
