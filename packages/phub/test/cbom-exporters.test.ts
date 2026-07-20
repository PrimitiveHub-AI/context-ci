/**
 * SPDX 2.3 + CycloneDX 1.5 exporter tests.
 *
 * Structural — exercises buildSpdxDocument / buildCycloneDxBom +
 * the renderCbom dispatch + the CLI --format flag. Conformance
 * vs the expected fixtures lives in cbom-conformance.test.ts.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { main } from "../src/cli.js"
import {
  buildCbom,
  renderCbom,
  serializeCbom,
} from "../src/commands/cbom.js"
import {
  buildSpdxDocument,
  serializeSpdx,
  SPDX_DATA_LICENSE,
  SPDX_VERSION,
} from "../src/cbom/spdx.js"
import {
  buildCycloneDxBom,
  serializeCycloneDxBom,
  CYCLONEDX_BOM_FORMAT,
  CYCLONEDX_SPEC_VERSION,
} from "../src/cbom/cyclonedx.js"

function buildMinimalWorkspace(): string {
  const tmp = mkdtempSync(join(tmpdir(), "phub-cbom-exp-"))
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

describe("buildSpdxDocument — structural shape", () => {
  it("declares SPDX-2.3 + CC0-1.0 dataLicense + SPDXRef-DOCUMENT root", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.spdxVersion).toBe(SPDX_VERSION)
    expect(doc.spdxVersion).toBe("SPDX-2.3")
    expect(doc.dataLicense).toBe(SPDX_DATA_LICENSE)
    expect(doc.SPDXID).toBe("SPDXRef-DOCUMENT")
  })

  it("creator includes the phub tool + version", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.creationInfo.creators).toContain("Tool: phub-0.1.0")
  })

  it("name defaults to 'unnamed-workspace' when subject.name omitted", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.name).toBe("unnamed-workspace")
  })

  it("emits one File per component with SHA256 checksum + NOASSERTION license", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.files.length).toBe(cbom.components.length)
    for (const f of doc.files) {
      expect(f.checksums[0]!.algorithm).toBe("SHA256")
      expect(f.checksums[0]!.checksumValue).toMatch(/^[0-9a-f]{64}$/)
      expect(f.licenseConcluded).toBe("NOASSERTION")
      expect(f.copyrightText).toBe("NOASSERTION")
      expect(f.SPDXID).toMatch(/^SPDXRef-File-[a-zA-Z0-9.-]+$/)
    }
  })

  it("documentNamespace is derived from canonical CBOM bytes (deterministic)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bytes = serializeCbom(cbom)
    const a = buildSpdxDocument(cbom, bytes)
    const b = buildSpdxDocument(cbom, bytes)
    expect(a.documentNamespace).toBe(b.documentNamespace)
    expect(a.documentNamespace).toMatch(/^https:\/\/primitivehub\.ai\/cbom\/demo#[0-9a-f]{32}$/)
  })

  it("annotations carry classification + attestation as cbom: properties", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    const primitiveFile = doc.files.find((f) =>
      f.fileName.endsWith("/apps/web/content/primitives/p1.md"),
    )!
    const comments = primitiveFile.annotations!.map((a) => a.comment)
    expect(comments).toContain("cbom:classification=primitive")
    expect(comments).toContain("cbom:attestation=unattested")
    expect(comments).toContain("cbom:displayName=p1")
    expect(comments).toContain("cbom:primitiveVersion=1.2.3")
  })

  it("annotation timestamps are the stable epoch-zero marker (reproducibility)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.creationInfo.created).toBe("1970-01-01T00:00:00Z")
    for (const f of doc.files) {
      for (const a of f.annotations!) {
        expect(a.annotationDate).toBe("1970-01-01T00:00:00Z")
      }
    }
  })

  it("documentDescribes lists every file SPDXID", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const doc = buildSpdxDocument(cbom, serializeCbom(cbom))
    expect(doc.documentDescribes.sort()).toEqual(
      doc.files.map((f) => f.SPDXID).sort(),
    )
  })
})

describe("buildCycloneDxBom — structural shape", () => {
  it("declares CycloneDX 1.5 + version 1 + JSON schema URL", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    expect(bom.bomFormat).toBe(CYCLONEDX_BOM_FORMAT)
    expect(bom.specVersion).toBe(CYCLONEDX_SPEC_VERSION)
    expect(bom.specVersion).toBe("1.5")
    expect(bom.version).toBe(1)
    expect(bom.$schema).toBe("http://cyclonedx.org/schema/bom-1.5.schema.json")
  })

  it("metadata.component.type is 'application'", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "my-app" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    expect(bom.metadata.component.type).toBe("application")
    expect(bom.metadata.component.name).toBe("my-app")
  })

  it("metadata.tools includes phub + PrimitiveHub vendor", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws)
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    expect(bom.metadata.tools).toEqual([
      { name: "phub", vendor: "PrimitiveHub", version: "0.1.0" },
    ])
  })

  it("emits one File component per CBOM component with SHA-256 hash", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    expect(bom.components.length).toBe(cbom.components.length)
    for (const c of bom.components) {
      expect(c.type).toBe("file")
      expect(c.hashes[0]!.alg).toBe("SHA-256")
      expect(c.hashes[0]!.content).toMatch(/^[0-9a-f]{64}$/)
      expect(c["bom-ref"]).toMatch(/^cbom:[0-9a-f]{64}$/)
    }
  })

  it("properties carry cbom:classification + cbom:attestation + cbom:sizeBytes", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    const agents = bom.components.find((c) => c.name === "AGENTS.md")!
    const names = agents.properties.map((p) => p.name)
    expect(names).toContain("cbom:classification")
    expect(names).toContain("cbom:attestation")
    expect(names).toContain("cbom:sizeBytes")
  })

  it("component.version is populated from primitiveVersion when present", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    const prim = bom.components.find(
      (c) => c.name === "apps/web/content/primitives/p1.md",
    )!
    expect(prim.version).toBe("1.2.3")
    const agents = bom.components.find((c) => c.name === "AGENTS.md")!
    expect(agents.version).toBeUndefined()
  })

  it("serialNumber is derived from canonical CBOM bytes (deterministic)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bytes = serializeCbom(cbom)
    const a = buildCycloneDxBom(cbom, bytes)
    const b = buildCycloneDxBom(cbom, bytes)
    expect(a.serialNumber).toBe(b.serialNumber)
    expect(a.serialNumber).toMatch(/^urn:cbom:[0-9a-f]{32}$/)
  })

  it("metadata.properties carry the cbom + topTen pointers", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const bom = buildCycloneDxBom(cbom, serializeCbom(cbom))
    const props = Object.fromEntries(bom.metadata.properties.map((p) => [p.name, p.value]))
    expect(props["cbom:specVersion"]).toBe("0.1")
    expect(props["cbom:topTen:specVersion"]).toBe("0.1")
    expect(props["cbom:topTen:detectorCount"]).toBe("10")
  })
})

describe("renderCbom — format dispatch", () => {
  it("default format is 'cbom'", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const native = renderCbom(cbom)
    const withDefault = renderCbom(cbom, "cbom")
    expect(native).toBe(withDefault)
    expect(JSON.parse(native).cbomFormat).toBe("primitivehub-cbom")
  })

  it("'spdx' yields SPDX 2.3 JSON", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const text = renderCbom(cbom, "spdx")
    const doc = JSON.parse(text)
    expect(doc.spdxVersion).toBe("SPDX-2.3")
  })

  it("'cyclonedx' yields CycloneDX 1.5 JSON", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const text = renderCbom(cbom, "cyclonedx")
    const doc = JSON.parse(text)
    expect(doc.bomFormat).toBe("CycloneDX")
    expect(doc.specVersion).toBe("1.5")
  })

  it("all three formats are byte-identical across re-renders (reproducibility)", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    for (const fmt of ["cbom", "spdx", "cyclonedx"] as const) {
      const a = renderCbom(cbom, fmt)
      const b = renderCbom(cbom, fmt)
      expect(a).toBe(b)
    }
  })
})

describe("serializeSpdx / serializeCycloneDxBom — canonical JSON", () => {
  it("SPDX: alphabetic keys + 2-space indent + trailing newline", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const text = serializeSpdx(buildSpdxDocument(cbom, serializeCbom(cbom)))
    expect(text.endsWith("\n")).toBe(true)
    expect(text.split("\n")[1]!.startsWith("  ")).toBe(true)
    // SPDXID < creationInfo lexicographically at the root.
    expect(text.indexOf('"SPDXID"')).toBeLessThan(text.indexOf('"creationInfo"'))
  })

  it("CycloneDX: alphabetic keys + 2-space indent + trailing newline", () => {
    const ws = buildMinimalWorkspace()
    const cbom = buildCbom(ws, { subjectName: "demo" })
    const text = serializeCycloneDxBom(buildCycloneDxBom(cbom, serializeCbom(cbom)))
    expect(text.endsWith("\n")).toBe(true)
    expect(text.split("\n")[1]!.startsWith("  ")).toBe(true)
    // $schema < bomFormat lexicographically at the root.
    expect(text.indexOf('"$schema"')).toBeLessThan(text.indexOf('"bomFormat"'))
  })
})

describe("phub cbom --format CLI", () => {
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

  it("--format=spdx emits SPDX on stdout (exit 0)", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--format=spdx"])
    expect(code).toBe(0)
    const doc = JSON.parse(captured.stdout)
    expect(doc.spdxVersion).toBe("SPDX-2.3")
  })

  it("--format=cyclonedx emits CycloneDX on stdout (exit 0)", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--format=cyclonedx"])
    expect(code).toBe(0)
    const doc = JSON.parse(captured.stdout)
    expect(doc.bomFormat).toBe("CycloneDX")
  })

  it("--format=cbom is identical to no --format (default)", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--format=cbom"])
    expect(code).toBe(0)
    const doc = JSON.parse(captured.stdout)
    expect(doc.cbomFormat).toBe("primitivehub-cbom")
  })

  it("--format=spdx with --output writes to file", async () => {
    const ws = buildMinimalWorkspace()
    const out = join(ws, "out.spdx.json")
    const code = await main(["cbom", ws, "--format=spdx", "--output", out])
    expect(code).toBe(0)
    expect(captured.stdout.length).toBe(0)
    const doc = JSON.parse(readFileSync(out, "utf8"))
    expect(doc.spdxVersion).toBe("SPDX-2.3")
  })

  it("--format=invalid exits 2 with explanatory stderr", async () => {
    const ws = buildMinimalWorkspace()
    const code = await main(["cbom", ws, "--format=invalid"])
    expect(code).toBe(2)
    expect(captured.stderr).toMatch(/--format must be one of cbom\|spdx\|cyclonedx/)
  })

  it("--help mentions all three formats", async () => {
    const code = await main(["cbom", "--help"])
    expect(code).toBe(0)
    expect(captured.stdout).toMatch(/--format <fmt>/)
    expect(captured.stdout).toMatch(/spdx\s+SPDX 2.3/)
    expect(captured.stdout).toMatch(/cyclonedx\s+CycloneDX 1.5/)
  })
})
