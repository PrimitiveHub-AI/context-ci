/**
 * CBOM v0.1 conformance suite harness — TS side.
 *
 * Per ADR-0033, the producer MUST yield a byte-identical document for
 * every fixture in docs/cbom/conformance/manifest.json. A future
 * Python `phub_py cbom` (v0.2) will run the same manifest.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { buildCbom, renderCbom, serializeCbom } from "../src/commands/cbom.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ManifestEntry {
  id: string
  description: string
  input_dir: string
  expected_cbom: string
  expected_spdx?: string
  expected_cyclonedx?: string
  subject_name?: string
}

interface Manifest {
  specVersion: string
  fixtures: ManifestEntry[]
}

function findConformanceDir(): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(cursor, "docs", "cbom", "conformance")
    if (existsSync(candidate)) return candidate
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error("could not locate docs/cbom/conformance")
}

const conformanceDir = findConformanceDir()
const manifest = JSON.parse(
  readFileSync(join(conformanceDir, "manifest.json"), "utf8"),
) as Manifest

describe("CBOM v0.1 conformance suite", () => {
  it("manifest declares v0.1 and is non-empty", () => {
    expect(manifest.specVersion).toBe("0.1")
    expect(manifest.fixtures.length).toBeGreaterThan(0)
  })

  for (const entry of manifest.fixtures) {
    describe(`fixture: ${entry.id}`, () => {
      const inputDir = resolve(conformanceDir, entry.input_dir)
      const expectedPath = resolve(conformanceDir, entry.expected_cbom)

      it("produces a byte-identical CBOM against the expected fixture", () => {
        const opts: Parameters<typeof buildCbom>[1] = {}
        if (entry.subject_name !== undefined) opts.subjectName = entry.subject_name
        const cbom = buildCbom(inputDir, opts)
        const actual = serializeCbom(cbom)
        const expected = readFileSync(expectedPath, "utf8")
        expect(actual).toBe(expected)
      })

      it("re-running the producer yields a byte-identical document (reproducibility)", () => {
        const opts: Parameters<typeof buildCbom>[1] = {}
        if (entry.subject_name !== undefined) opts.subjectName = entry.subject_name
        const a = serializeCbom(buildCbom(inputDir, opts))
        const b = serializeCbom(buildCbom(inputDir, opts))
        expect(a).toBe(b)
      })

      if (entry.expected_spdx !== undefined) {
        const expectedSpdxPath = resolve(conformanceDir, entry.expected_spdx)
        it("SPDX projection matches the expected fixture byte-for-byte", () => {
          const opts: Parameters<typeof buildCbom>[1] = {}
          if (entry.subject_name !== undefined) opts.subjectName = entry.subject_name
          const cbom = buildCbom(inputDir, opts)
          const actual = renderCbom(cbom, "spdx")
          const expected = readFileSync(expectedSpdxPath, "utf8")
          expect(actual).toBe(expected)
        })
      }

      if (entry.expected_cyclonedx !== undefined) {
        const expectedCdxPath = resolve(conformanceDir, entry.expected_cyclonedx)
        it("CycloneDX projection matches the expected fixture byte-for-byte", () => {
          const opts: Parameters<typeof buildCbom>[1] = {}
          if (entry.subject_name !== undefined) opts.subjectName = entry.subject_name
          const cbom = buildCbom(inputDir, opts)
          const actual = renderCbom(cbom, "cyclonedx")
          const expected = readFileSync(expectedCdxPath, "utf8")
          expect(actual).toBe(expected)
        })
      }
    })
  }
})
