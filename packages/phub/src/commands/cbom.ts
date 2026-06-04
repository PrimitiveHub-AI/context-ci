/**
 * `phub cbom` — Context Bill of Materials producer (ADR-0033).
 *
 * The third pillar of the Trust Runtime (alongside Trust Contract +
 * Top 10). Emits the v0.1 CBOM wire format defined in
 * `docs/cbom-v0.1.md`.
 *
 * The command reuses the existing classifier + digest + walker
 * kernel (single source of truth for "what counts as a context
 * artifact"). It does NOT run the scanner roster — CBOM is an
 * inventory artifact, separate from the audit verdict surface.
 *
 * Reproducibility is load-bearing: re-running against an unchanged
 * workspace produces a byte-identical document. See § 5 of the spec.
 */

import { readFileSync, lstatSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, relative, sep, join, isAbsolute, dirname } from "node:path"

import { buildCycloneDxBom, serializeCycloneDxBom } from "../cbom/cyclonedx.js"
import { buildSpdxDocument, serializeSpdx } from "../cbom/spdx.js"
import { classify } from "../audit/classifier.js"
import { sha256Hex } from "../audit/digest.js"
import {
  LockParseError,
  readLock,
  type LockAttestation,
  type LockedArtifact,
  type PhubLock,
} from "../audit/lock.js"
import {
  walk,
  DEFAULT_WALK_OPTIONS,
  type WalkOptions,
} from "../audit/walker.js"

export const CBOM_FORMAT = "primitivehub-cbom"
export const CBOM_VERSION = "0.1"
export const CBOM_SCHEMA_URL = "https://primitivehub.ai/cbom/v0.1.json"
export const CBOM_TOOL_NAME = "phub"
export const CBOM_TOOL_VERSION = "0.1.0"
export const CBOM_TOP_TEN_SPEC_VERSION = "0.1"
export const CBOM_TOP_TEN_DETECTOR_COUNT = 10

const NORM = (p: string): string => p.split(sep).join("/")

const DEFAULT_LOCK_DIRNAME = ".primitivehub"
const DEFAULT_LOCK_FILENAME = "phub.lock"

export interface CbomComponent {
  attestation: LockAttestation
  classification: string
  contentDigest: string
  /** Human-readable name parsed from frontmatter, if present. */
  displayName?: string
  path: string
  /** Semver string parsed from frontmatter, if present. */
  primitiveVersion?: string
  sizeBytes: number
}

export interface CbomSummary {
  attestationStates: Record<string, number>
  byClassification: Record<string, number>
  componentCount: number
  totalBytes: number
}

export interface Cbom {
  $schema: string
  cbomFormat: string
  cbomVersion: string
  components: CbomComponent[]
  subject: {
    name?: string
    root: string
  }
  summary: CbomSummary
  tool: {
    name: string
    version: string
  }
  topTen: {
    detectorCount: number
    specVersion: string
  }
}

export interface CbomOptions {
  maxFiles?: number
  maxDepth?: number
  /** Override the auto-discovered phub.lock for attestation cross-referencing. */
  lockPath?: string
  /** Project name to populate `subject.name`. Undefined → omit. */
  subjectName?: string
}

/**
 * Parse minimal YAML frontmatter to extract `name:` and `version:`
 * fields. Deliberately handwritten — full YAML support pulls a runtime
 * dep we don't need for two scalar fields.
 *
 * Conservative rules: opening `---` on line 1, closing `---` later, no
 * nested structures, no quoted-key edge cases. If the file doesn't
 * conform, both fields return undefined and the component lacks
 * displayName / primitiveVersion. That's the correct fallback.
 */
function parseFrontmatterNameAndVersion(content: string): {
  name?: string
  version?: string
} {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return {}
  }
  // Find the closing delimiter on its own line.
  const after = content.slice(content.indexOf("\n") + 1)
  const closeIdx = after.search(/^---\s*$/m)
  if (closeIdx < 0) return {}
  const block = after.slice(0, closeIdx)

  const out: { name?: string; version?: string } = {}
  for (const line of block.split(/\r?\n/)) {
    const m = /^(name|version):\s*(.*?)\s*$/.exec(line)
    if (m === null) continue
    const [, key, rawValue] = m
    if (rawValue === undefined) continue
    // Strip optional surrounding quotes.
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim()
    if (value.length === 0) continue
    if (key === "name") out.name = value
    else if (key === "version") out.version = value
  }
  return out
}

function defaultLockPath(rootDir: string): string {
  return join(rootDir, DEFAULT_LOCK_DIRNAME, DEFAULT_LOCK_FILENAME)
}

function resolveLockPath(rootDir: string, override: string | undefined): string {
  if (override === undefined) return defaultLockPath(rootDir)
  return isAbsolute(override) ? override : resolve(rootDir, override)
}

function loadLockAttestations(lockPath: string): Map<string, LockAttestation> {
  if (!existsSync(lockPath)) return new Map()
  const lock: PhubLock = readLock(lockPath)
  return new Map(lock.artifacts.map((a: LockedArtifact) => [a.path, a.attestation]))
}

/**
 * Build the CBOM JSON in memory. Pure function over (workspace,
 * options) — exposed for in-process consumers and tests.
 */
export function buildCbom(rootArg: string, opts: CbomOptions = {}): Cbom {
  const root = resolve(rootArg)
  const rootIsFile = (() => {
    try {
      return lstatSync(root).isFile()
    } catch {
      return false
    }
  })()
  const rootDir = rootIsFile ? resolve(root, "..") : root

  const walkOpts: WalkOptions = {
    maxDepth: opts.maxDepth ?? DEFAULT_WALK_OPTIONS.maxDepth,
    maxFiles: opts.maxFiles ?? DEFAULT_WALK_OPTIONS.maxFiles,
  }
  const walked = walk(root, walkOpts)

  const lockPath = resolveLockPath(rootDir, opts.lockPath)
  const lockAttestations = loadLockAttestations(lockPath)

  const components: CbomComponent[] = []
  for (const abs of walked.files) {
    const rel = rootIsFile ? NORM(abs).split("/").pop() ?? abs : NORM(relative(root, abs))
    if (rel.length === 0) continue
    const cls = classify(rel)
    if (cls === null) continue

    let buf: Buffer
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }
    const sizeBytes = buf.byteLength
    const digestHex = sha256Hex(buf)
    const contentDigest = `sha256:${digestHex}`
    const attestation: LockAttestation =
      lockAttestations.get(rel) ?? "unattested"

    const frontmatter = parseFrontmatterNameAndVersion(buf.toString("utf8"))

    const component: CbomComponent = {
      attestation,
      classification: cls,
      contentDigest,
      path: rel,
      sizeBytes,
    }
    if (frontmatter.name !== undefined) component.displayName = frontmatter.name
    if (frontmatter.version !== undefined) component.primitiveVersion = frontmatter.version

    components.push(component)
  }

  // Reproducibility: lexicographic sort by path.
  components.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const byClassification: Record<string, number> = {}
  const attestationStates: Record<string, number> = {}
  let totalBytes = 0
  for (const c of components) {
    byClassification[c.classification] = (byClassification[c.classification] ?? 0) + 1
    attestationStates[c.attestation] = (attestationStates[c.attestation] ?? 0) + 1
    totalBytes += c.sizeBytes
  }

  const subject: { name?: string; root: string } = { root: "." }
  if (opts.subjectName !== undefined) subject.name = opts.subjectName

  return {
    $schema: CBOM_SCHEMA_URL,
    cbomFormat: CBOM_FORMAT,
    cbomVersion: CBOM_VERSION,
    components,
    subject,
    summary: {
      attestationStates,
      byClassification,
      componentCount: components.length,
      totalBytes,
    },
    tool: {
      name: CBOM_TOOL_NAME,
      version: CBOM_TOOL_VERSION,
    },
    topTen: {
      detectorCount: CBOM_TOP_TEN_DETECTOR_COUNT,
      specVersion: CBOM_TOP_TEN_SPEC_VERSION,
    },
  }
}

/**
 * Serialize a `Cbom` to canonical JSON per § 2 / § 5 of the spec:
 * alphabetic keys, 2-space indent, trailing newline.
 */
export function serializeCbom(cbom: Cbom): string {
  return canonicalStringify(cbom) + "\n"
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

export type CbomOutputFormat = "cbom" | "spdx" | "cyclonedx"

export interface CbomCommandOptions extends CbomOptions {
  /** Write to this file instead of stdout. */
  output?: string
  /**
   * Output format. Default `"cbom"` is the canonical wire format
   * defined in `docs/cbom-v0.1.md`. `"spdx"` and `"cyclonedx"` are
   * lossy projections for SBOM tooling that already speaks those
   * formats (ADR-0033 § "Explicit deferrals — relaxed in PR 5.11"
   * + spec § 7). Both projections preserve the
   * byte-identical-re-stamp property — the URN / namespace fields
   * are derived from the SHA-256 of the native CBOM bytes.
   */
  format?: CbomOutputFormat
}

/**
 * Render a `Cbom` in the requested wire format. Pure function;
 * exposed for embedders that already hold a `Cbom` in memory.
 */
export function renderCbom(cbom: Cbom, format: CbomOutputFormat = "cbom"): string {
  const native = serializeCbom(cbom)
  if (format === "cbom") return native
  if (format === "spdx") {
    return serializeSpdx(buildSpdxDocument(cbom, native))
  }
  // format === "cyclonedx"
  return serializeCycloneDxBom(buildCycloneDxBom(cbom, native))
}

/** Top-level dispatch for `phub cbom`. Returns process exit code. */
export function cbomCommand(rootArg: string | undefined, opts: CbomCommandOptions): number {
  const target = rootArg ?? process.cwd()
  let cbom: Cbom
  try {
    cbom = buildCbom(target, opts)
  } catch (err) {
    if (err instanceof LockParseError) {
      process.stderr.write(`phub cbom: invalid lock at ${err.source}: ${err.message}\n`)
      return 2
    }
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub cbom: ${msg}\n`)
    return 2
  }

  const serialized = renderCbom(cbom, opts.format ?? "cbom")
  if (opts.output !== undefined) {
    try {
      mkdirSync(dirname(resolve(opts.output)), { recursive: true })
      writeFileSync(opts.output, serialized, { encoding: "utf8" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`phub cbom: cannot write CBOM: ${msg}\n`)
      return 2
    }
    return 0
  }
  process.stdout.write(serialized)
  return 0
}
