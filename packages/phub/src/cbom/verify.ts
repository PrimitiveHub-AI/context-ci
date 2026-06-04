/**
 * CBOM verification (spec § 8).
 *
 * Consumer side: given a CBOM JSON document and a workspace, walk
 * the workspace using the same classifier + digest kernel the
 * producer uses, then diff the two component lists. Emit a typed
 * `CbomVerification` so the CLI + embedders can render or act on
 * it uniformly.
 *
 * Drift dimensions:
 *   added        — paths in the workspace that the CBOM doesn't list
 *   removed      — paths the CBOM lists that the workspace doesn't have
 *   modified     — paths present in both with different content digests
 *   reclassified — paths present in both with different classifications
 *
 * Symmetry with `phub.lock` drift (ADR-0026): the four dimensions
 * are the same, intentionally, so consumers internalize one drift
 * vocabulary across both surfaces.
 */

import { buildCbom, type Cbom, type CbomComponent } from "../commands/cbom.js"

export class CbomParseError extends Error {
  constructor(
    message: string,
    readonly source: string,
  ) {
    super(message)
    this.name = "CbomParseError"
  }
}

export interface CbomDriftAdded {
  path: string
  classification: string
  contentDigest: string
}

export interface CbomDriftRemoved {
  path: string
  classification: string
  contentDigest: string
}

export interface CbomDriftModified {
  path: string
  fromDigest: string
  toDigest: string
}

export interface CbomDriftReclassified {
  path: string
  fromClassification: string
  toClassification: string
}

export interface CbomDrift {
  added: CbomDriftAdded[]
  removed: CbomDriftRemoved[]
  modified: CbomDriftModified[]
  reclassified: CbomDriftReclassified[]
}

export interface CbomVerification {
  /** Absolute workspace root that was walked. */
  workspaceRoot: string
  /** Path to the CBOM JSON that was parsed. */
  cbomPath: string
  drift: CbomDrift
  hasDrift: boolean
  /** True iff the parsed CBOM declares cbomFormat = "primitivehub-cbom" + cbomVersion = "0.1". */
  formatMatch: boolean
  /** Parsed CBOM (returned for downstream rendering). */
  cbom: Cbom
}

/**
 * Parse a CBOM JSON string. Conservative — checks `cbomFormat` +
 * `cbomVersion` + that `components` is an array. Full structural
 * validation is the JSON schema's job (docs/cbom/schema.json).
 */
export function parseCbom(content: string, source: string): Cbom {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new CbomParseError(`invalid JSON: ${msg}`, source)
  }
  if (raw === null || typeof raw !== "object") {
    throw new CbomParseError("CBOM must be a JSON object", source)
  }
  const obj = raw as Record<string, unknown>
  if (obj["cbomFormat"] !== "primitivehub-cbom") {
    throw new CbomParseError(
      `unexpected cbomFormat (expected "primitivehub-cbom", got ${JSON.stringify(obj["cbomFormat"])})`,
      source,
    )
  }
  if (obj["cbomVersion"] !== "0.1") {
    throw new CbomParseError(
      `unexpected cbomVersion (this CLI understands "0.1", got ${JSON.stringify(obj["cbomVersion"])})`,
      source,
    )
  }
  if (!Array.isArray(obj["components"])) {
    throw new CbomParseError("missing or non-array `components`", source)
  }
  // Trust the rest. The schema does the heavy lifting.
  return raw as Cbom
}

/**
 * Diff a stored CBOM against the current workspace.
 *
 * Mirrors the shape of `diffLock` in audit/lock.ts so the two
 * drift artifacts can be rendered with shared formatting.
 */
export function diffCbomVsWorkspace(stored: Cbom, walked: Cbom): CbomDrift {
  const byPathStored = new Map(stored.components.map((c) => [c.path, c]))
  const byPathWalked = new Map(walked.components.map((c) => [c.path, c]))

  const added: CbomDriftAdded[] = []
  const removed: CbomDriftRemoved[] = []
  const modified: CbomDriftModified[] = []
  const reclassified: CbomDriftReclassified[] = []

  for (const [path, w] of byPathWalked) {
    const s = byPathStored.get(path)
    if (s === undefined) {
      added.push({
        path,
        classification: w.classification,
        contentDigest: w.contentDigest,
      })
      continue
    }
    if (s.contentDigest !== w.contentDigest) {
      modified.push({
        path,
        fromDigest: s.contentDigest,
        toDigest: w.contentDigest,
      })
    }
    if (s.classification !== w.classification) {
      reclassified.push({
        path,
        fromClassification: s.classification,
        toClassification: w.classification,
      })
    }
  }
  for (const [path, s] of byPathStored) {
    if (!byPathWalked.has(path)) {
      removed.push({
        path,
        classification: s.classification,
        contentDigest: s.contentDigest,
      })
    }
  }

  added.sort((a, b) => (a.path < b.path ? -1 : 1))
  removed.sort((a, b) => (a.path < b.path ? -1 : 1))
  modified.sort((a, b) => (a.path < b.path ? -1 : 1))
  reclassified.sort((a, b) => (a.path < b.path ? -1 : 1))

  return { added, modified, reclassified, removed }
}

export function isCbomDrifted(drift: CbomDrift): boolean {
  return (
    drift.added.length > 0 ||
    drift.removed.length > 0 ||
    drift.modified.length > 0 ||
    drift.reclassified.length > 0
  )
}

export interface VerifyCbomOptions {
  workspaceRoot: string
  cbomPath: string
  cbomContent: string
  /** Optional pass-through to buildCbom for the workspace walk. */
  maxFiles?: number
  maxDepth?: number
}

/**
 * Verify a CBOM against the workspace.
 *
 * Walks the workspace, parses the supplied CBOM, diffs them.
 * Returns a typed verification result; throws `CbomParseError`
 * if the CBOM is malformed.
 */
export function verifyCbom(opts: VerifyCbomOptions): CbomVerification {
  const stored = parseCbom(opts.cbomContent, opts.cbomPath)
  const buildOpts: Parameters<typeof buildCbom>[1] = {}
  if (opts.maxFiles !== undefined) buildOpts.maxFiles = opts.maxFiles
  if (opts.maxDepth !== undefined) buildOpts.maxDepth = opts.maxDepth
  if (stored.subject.name !== undefined) {
    buildOpts.subjectName = stored.subject.name
  }
  const walked = buildCbom(opts.workspaceRoot, buildOpts)
  const drift = diffCbomVsWorkspace(stored, walked)
  return {
    workspaceRoot: opts.workspaceRoot,
    cbomPath: opts.cbomPath,
    drift,
    hasDrift: isCbomDrifted(drift),
    formatMatch: stored.cbomFormat === "primitivehub-cbom" && stored.cbomVersion === "0.1",
    cbom: stored,
  }
}

// Used in places where we treat all four columns as drift entries
// (e.g., a CLI summary line). Kept lowercase-singular for symmetry.
export function totalDriftCount(drift: CbomDrift): number {
  return (
    drift.added.length +
    drift.removed.length +
    drift.modified.length +
    drift.reclassified.length
  )
}

export type { Cbom, CbomComponent }
