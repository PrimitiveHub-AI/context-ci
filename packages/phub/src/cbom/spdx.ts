/**
 * SPDX 2.3 exporter for the CBOM.
 *
 * Maps the canonical `Cbom` to an SPDX 2.3 JSON document. Native
 * CBOM remains the source of truth; this is a lossy projection for
 * enterprise SBOM pipelines that already speak SPDX.
 *
 * Reproducibility — same property as the native CBOM: re-running
 * against an unchanged workspace yields a byte-identical document.
 *   - No timestamps in the body (`creationInfo.created` is a stable
 *     epoch-zero marker, not "now"; see § "Why the epoch-zero
 *     created timestamp" below).
 *   - DocumentNamespace is derived from the SHA-256 of the native
 *     CBOM JSON bytes — same input → same namespace.
 *   - SPDX IDs and file references are deterministic (path + digest).
 *
 * Mapping rationale:
 *   - SPDX `File` per component. The CBOM's content artifacts are
 *     individual files, not "packages" — File is the right SPDX
 *     primitive. Package vs File is the load-bearing modeling call
 *     in the SPDX-vs-CBOM impedance mismatch (see ADR-0033 §
 *     "Alternatives considered").
 *   - License: NOASSERTION across the board. We don't currently
 *     parse SPDX license expressions from primitive frontmatter;
 *     a future revision could lift the `license:` frontmatter field
 *     into `licenseConcluded`.
 *   - Classification + attestation: emitted as SPDX `annotations` on
 *     each file so consumers can recover the CBOM-native metadata.
 */

import { createHash } from "node:crypto"

import type { Cbom, CbomComponent } from "../commands/cbom.js"

export const SPDX_VERSION = "SPDX-2.3"
export const SPDX_DATA_LICENSE = "CC0-1.0"
const SPDX_NOASSERTION = "NOASSERTION"

/**
 * Why the epoch-zero `created` timestamp:
 *
 * SPDX 2.3 marks `creationInfo.created` as REQUIRED. We can't omit
 * the field. But emitting a real "now" timestamp would break the
 * byte-identical re-stamp property — and that property is the
 * load-bearing reproducibility guarantee documented in § 5 of
 * `docs/cbom-v0.1.md`. We pin the value to a constant marker
 * (1970-01-01T00:00:00Z) so consumers can distinguish a
 * reproducible CBOM export from a real-time SPDX document.
 *
 * Consumers that need a wall-clock timestamp can stamp one
 * externally — the projection is from the CBOM artifact, not the
 * generation event.
 */
const REPRODUCIBLE_CREATED_TIMESTAMP = "1970-01-01T00:00:00Z"

interface SpdxAnnotation {
  annotationDate: string
  annotationType: "OTHER"
  annotator: string
  comment: string
}

interface SpdxFile {
  SPDXID: string
  annotations?: SpdxAnnotation[]
  attributionTexts?: string[]
  checksums: Array<{ algorithm: "SHA256"; checksumValue: string }>
  copyrightText: string
  fileName: string
  licenseConcluded: string
  licenseInfoInFiles: string[]
}

export interface SpdxDocument {
  SPDXID: "SPDXRef-DOCUMENT"
  creationInfo: {
    created: string
    creators: string[]
  }
  dataLicense: string
  documentDescribes: string[]
  documentNamespace: string
  files: SpdxFile[]
  name: string
  spdxVersion: string
}

/** Derive a deterministic document namespace from the native CBOM bytes. */
function deriveNamespace(canonicalCbomBytes: string, subjectName: string): string {
  const digest = createHash("sha256").update(canonicalCbomBytes).digest("hex")
  return `https://primitivehub.ai/cbom/${subjectName}#${digest.slice(0, 32)}`
}

/**
 * SPDX requires SPDXIDs to match `^SPDXRef-[a-zA-Z0-9.-]+$`.
 * Forward slashes and other characters that appear in file paths
 * need to be replaced with dashes. We pre-compute and store the ID
 * so it's stable across formats.
 */
function fileSpdxId(component: CbomComponent): string {
  const safe = component.path.replace(/[^a-zA-Z0-9.-]/g, "-")
  return `SPDXRef-File-${safe}`
}

function fileAnnotations(c: CbomComponent): SpdxAnnotation[] {
  const ann: SpdxAnnotation[] = [
    {
      annotationDate: REPRODUCIBLE_CREATED_TIMESTAMP,
      annotationType: "OTHER",
      annotator: "Tool: phub-cbom-spdx-exporter",
      comment: `cbom:classification=${c.classification}`,
    },
    {
      annotationDate: REPRODUCIBLE_CREATED_TIMESTAMP,
      annotationType: "OTHER",
      annotator: "Tool: phub-cbom-spdx-exporter",
      comment: `cbom:attestation=${c.attestation}`,
    },
  ]
  if (c.displayName !== undefined) {
    ann.push({
      annotationDate: REPRODUCIBLE_CREATED_TIMESTAMP,
      annotationType: "OTHER",
      annotator: "Tool: phub-cbom-spdx-exporter",
      comment: `cbom:displayName=${c.displayName}`,
    })
  }
  if (c.primitiveVersion !== undefined) {
    ann.push({
      annotationDate: REPRODUCIBLE_CREATED_TIMESTAMP,
      annotationType: "OTHER",
      annotator: "Tool: phub-cbom-spdx-exporter",
      comment: `cbom:primitiveVersion=${c.primitiveVersion}`,
    })
  }
  return ann
}

function componentToFile(c: CbomComponent): SpdxFile {
  const hex = c.contentDigest.replace(/^sha256:/, "")
  return {
    SPDXID: fileSpdxId(c),
    annotations: fileAnnotations(c),
    checksums: [{ algorithm: "SHA256", checksumValue: hex }],
    copyrightText: SPDX_NOASSERTION,
    fileName: `./${c.path}`,
    licenseConcluded: SPDX_NOASSERTION,
    licenseInfoInFiles: [SPDX_NOASSERTION],
  }
}

/**
 * Build the SPDX 2.3 document from a CBOM.
 *
 * `canonicalCbomBytes` is the byte form of the native CBOM (the
 * output of `serializeCbom`). It's used to derive the
 * `documentNamespace` — passing the same CBOM in twice always
 * yields the same namespace, preserving reproducibility.
 */
export function buildSpdxDocument(cbom: Cbom, canonicalCbomBytes: string): SpdxDocument {
  const subjectName = cbom.subject.name ?? "unnamed-workspace"
  const files = cbom.components.map(componentToFile)
  return {
    SPDXID: "SPDXRef-DOCUMENT",
    creationInfo: {
      created: REPRODUCIBLE_CREATED_TIMESTAMP,
      creators: [`Tool: ${cbom.tool.name}-${cbom.tool.version}`],
    },
    dataLicense: SPDX_DATA_LICENSE,
    documentDescribes: files.map((f) => f.SPDXID),
    documentNamespace: deriveNamespace(canonicalCbomBytes, subjectName),
    files,
    name: subjectName,
    spdxVersion: SPDX_VERSION,
  }
}

export function serializeSpdx(doc: SpdxDocument): string {
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
