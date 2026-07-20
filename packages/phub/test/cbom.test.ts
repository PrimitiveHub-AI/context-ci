/**
 * CBOM v0.1 producer tests (ADR-0033).
 *
 * Structural — exercises buildCbom() and the CLI surface.
 * Conformance-vs-fixture parity lives in cbom-conformance.test.ts.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { main } from "../src/cli.js"
import {
  buildCbom,
  serializeCbom,
  CBOM_FORMAT,
  CBOM_VERSION,
  CBOM_SCHEMA_URL,
  CBOM_TOP_TEN_DETECTOR_COUNT,
  CBOM_TOP_TEN_SPEC_VERSION,
} from "../src/commands/cbom.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function buildMinimalWorkspace(): string {
  const tmp = mkdtempSync(join(tmpdir(), "phub-cbom-"))
  writeFileSync(join(tmp, "AGENTS.md"), "# AGENTS\nsmoke\n", "utf8")
  writeFileSync(join(tmp, "CLAUDE.md"), "# CLAUDE\nsmoke\n", "utf8")
  const primDir = join(tmp, "apps/web/content/primitives")
  mkdirSync(primDir, { recursive: true })
  writeFileSync(
    join(primDir, "p1.md"),
    "---\nname: p1\nversion: 1.2.3\n---\n\nbody\n",
    "utf8",
  )
  return tmp
}

describe("buildCbom — structural shape", () => {
  it("emits cbomFormat + cbomVersion + $schema constants", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    expect(cbom.cbomFormat).toBe(CBOM_FORMAT)
    expect(cbom.cbomVersion).toBe(CBOM_VERSION)
    expect(cbom.$schema).toBe(CBOM_SCHEMA_URL)
  })

  it("emits tool.name=phub + version", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    expect(cbom.tool.name).toBe("phub")
    expect(cbom.tool.version).toBe("0.1.0")
  })

  it("subject.root is always relative '.'  (no host-absolute path)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    expect(cbom.subject.root).toBe(".")
  })

  it("subject.name is present iff subjectName option is passed", () => {
    const ws = buildMinimalWorkspace()
    const a = buildCbom(ws)
    expect(a.subject.name).toBeUndefined()
    const b = buildCbom(ws, { subjectName: "demo" })
    expect(b.subject.name).toBe("demo")
  })

  it("topTen pointer reflects the v0.1 spec + 10 shipped detectors", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    expect(cbom.topTen.specVersion).toBe(CBOM_TOP_TEN_SPEC_VERSION)
    expect(cbom.topTen.detectorCount).toBe(CBOM_TOP_TEN_DETECTOR_COUNT)
  })
})

describe("buildCbom — components", () => {
  it("classifies AGENTS.md, CLAUDE.md, and a primitive", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const byPath = new Map(cbom.components.map((c) => [c.path, c]))
    expect(byPath.get("AGENTS.md")?.classification).toBe("agents-md")
    expect(byPath.get("CLAUDE.md")?.classification).toBe("claude-md")
    expect(
      byPath.get("apps/web/content/primitives/p1.md")?.classification,
    ).toBe("primitive")
  })

  it("computes sha256: hex digest of the file bytes", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    for (const c of cbom.components) {
      expect(c.contentDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it("computes sizeBytes equal to fs file length", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const agents = cbom.components.find((c) => c.path === "AGENTS.md")!
    expect(agents.sizeBytes).toBe(readFileSync(join(ws, "AGENTS.md")).byteLength)
  })

  it("parses frontmatter name + version into optional fields", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const p = cbom.components.find(
      (c) => c.path === "apps/web/content/primitives/p1.md",
    )!
    expect(p.displayName).toBe("p1")
    expect(p.primitiveVersion).toBe("1.2.3")
  })

  it("does not emit displayName / primitiveVersion when frontmatter is absent", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const a = cbom.components.find((c) => c.path === "AGENTS.md")!
    expect(a.displayName).toBeUndefined()
    expect(a.primitiveVersion).toBeUndefined()
  })

  it("components are sorted lexicographically by path", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const paths = cbom.components.map((c) => c.path)
    const sorted = [...paths].sort()
    expect(paths).toEqual(sorted)
  })

  it("every component starts unattested when no lock exists", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    for (const c of cbom.components) {
      expect(c.attestation).toBe("unattested")
    }
  })

  it("attestation copies from phub.lock when present", () => {
    const ws = buildMinimalWorkspace()
    // Compute the actual digest of AGENTS.md so the lock matches.
    const agentsContent = readFileSync(join(ws, "AGENTS.md"))
    // Synthesize a minimal lock with one entry; only the path needs to match.
    const lock = {
      $schema: "https://primitivehub.ai/phub-lock/v0.1.json",
      artifacts: [
        {
          attestation: "registry:demo-pkg@1.0.0",
          classification: "agents-md",
          digest: "sha256:" + "0".repeat(64),
          path: "AGENTS.md",
        },
      ],
      generator: "phub@0.1.0",
      root: ".",
      top10_version: "0.1",
      version: "0.1",
    }
    const lockDir = join(ws, ".primitivehub")
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(join(lockDir, "phub.lock"), JSON.stringify(lock), "utf8")
    // Sanity: the test relies on the file content existing.
    expect(agentsContent.byteLength).toBeGreaterThan(0)

    const cbom = buildCbom(ws)
    const a = cbom.components.find((c) => c.path === "AGENTS.md")!
    expect(a.attestation).toBe("registry:demo-pkg@1.0.0")
    // Unlocked entries remain unattested.
    const c = cbom.components.find((cmp) => cmp.path === "CLAUDE.md")!
    expect(c.attestation).toBe("unattested")
  })
})

describe("buildCbom — summary", () => {
  it("componentCount + byClassification + totalBytes + attestationStates aggregate correctly", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    expect(cbom.summary.componentCount).toBe(cbom.components.length)
    expect(cbom.summary.componentCount).toBe(3)
    expect(cbom.summary.byClassification["agents-md"]).toBe(1)
    expect(cbom.summary.byClassification["claude-md"]).toBe(1)
    expect(cbom.summary.byClassification["primitive"]).toBe(1)
    expect(cbom.summary.attestationStates["unattested"]).toBe(3)
    const sumOfSizes = cbom.components.reduce((s, c) => s + c.sizeBytes, 0)
    expect(cbom.summary.totalBytes).toBe(sumOfSizes)
  })
})

describe("serializeCbom — canonical JSON discipline", () => {
  it("keys are sorted alphabetically at every depth", () => {
    const ws = buildMinimalWorkspace()
    const serialized = serializeCbom(buildCbom(ws))
    // Top-level: $schema appears before cbomFormat lexicographically.
    const idxSchema = serialized.indexOf('"$schema"')
    const idxFormat = serialized.indexOf('"cbomFormat"')
    expect(idxSchema).toBeGreaterThanOrEqual(0)
    expect(idxSchema).toBeLessThan(idxFormat)
    // Components: attestation < classification < contentDigest < path < sizeBytes.
    const firstComponentBlock = serialized.match(
      /"components": \[\s*\{[\s\S]*?\}/,
    )?.[0]
    expect(firstComponentBlock).toBeDefined()
    const c = firstComponentBlock!
    expect(c.indexOf('"attestation"')).toBeLessThan(c.indexOf('"classification"'))
    expect(c.indexOf('"classification"')).toBeLessThan(c.indexOf('"contentDigest"'))
    expect(c.indexOf('"contentDigest"')).toBeLessThan(c.indexOf('"path"'))
    expect(c.indexOf('"path"')).toBeLessThan(c.indexOf('"sizeBytes"'))
  })

  it("trailing newline; 2-space indent", () => {
    const ws = buildMinimalWorkspace()
    const s = serializeCbom(buildCbom(ws))
    expect(s.endsWith("\n")).toBe(true)
    // The second line of the document should start with two spaces (indented key).
    const secondLine = s.split("\n")[1]!
    expect(secondLine.startsWith("  ")).toBe(true)
  })

  it("re-stamping the same workspace yields byte-identical output (reproducibility)", () => {
    const ws = buildMinimalWorkspace()
    const a = serializeCbom(buildCbom(ws))
    const b = serializeCbom(buildCbom(ws))
    expect(a).toBe(b)
  })

  it("no timestamps anywhere in the document body", () => {
    const ws = buildMinimalWorkspace()
    const s = serializeCbom(buildCbom(ws))
    // The CBOM must NOT contain a generatedAt-style field.
    expect(s).not.toMatch(/generatedAt/i)
    expect(s).not.toMatch(/"timestamp"/i)
  })
})

describe("phub cbom CLI", () => {
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

  it("exit 0 + emits CBOM JSON on stdout", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws])
    expect(code).toBe(0)
    const parsed = JSON.parse(captured.stdout)
    expect(parsed.cbomFormat).toBe(CBOM_FORMAT)
    expect(parsed.cbomVersion).toBe(CBOM_VERSION)
    expect(Array.isArray(parsed.components)).toBe(true)
    expect(parsed.components.length).toBe(3)
  })

  it("--output writes to file and emits nothing to stdout", async () => {
    const ws = buildMinimalWorkspace()
    const out = join(ws, "out.json")
    const code = await main(["cbom", ws, "--output", out])
    expect(code).toBe(0)
    expect(captured.stdout.length).toBe(0)
    expect(existsSync(out)).toBe(true)
    const parsed = JSON.parse(readFileSync(out, "utf8"))
    expect(parsed.cbomFormat).toBe(CBOM_FORMAT)
  })

  it("--subject-name populates subject.name", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--subject-name", "my-project"])
    expect(code).toBe(0)
    const parsed = JSON.parse(captured.stdout)
    expect(parsed.subject.name).toBe("my-project")
  })

  it("--help prints the cbom help section", async () => {
    const code = await main(["cbom", "--help"])
    expect(code).toBe(0)
    expect(captured.stdout).toMatch(/phub cbom \[<path>\]/)
    expect(captured.stdout).toMatch(/ADR-0033/)
  })

  it("exit 2 on invalid lock under --lock-path", async () => {
    const ws = buildMinimalWorkspace()
    const badLock = join(ws, "bad.lock")
    writeFileSync(badLock, "this is not json {", "utf8")
    const code = await main(["cbom", ws, "--lock-path", badLock])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/invalid lock/)
  })

  it("exit 2 on invalid --max-files", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--max-files=0"])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/positive integer/)
  })

  it("emits a CBOM with zero components against an empty workspace", async () => {
    const empty = mkdtempSync(join(tmpdir(), "phub-cbom-empty-"))
    const code = await main(["cbom", empty])
    expect(code).toBe(0)
    const parsed = JSON.parse(captured.stdout)
    expect(parsed.components).toEqual([])
    expect(parsed.summary.componentCount).toBe(0)
    expect(parsed.summary.totalBytes).toBe(0)
  })
})

describe("phub top-level help references cbom", () => {
  let captured: { stdout: string }
  let restore: () => void
  beforeEach(() => {
    const orig = process.stdout.write.bind(process.stdout)
    captured = { stdout: "" }
    process.stdout.write = ((chunk: string | Uint8Array) => {
      captured.stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
      return true
    }) as typeof process.stdout.write
    restore = () => { process.stdout.write = orig }
  })
  afterEach(() => restore())

  it("lists 'cbom' as a subcommand", async () => {
    const code = await main([])
    expect(code).toBe(0)
    expect(captured.stdout).toMatch(/cbom \[path\]/)
  })
})

// Defensively silence "unused import" if test runner trims.
void __dirname
