/**
 * CycloneDX 1.5 exporter for the CBOM.
 *
 * Maps the canonical `Cbom` to a CycloneDX 1.5 JSON document.
 * Native CBOM remains the source of truth; this is a lossy
 * projection for SBOM pipelines that already speak CycloneDX.
 *
 * Reproducibility — same property as the native CBOM. CycloneDX
 * has fewer required timestamps than SPDX (no `metadata.timestamp`
 * requirement at the top level), so the projection is simpler:
 *   - `serialNumber` is derived from the SHA-256 of the native
 *     CBOM bytes — same input → same URN.
 *   - No timestamps.
 *
 * Mapping rationale:
 *   - `component.type = "file"`. CycloneDX File components match
 *     the CBOM artifact model better than Library / Application
 *     (which carry package-level semantics we don't have).
 *   - `bom-ref` per component = `cbom:<sha256>` so consumers can
 *     reference components stably.
 *   - Classification + attestation: emitted as `properties` per
 *     component using namespaced names (CycloneDX recommends
 *     `<vendor>:<key>` for custom properties). The same metadata
 *     surface as the SPDX annotations.
 */

import { createHash } from "node:crypto"

import type { Cbom, CbomComponent } from "../commands/cbom.js"

export const CYCLONEDX_SPEC_VERSION = "1.5"
export const CYCLONEDX_BOM_FORMAT = "CycloneDX"

interface CycloneDxProperty {
  name: string
  value: string
}

interface CycloneDxHash {
  alg: "SHA-256"
  content: string
}

interface CycloneDxComponent {
  "bom-ref": string
  hashes: CycloneDxHash[]
  name: string
  properties: CycloneDxProperty[]
  type: "file"
  version?: string
}

export interface CycloneDxBom {
  $schema: string
  bomFormat: string
  components: CycloneDxComponent[]
  metadata: {
    component: {
      "bom-ref": string
      name: string
      type: "application"
    }
    properties: CycloneDxProperty[]
    tools: Array<{ name: string; vendor: string; version: string }>
  }
  serialNumber: string
  specVersion: string
  version: number
}

function deriveSerialNumber(canonicalCbomBytes: string): string {
  const digest = createHash("sha256").update(canonicalCbomBytes).digest("hex")
  return `urn:cbom:${digest.slice(0, 32)}`
}

function componentToCdx(c: CbomComponent): CycloneDxComponent {
  const hex = c.contentDigest.replace(/^sha256:/, "")
  const properties: CycloneDxProperty[] = [
    { name: "cbom:classification", value: c.classification },
    { name: "cbom:attestation", value: c.attestation },
    { name: "cbom:sizeBytes", value: String(c.sizeBytes) },
  ]
  if (c.displayName !== undefined) {
    properties.push({ name: "cbom:displayName", value: c.displayName })
  }
  const out: CycloneDxComponent = {
    "bom-ref": `cbom:${hex}`,
    hashes: [{ alg: "SHA-256", content: hex }],
    name: c.path,
    properties,
    type: "file",
  }
  if (c.primitiveVersion !== undefined) out.version = c.primitiveVersion
  return out
}

export function buildCycloneDxBom(cbom: Cbom, canonicalCbomBytes: string): CycloneDxBom {
  const subjectName = cbom.subject.name ?? "unnamed-workspace"
  return {
    $schema: "http://cyclonedx.org/schema/bom-1.5.schema.json",
    bomFormat: CYCLONEDX_BOM_FORMAT,
    components: cbom.components.map(componentToCdx),
    metadata: {
      component: {
        "bom-ref": `urn:cbom:subject:${subjectName}`,
        name: subjectName,
        type: "application",
      },
      properties: [
        { name: "cbom:specVersion", value: cbom.cbomVersion },
        { name: "cbom:topTen:specVersion", value: cbom.topTen.specVersion },
        {
          name: "cbom:topTen:detectorCount",
          value: String(cbom.topTen.detectorCount),
        },
      ],
      tools: [
        {
          name: cbom.tool.name,
          vendor: "PrimitiveHub",
          version: cbom.tool.version,
        },
      ],
    },
    serialNumber: deriveSerialNumber(canonicalCbomBytes),
    specVersion: CYCLONEDX_SPEC_VERSION,
    version: 1,
  }
}

export function serializeCycloneDxBom(doc: CycloneDxBom): string {
  return canonicalStringify(doc) + "\n"
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2)
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortKeys((value as Record<string, unknown>)[key])
  }
  return out
}
