/**
 * Scanner conformance suite harness — TS side.
 *
 * Per ADR-0032 this file and the Python harness
 * (`apps/api/tests/test_scanner_conformance.py`) run the SAME
 * manifest + fixtures from `docs/context-ci-top-10/conformance/`.
 *
 * Both must pass for a PR to land. Drift between Python and TS
 * detectors fails CI here.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { DETECTORS } from "../src/scanners/registry.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ManifestEntry {
  path: string
  primary_cci: string
  expect: "positive" | "negative"
  expected_detail_tags?: string[]
  also_fires?: string[]
}

function findConformanceDir(): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(cursor, "docs", "context-ci-top-10", "conformance")
    if (existsSync(candidate)) return candidate
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error("could not locate docs/context-ci-top-10/conformance")
}

const CONFORMANCE_DIR = findConformanceDir()
const MANIFEST: ManifestEntry[] = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, "manifest.json"), "utf8"),
).fixtures

const DETECTOR_BY_CCI = new Map(DETECTORS.map((d) => [d.cciId, d]))

describe("scanner conformance suite", () => {
  for (const entry of MANIFEST) {
    it(entry.path, () => {
      const content = readFileSync(join(CONFORMANCE_DIR, entry.path), "utf8")
      const verdicts = new Map(
        DETECTORS.map((d) => [d.cciId, d.run({ content })]),
      )

      if (entry.expect === "negative") {
        for (const [cci, verdict] of verdicts) {
          expect(
            verdict.passed,
            `${entry.path}: ${cci} fired on a negative fixture (severity=${verdict.severity}, hints=${verdict.diffHints.length})`,
          ).toBe(true)
        }
        return
      }

      // Positive expectation:
      expect(
        DETECTOR_BY_CCI.has(entry.primary_cci),
        `${entry.path}: primary_cci ${entry.primary_cci} is not in the active detector roster`,
      ).toBe(true)
      const primaryVerdict = verdicts.get(entry.primary_cci)!
      expect(
        primaryVerdict.passed,
        `${entry.path}: primary_cci ${entry.primary_cci} did NOT fire on a positive fixture`,
      ).toBe(false)

      const expectedTags = entry.expected_detail_tags ?? []
      if (expectedTags.length > 0) {
        const actualTags = new Set(primaryVerdict.diffHints.map((h) => h.detailTag))
        for (const required of expectedTags) {
          expect(
            actualTags.has(required),
            `${entry.path}: expected detail_tag ${JSON.stringify(required)} not in actual tags ${JSON.stringify([...actualTags].sort())}`,
          ).toBe(true)
        }
      }

      const permittedToFire = new Set([entry.primary_cci, ...(entry.also_fires ?? [])])
      for (const [cci, verdict] of verdicts) {
        if (permittedToFire.has(cci)) continue
        expect(
          verdict.passed,
          `${entry.path}: ${cci} fired on a fixture whose primary is ${entry.primary_cci}. ` +
            `Either widen also_fires (with rationale) or tighten the detector.`,
        ).toBe(true)
      }
    })
  }

  it("manifest covers every active detector with at least one positive fixture", () => {
    const positiveCcis = new Set(
      MANIFEST.filter((e) => e.expect === "positive").map((e) => e.primary_cci),
    )
    for (const cci of DETECTOR_BY_CCI.keys()) {
      expect(
        positiveCcis.has(cci),
        `${cci} has no positive fixture — conformance suite must cover every active detector`,
      ).toBe(true)
    }
  })
})
