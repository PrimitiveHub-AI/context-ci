/**
 * Scanner-level tests for T1, T2, T5 TS ports.
 *
 * Goal: ensure each detector fires on its adversarial fixture and
 * stays silent on the clean fixture. NOT a byte-for-byte parity
 * check against the Python detectors — that's the future
 * scanner-conformance-suite work (deferred to v0.2 per ADR-0023).
 */

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { T1PromptInjectionDetector } from "../src/scanners/t1-prompt-injection.js"
import { T2UnicodeSteganographyDetector } from "../src/scanners/t2-unicode-steganography.js"
import { T5UnsafeShellInstallDetector } from "../src/scanners/t5-unsafe-shell-install.js"
import { Severity } from "../src/scanners/types.js"
import { DETECTORS, detectorByName } from "../src/scanners/registry.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIX = (name: string): string =>
  readFileSync(join(__dirname, "fixtures", name), "utf8")

describe("T1 prompt-injection detector", () => {
  const d = new T1PromptInjectionDetector()

  it("identifies itself with the CCI-001 stable ID", () => {
    expect(d.name).toBe("t1.prompt_injection")
    expect(d.cciId).toBe("CCI-001")
    expect(d.threatCategory).toBe("T1")
  })

  it("passes on the clean fixture (INFO + passed=true + no hints)", () => {
    const v = d.run({ content: FIX("clean.md") })
    expect(v.severity).toBe(Severity.INFO)
    expect(v.passed).toBe(true)
    expect(v.diffHints).toEqual([])
  })

  it("fails on the T1 adversarial fixture (FAIL + hints from multiple families)", () => {
    const v = d.run({ content: FIX("t1-prompt-injection.md") })
    expect(v.severity).toBe(Severity.FAIL)
    expect(v.passed).toBe(false)
    expect(v.diffHints.length).toBeGreaterThanOrEqual(4)
    const tags = new Set(v.diffHints.map((h) => h.detailTag))
    expect(tags.has("override-system-instructions")).toBe(true)
    expect(tags.has("role-hijack")).toBe(true)
    expect(tags.has("hidden-instructions")).toBe(true)
    expect(tags.has("credential-exfiltration-hint")).toBe(true)
  })

  it("caps hints at MAX_HINTS_PER_VERDICT", () => {
    const long = "ignore previous instructions\n".repeat(30)
    const v = d.run({ content: long })
    expect(v.diffHints.length).toBeLessThanOrEqual(10)
  })
})

describe("T2 Unicode-steganography detector", () => {
  const d = new T2UnicodeSteganographyDetector()

  it("identifies itself with the CCI-002 stable ID", () => {
    expect(d.cciId).toBe("CCI-002")
  })

  it("passes on the clean fixture", () => {
    const v = d.run({ content: FIX("clean.md") })
    expect(v.severity).toBe(Severity.INFO)
    expect(v.passed).toBe(true)
  })

  it("fails on the T2 fixture and surfaces every codepoint family", () => {
    const v = d.run({ content: FIX("t2-unicode-steg.md") })
    expect(v.severity).toBe(Severity.FAIL)
    expect(v.passed).toBe(false)
    const tags = new Set(v.diffHints.map((h) => h.detailTag))
    expect(tags.has("zero-width-invisible")).toBe(true)
    expect(tags.has("bidi-control")).toBe(true)
    expect(tags.has("mixed-script-confusable")).toBe(true)
  })

  it("reports correct 1-indexed line numbers for hidden codepoints", () => {
    // ZWSP on line 3 of the fixture
    const v = d.run({ content: FIX("t2-unicode-steg.md") })
    const zwsp = v.diffHints.find((h) => h.detailTag === "zero-width-invisible")
    expect(zwsp?.line).toBe(3)
  })

  it("treats single-character words as safe (no false mixed-script)", () => {
    const v = d.run({ content: "a б" }) // single Latin + single Cyrillic, separated
    expect(v.passed).toBe(true)
  })
})

describe("T5 unsafe-shell-install detector", () => {
  const d = new T5UnsafeShellInstallDetector()

  it("identifies itself with the CCI-005 stable ID", () => {
    expect(d.cciId).toBe("CCI-005")
  })

  it("passes on the clean fixture", () => {
    const v = d.run({ content: FIX("clean.md") })
    expect(v.severity).toBe(Severity.INFO)
    expect(v.passed).toBe(true)
  })

  it("fails on the T5 fixture across multiple pattern families", () => {
    const v = d.run({ content: FIX("t5-unsafe-install.md") })
    expect(v.severity).toBe(Severity.FAIL)
    expect(v.passed).toBe(false)
    const tags = new Set(v.diffHints.map((h) => h.detailTag))
    expect(tags.has("shell-pipe-from-network")).toBe(true)
    expect(tags.has("npx-arbitrary-install")).toBe(true)
    expect(tags.has("pip-arbitrary-install")).toBe(true)
    expect(tags.has("install-instruction-to-agent")).toBe(true)
  })
})

describe("detector registry", () => {
  it("ships all six active detectors in stable category-number order", () => {
    expect(DETECTORS.map((d) => d.cciId)).toEqual([
      "CCI-001",
      "CCI-002",
      "CCI-003",
      "CCI-004",
      "CCI-005",
      "CCI-006",
    ])
  })

  it("looks up by name, CCI ID, or threat category", () => {
    expect(detectorByName("t1.prompt_injection")?.cciId).toBe("CCI-001")
    expect(detectorByName("CCI-002")?.cciId).toBe("CCI-002")
    expect(detectorByName("T5")?.cciId).toBe("CCI-005")
    expect(detectorByName("unknown-detector")).toBeUndefined()
  })
})
