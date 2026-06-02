/**
 * SARIF reporter tests. Structural — does not pull in a SARIF schema
 * validator (would add a runtime/dev dep for marginal benefit). The
 * assertions below cover the fields GitHub Code Scanning consumes:
 * version, tool.driver, results[].ruleId/level/locations/region/
 * snippet, partialFingerprints.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { runScan } from "../src/commands/scan.js"
import { renderSarif } from "../src/reporters/sarif.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIX = (name: string): string =>
  readFileSync(join(__dirname, "fixtures", name), "utf8")

function scanFixture(filename: string): ReturnType<typeof runScan> {
  return runScan(filename, FIX(filename), { json: false, sarif: false, strict: false })
}

function parseSarif(content: string, verdicts: ReturnType<typeof scanFixture>["verdicts"]): {
  $schema: string
  version: string
  runs: Array<{
    tool: { driver: { name: string; version: string; informationUri: string; rules: Array<{ id: string; name: string; helpUri: string; defaultConfiguration: { level: string }; properties: object }> } }
    results: Array<{
      ruleId: string
      ruleIndex: number
      level: string
      message: { text: string }
      locations: Array<{ physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number; snippet: { text: string } } } }>
      partialFingerprints: Record<string, string>
      properties: { detailTag: string; threatCategory: string }
    }>
  }>
} {
  const _ignored = verdicts
  return JSON.parse(content)
}

describe("renderSarif structural shape", () => {
  it("emits SARIF 2.1.0 with the json.schemastore.org $schema", () => {
    const result = scanFixture("clean.md")
    const doc = parseSarif(renderSarif("clean.md", result.verdicts), result.verdicts)
    expect(doc.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json")
    expect(doc.version).toBe("2.1.0")
  })

  it("includes tool.driver.name=phub + version + informationUri", () => {
    const result = scanFixture("clean.md")
    const doc = parseSarif(renderSarif("clean.md", result.verdicts), result.verdicts)
    const driver = doc.runs[0]!.tool.driver
    expect(driver.name).toBe("phub")
    expect(driver.version).toBe("0.1.0")
    expect(driver.informationUri).toBe("https://primitivehub.ai")
  })

  it("emits all 3 detectors as rules even when only some fire", () => {
    const result = scanFixture("t1-prompt-injection.md")
    const doc = parseSarif(renderSarif("t1-prompt-injection.md", result.verdicts), result.verdicts)
    const rules = doc.runs[0]!.tool.driver.rules
    expect(rules.length).toBe(3)
    expect(rules.map((r) => r.id).sort()).toEqual(["CCI-001", "CCI-002", "CCI-005"])
  })

  it("each rule has helpUri pointing to the Top 10 anchor", () => {
    const result = scanFixture("clean.md")
    const doc = parseSarif(renderSarif("clean.md", result.verdicts), result.verdicts)
    for (const rule of doc.runs[0]!.tool.driver.rules) {
      expect(rule.helpUri).toMatch(/^https:\/\/primitivehub\.ai\/top-10#CCI-\d{3}$/)
      expect(rule.defaultConfiguration.level).toBe("error")
    }
  })
})

describe("renderSarif results", () => {
  it("emits no results on the clean fixture", () => {
    const result = scanFixture("clean.md")
    const doc = parseSarif(renderSarif("clean.md", result.verdicts), result.verdicts)
    expect(doc.runs[0]!.results).toEqual([])
  })

  it("emits one result per diff hint on T1 fixture", () => {
    const result = scanFixture("t1-prompt-injection.md")
    const doc = parseSarif(renderSarif("t1-prompt-injection.md", result.verdicts), result.verdicts)
    const t1 = result.verdicts.find((v) => v.cciId === "CCI-001")!
    expect(doc.runs[0]!.results.length).toBe(t1.diffHints.length)
  })

  it("level=error for FAIL verdicts", () => {
    const result = scanFixture("t1-prompt-injection.md")
    const doc = parseSarif(renderSarif("t1-prompt-injection.md", result.verdicts), result.verdicts)
    for (const r of doc.runs[0]!.results) {
      expect(r.level).toBe("error")
    }
  })

  it("each result has a physical location with startLine + snippet + uri", () => {
    const result = scanFixture("t1-prompt-injection.md")
    const doc = parseSarif(renderSarif("AGENTS.md", result.verdicts), result.verdicts)
    for (const r of doc.runs[0]!.results) {
      const loc = r.locations[0]!.physicalLocation
      expect(loc.artifactLocation.uri).toBe("AGENTS.md")
      expect(loc.region.startLine).toBeGreaterThan(0)
      expect(loc.region.snippet.text.length).toBeGreaterThan(0)
    }
  })

  it("each result has stable partialFingerprints.contextCiDetail (sha256 hex, 16 chars)", () => {
    const result = scanFixture("t1-prompt-injection.md")
    const doc = parseSarif(renderSarif("file.md", result.verdicts), result.verdicts)
    const fingerprints = doc.runs[0]!.results.map((r) => r.partialFingerprints.contextCiDetail)
    for (const fp of fingerprints) {
      expect(fp).toMatch(/^[0-9a-f]{16}$/)
    }
    // Re-running on the same input must produce identical fingerprints
    const doc2 = parseSarif(renderSarif("file.md", result.verdicts), result.verdicts)
    expect(doc2.runs[0]!.results.map((r) => r.partialFingerprints.contextCiDetail)).toEqual(fingerprints)
  })

  it("results carry detailTag + threatCategory properties for downstream filtering", () => {
    const result = scanFixture("t5-unsafe-install.md")
    const doc = parseSarif(renderSarif("install.md", result.verdicts), result.verdicts)
    for (const r of doc.runs[0]!.results) {
      expect(r.properties.threatCategory).toBe("T5")
      expect(r.properties.detailTag.length).toBeGreaterThan(0)
    }
  })

  it("ruleIndex points at the matching rule", () => {
    const result = scanFixture("t5-unsafe-install.md")
    const doc = parseSarif(renderSarif("install.md", result.verdicts), result.verdicts)
    const rules = doc.runs[0]!.tool.driver.rules
    for (const r of doc.runs[0]!.results) {
      expect(rules[r.ruleIndex]!.id).toBe(r.ruleId)
    }
  })
})
