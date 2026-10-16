/**
 * Detector-coverage release gate (PH-SEC-004).
 *
 * The published site advertises the full Context CI Top 10. A security
 * reviewer correctly noted that "10/10" is a *claim* unless the installed
 * package is tested to actually run all ten. This suite turns the claim
 * into a build gate: if a detector is dropped from the runtime roster (or
 * registered but not executed on a scan), CI fails here — the coverage
 * number can't silently shrink behind an unchanged marketing line.
 */

import { describe, expect, it } from "vitest"

import { runScan } from "../src/commands/scan.js"
import { detectorCoverage } from "../src/scanners/registry.js"

/** The advertised roster: CCI-001 … CCI-010. */
const ADVERTISED = Array.from({ length: 10 }, (_, i) => `CCI-${String(i + 1).padStart(3, "0")}`)

describe("detector coverage — the advertised Top 10 ship AND run", () => {
  it("the coverage manifest is exactly CCI-001…010 (no gaps, no duplicates)", () => {
    const ids = detectorCoverage()
      .map((d) => d.cciId)
      .sort()
    expect(ids).toEqual(ADVERTISED)
    expect(new Set(ids).size).toBe(10) // no duplicate CCI ids
    // every entry is fully identified (no blank name/category)
    for (const d of detectorCoverage()) {
      expect(d.name.length, d.cciId).toBeGreaterThan(0)
      expect(d.threatCategory.length, d.cciId).toBeGreaterThan(0)
    }
  })

  it("EVERY advertised detector actually executes on a scan (not just registered)", () => {
    const result = runScan("sample.md", "# notes\narbitrary content to scan\n", {
      json: false,
      sarif: false,
      strict: false,
    })
    const ran = new Set(result.verdicts.map((v) => v.cciId))
    for (const cci of ADVERTISED) {
      expect(ran.has(cci), `advertised detector ${cci} did not run on the scan`).toBe(true)
    }
    // exactly the ten — no missing, no stray
    expect(result.verdicts.length).toBe(10)
  })
})
