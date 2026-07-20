/**
 * CBOM verifier tests (spec § 8) + JSON schema validation
 * (spec § 9).
 *
 * The verifier diffs a stored CBOM against the current workspace
 * across four drift dimensions (added / removed / modified /
 * reclassified), mirroring phub.lock drift terminology.
 *
 * The schema is asserted to validate every emitted CBOM:
 *   1. the canonical minimal-workspace fixture,
 *   2. a CBOM emitted against a tmp workspace built by the test.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import Ajv2020 from "ajv/dist/2020.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { main } from "../src/cli.js"
import {
  buildCbom,
  renderCbom,
  serializeCbom,
} from "../src/commands/cbom.js"
import {
  CbomParseError,
  diffCbomVsWorkspace,
  isCbomDrifted,
  parseCbom,
  totalDriftCount,
  verifyCbom,
} from "../src/cbom/verify.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function findRepoFile(rel: string): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(cursor, rel)
    if (existsSync(candidate)) return candidate
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error(`could not locate ${rel}`)
}

const SCHEMA_PATH = findRepoFile("docs/cbom/schema.json")
const FIXTURE_CBOM_PATH = findRepoFile(
  "docs/cbom/conformance/fixtures/minimal-workspace/expected.cbom.json",
)
const FIXTURE_INPUT_DIR = findRepoFile(
  "docs/cbom/conformance/fixtures/minimal-workspace/input",
)

function buildMinimalWorkspace(): string {
  const tmp = mkdtempSync(join(tmpdir(), "phub-cbom-verify-"))
  writeFileSync(join(tmp, "AGENTS.md"), "# A\nbody\n", "utf8")
  writeFileSync(join(tmp, "CLAUDE.md"), "# C\nbody\n", "utf8")
  const primDir = join(tmp, "apps/web/content/primitives")
  mkdirSync(primDir, { recursive: true })
  writeFileSync(
    join(primDir, "p1.md"),
    "---\nname: p1\nversion: 1.2.3\n---\n\nbody\n",
    "utf8",
  )
  return tmp
}

describe("CBOM JSON schema (spec § 9)", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv2020 as unknown as new (...args: any[]) => any)({ strict: false })
  const validate = ajv.compile(schema)

  it("declares JSON Schema 2020-12 + the canonical $id", () => {
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
    expect(schema.$id).toBe("https://primitivehub.ai/cbom/v0.1.json")
  })

  it("validates the canonical fixture CBOM", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_CBOM_PATH, "utf8"))
    const ok = validate(fixture)
    expect(validate.errors ?? null).toBeNull()
    expect(ok).toBe(true)
  })

  it("validates a freshly produced CBOM (sanity)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = JSON.parse(renderCbom(buildCbom(ws, { subjectName: "demo" })))
    const ok = validate(cbom)
    expect(validate.errors ?? null).toBeNull()
    expect(ok).toBe(true)
  })

  it("rejects an unknown classification value", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_CBOM_PATH, "utf8"))
    fixture.components[0].classification = "not-a-real-class"
    const ok = validate(fixture)
    expect(ok).toBe(false)
  })

  it("rejects a malformed contentDigest", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_CBOM_PATH, "utf8"))
    fixture.components[0].contentDigest = "md5:abcdef"
    const ok = validate(fixture)
    expect(ok).toBe(false)
  })

  it("rejects a missing required top-level key", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_CBOM_PATH, "utf8"))
    delete fixture.tool
    const ok = validate(fixture)
    expect(ok).toBe(false)
  })

  it("rejects unknown top-level keys (additionalProperties: false)", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_CBOM_PATH, "utf8"))
    fixture.extraField = "nope"
    const ok = validate(fixture)
    expect(ok).toBe(false)
  })
})

describe("parseCbom — wire-format gating", () => {
  it("returns the parsed object on a valid CBOM", () => {
    const content = readFileSync(FIXTURE_CBOM_PATH, "utf8")
    const cbom = parseCbom(content, FIXTURE_CBOM_PATH)
    expect(cbom.cbomFormat).toBe("primitivehub-cbom")
    expect(cbom.cbomVersion).toBe("0.1")
  })

  it("throws on invalid JSON", () => {
    expect(() => parseCbom("not json {", "x")).toThrow(CbomParseError)
  })

  it("throws on wrong cbomFormat", () => {
    expect(() =>
      parseCbom(JSON.stringify({ cbomFormat: "spdx", cbomVersion: "0.1", components: [] }), "x"),
    ).toThrow(/cbomFormat/)
  })

  it("throws on unsupported cbomVersion", () => {
    expect(() =>
      parseCbom(
        JSON.stringify({ cbomFormat: "primitivehub-cbom", cbomVersion: "0.2", components: [] }),
        "x",
      ),
    ).toThrow(/cbomVersion/)
  })
})

describe("diffCbomVsWorkspace", () => {
  it("returns empty drift on identity", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const drift = diffCbomVsWorkspace(cbom, cbom)
    expect(isCbomDrifted(drift)).toBe(false)
    expect(totalDriftCount(drift)).toBe(0)
  })

  it("surfaces an added path (workspace gained a file)", () => {
    const ws = buildMinimalWorkspace()
    const stored = buildCbom(ws, { subjectName: "demo" })
    writeFileSync(join(ws, "EXTRA.md"), "# E\n", "utf8")
    const walked = buildCbom(ws, { subjectName: "demo" })
    // EXTRA.md doesn't classify; we need something that does. Use the
    // dotfile route — add a .cursorrules instead.
    writeFileSync(join(ws, ".cursorrules"), "x\n", "utf8")
    const walked2 = buildCbom(ws, { subjectName: "demo" })
    const drift = diffCbomVsWorkspace(stored, walked2)
    expect(drift.added.map((a) => a.path)).toContain(".cursorrules")
    expect(walked).toBeDefined()
  })

  it("surfaces a removed path", () => {
    const ws = buildMinimalWorkspace()
    const stored = buildCbom(ws, { subjectName: "demo" })
    rmSync(join(ws, "AGENTS.md"))
    const walked = buildCbom(ws, { subjectName: "demo" })
    const drift = diffCbomVsWorkspace(stored, walked)
    expect(drift.removed.map((r) => r.path)).toContain("AGENTS.md")
  })

  it("surfaces a modified path (content digest changed)", () => {
    const ws = buildMinimalWorkspace()
    const stored = buildCbom(ws, { subjectName: "demo" })
    writeFileSync(join(ws, "AGENTS.md"), "# A\nextra\n", "utf8")
    const walked = buildCbom(ws, { subjectName: "demo" })
    const drift = diffCbomVsWorkspace(stored, walked)
    expect(drift.modified.map((m) => m.path)).toContain("AGENTS.md")
  })

  it("emits per-dimension entries sorted lexicographically by path", () => {
    const ws = buildMinimalWorkspace()
    const stored = buildCbom(ws, { subjectName: "demo" })
    writeFileSync(join(ws, ".cursorrules"), "x", "utf8")
    writeFileSync(join(ws, ".windsurfrules"), "y", "utf8")
    const walked = buildCbom(ws, { subjectName: "demo" })
    const drift = diffCbomVsWorkspace(stored, walked)
    const sorted = [...drift.added.map((a) => a.path)].sort()
    expect(drift.added.map((a) => a.path)).toEqual(sorted)
  })
})

describe("verifyCbom — happy path", () => {
  it("returns hasDrift=false on the canonical fixture", () => {
    const content = readFileSync(FIXTURE_CBOM_PATH, "utf8")
    const result = verifyCbom({
      workspaceRoot: FIXTURE_INPUT_DIR,
      cbomPath: FIXTURE_CBOM_PATH,
      cbomContent: content,
    })
    expect(result.hasDrift).toBe(false)
    expect(result.formatMatch).toBe(true)
    expect(totalDriftCount(result.drift)).toBe(0)
  })
})

describe("phub cbom --verify CLI", () => {
  let captured: { stdout: string; stderr: string }
  let restore: () => void
  beforeEach(() => {
    const origOut = process.stdout.write.bind(process.stdout)
    const origErr = process.stderr.write.bind(process.stderr)
    captured = { stdout: "", stderr: "" }
    process.stdout.write = ((chunk: string | Uint8Array) => {
      captured.stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
      return true
    }) as typeof process.stdout.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      captured.stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
      return true
    }) as typeof process.stderr.write
    restore = () => {
      process.stdout.write = origOut
      process.stderr.write = origErr
    }
  })
  afterEach(() => restore())

  it("exit 0 + 'CBOM verified' on a matched workspace", async () => {
    const code = await main(["cbom", FIXTURE_INPUT_DIR, "--verify", FIXTURE_CBOM_PATH])
    expect(code).toBe(0)
    expect(captured.stdout).toMatch(/CBOM verified/)
  })

  it("exit 1 on drift; report lists per-dimension changes", async () => {
    const ws = buildMinimalWorkspace()
    const cbom = serializeCbom(buildCbom(ws, { subjectName: "demo" }))
    const cbomPath = join(ws, "snapshot.cbom.json")
    writeFileSync(cbomPath, cbom, "utf8")
    // Mutate the workspace after snapshot.
    writeFileSync(join(ws, "AGENTS.md"), "# A\nmutated\n", "utf8")
    const code = await main(["cbom", ws, "--verify", cbomPath])
    expect(code).toBe(1)
    expect(captured.stdout).toMatch(/CBOM drift detected/)
    expect(captured.stdout).toMatch(/Modified \(digest changed\)/)
  })

  it("exit 2 if the CBOM file doesn't exist", async () => {
    const code = await main(["cbom", FIXTURE_INPUT_DIR, "--verify", "/tmp/no-such-cbom.json"])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/cannot read CBOM/)
  })

  it("exit 2 if the CBOM file is malformed JSON", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "phub-cbom-bad-"))
    const bad = join(tmp, "bad.json")
    writeFileSync(bad, "not json {", "utf8")
    const code = await main(["cbom", tmp, "--verify", bad])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/invalid CBOM/)
  })

  it("exit 2 if the CBOM is the wrong format", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "phub-cbom-fmt-"))
    const bad = join(tmp, "wrong.json")
    writeFileSync(bad, JSON.stringify({ cbomFormat: "spdx" }), "utf8")
    const code = await main(["cbom", tmp, "--verify", bad])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/cbomFormat/)
  })

  it("--verify + --format is rejected (mutually exclusive)", async () => {
    const code = await main([
      "cbom",
      FIXTURE_INPUT_DIR,
      "--verify",
      FIXTURE_CBOM_PATH,
      "--format=spdx",
    ])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/mutually exclusive/)
  })

  it("--verify + --output is rejected (mutually exclusive)", async () => {
    const code = await main([
      "cbom",
      FIXTURE_INPUT_DIR,
      "--verify",
      FIXTURE_CBOM_PATH,
      "--output",
      "/tmp/wont-write.json",
    ])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/mutually exclusive/)
  })

  it("--help mentions --verify", async () => {
    const code = await main(["cbom", "--help"])
    expect(code).toBe(0)
    expect(captured.stdout).toMatch(/--verify <cbom-path>/)
  })
})
