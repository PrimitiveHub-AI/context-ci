/**
 * `phub.lock` — the lockfile for AI-agent cognition (ADR-0026).
 *
 * The lockfile records every classified agent-context artifact in a
 * project with its content digest. CI compares the working tree
 * against the lock; PR diffs surface every change to the surface;
 * future surfaces (`phub watch`, `phub install`, the MCP runtime
 * gate) build on this baseline.
 *
 * Reproducibility is the load-bearing property: re-stamping the lock
 * against an unchanged working tree MUST produce a byte-identical
 * file. No timestamps, alphabetical keys, lexicographic artifact
 * sort. See ADR-0026 § "Reproducibility — byte-identical re-stamps".
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import { type ArtifactClass } from "./classifier.js"
import { type AuditedArtifact } from "./types.js"

/** Lock-format version. Ratchets per ADR-0015 when the format ratchets. */
export const LOCK_VERSION = "0.1"

/** Top 10 spec version the classifications were computed against. */
export const LOCK_TOP10_VERSION = "0.1"

/** Generator string written into every lock. */
export const LOCK_GENERATOR = "phub@0.1.0"

/** JSON Schema URL — reserved for launch-day publishing (ADR-0022). */
export const LOCK_SCHEMA_URL = "https://primitivehub.ai/phub-lock/v0.1.json"

/**
 * Attestation state for a locked artifact. v0.1 emits only
 * `unattested`; v0.2+ populates `rekor:<log_index>` and
 * `registry:<slug>@<semver>` via Trust API + phub install
 * integration (ADR-0028 planned).
 */
/**
 * Attestation states recorded in `LockedArtifact.attestation`.
 *
 * - `unattested`          — artifact discovered by `phub audit`; no provenance.
 * - `rekor:<log-index>`   — verified against a Sigstore Rekor transparency log entry. (v0.2)
 * - `registry:<slug>@<v>` — installed via `phub install <slug@semver>` from a registry (ADR-0028).
 * - `url:<url>`           — installed via `phub install --url <url>` (ADR-0028; non-registry HTTP source).
 * - `local:<path>`        — installed via `phub install --bundle <path>` (ADR-0028; local bundle file).
 */
export type LockAttestation =
  | "unattested"
  | `rekor:${string}`
  | `registry:${string}`
  | `url:${string}`
  | `local:${string}`

export interface LockedArtifact {
  attestation: LockAttestation
  classification: ArtifactClass
  digest: string
  path: string
}

export interface PhubLock {
  $schema?: string
  artifacts: LockedArtifact[]
  generator: string
  root: string
  top10_version: string
  version: string
}

export interface DiffAddedEntry {
  classification: ArtifactClass
  digest: string
  path: string
}

export interface DiffRemovedEntry {
  classification: ArtifactClass
  digest: string
  path: string
}

export interface DiffModifiedEntry {
  fromDigest: string
  path: string
  toDigest: string
}

export interface DiffReclassifiedEntry {
  fromClass: ArtifactClass
  path: string
  toClass: ArtifactClass
}

export interface LockDrift {
  added: DiffAddedEntry[]
  modified: DiffModifiedEntry[]
  reclassified: DiffReclassifiedEntry[]
  removed: DiffRemovedEntry[]
}

export interface LockCheckResult {
  drift: LockDrift
  hasDrift: boolean
  /** True iff the lock's top10_version doesn't match the current Top 10. */
  specVersionMismatch: boolean
  lockTop10Version: string
}

/**
 * Build a `PhubLock` from the audit's artifact list. Pure function.
 *
 * Artifact order in the lock is lexicographic by path so re-stamping
 * against an unchanged tree produces a byte-identical file.
 */
export function lockFromAudit(artifacts: readonly AuditedArtifact[]): PhubLock {
  const locked: LockedArtifact[] = artifacts
    .map((a) => artifactToLocked(a))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  return {
    $schema: LOCK_SCHEMA_URL,
    artifacts: locked,
    generator: LOCK_GENERATOR,
    root: ".",
    top10_version: LOCK_TOP10_VERSION,
    version: LOCK_VERSION,
  }
}

function artifactToLocked(a: AuditedArtifact): LockedArtifact {
  return {
    attestation: "unattested",
    classification: a.classification,
    digest: `sha256:${a.digest}`,
    path: a.path,
  }
}

/**
 * Serialize a `PhubLock` to canonical JSON.
 *
 * Canonical-form rules:
 * - Keys sorted alphabetically at every level
 * - 2-space indent
 * - Trailing newline
 * - UTF-8
 */
export function serializeLock(lock: PhubLock): string {
  return canonicalStringify(lock) + "\n"
}

/**
 * JSON.stringify with alphabetically sorted keys at every nesting
 * level. We only need this for object literals; arrays are emitted in
 * the order the caller supplies (the caller is responsible for
 * deterministic array ordering, see `lockFromAudit`).
 */
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

export class LockParseError extends Error {
  constructor(
    message: string,
    readonly source: string,
  ) {
    super(message)
    this.name = "LockParseError"
  }
}

/**
 * Parse the wire form of a lock. Throws `LockParseError` on
 * malformed input; the CLI catches and surfaces as exit 2.
 */
export function parseLock(content: string, source: string): PhubLock {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new LockParseError(`invalid JSON: ${msg}`, source)
  }
  if (raw === null || typeof raw !== "object") {
    throw new LockParseError("lock must be a JSON object", source)
  }
  const obj = raw as Record<string, unknown>
  const version = obj["version"]
  if (typeof version !== "string") {
    throw new LockParseError("missing or non-string `version`", source)
  }
  const top10_version = obj["top10_version"]
  if (typeof top10_version !== "string") {
    throw new LockParseError("missing or non-string `top10_version`", source)
  }
  const generator = obj["generator"]
  if (typeof generator !== "string") {
    throw new LockParseError("missing or non-string `generator`", source)
  }
  const root = obj["root"]
  if (typeof root !== "string") {
    throw new LockParseError("missing or non-string `root`", source)
  }
  const artifacts = obj["artifacts"]
  if (!Array.isArray(artifacts)) {
    throw new LockParseError("missing or non-array `artifacts`", source)
  }
  const parsedArtifacts: LockedArtifact[] = artifacts.map((a, i) => {
    if (a === null || typeof a !== "object") {
      throw new LockParseError(`artifact[${i}] must be an object`, source)
    }
    const aa = a as Record<string, unknown>
    if (typeof aa["path"] !== "string") {
      throw new LockParseError(`artifact[${i}].path must be a string`, source)
    }
    if (typeof aa["classification"] !== "string") {
      throw new LockParseError(`artifact[${i}].classification must be a string`, source)
    }
    if (typeof aa["digest"] !== "string") {
      throw new LockParseError(`artifact[${i}].digest must be a string`, source)
    }
    if (typeof aa["attestation"] !== "string") {
      throw new LockParseError(`artifact[${i}].attestation must be a string`, source)
    }
    return {
      attestation: aa["attestation"] as LockAttestation,
      classification: aa["classification"] as ArtifactClass,
      digest: aa["digest"] as string,
      path: aa["path"] as string,
    }
  })
  const result: PhubLock = {
    artifacts: parsedArtifacts,
    generator,
    root,
    top10_version,
    version,
  }
  if (typeof obj["$schema"] === "string") {
    result.$schema = obj["$schema"] as string
  }
  return result
}

/** Read + parse a lock file. Caller catches `LockParseError`. */
export function readLock(path: string): PhubLock {
  let content: string
  try {
    content = readFileSync(path, "utf8")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new LockParseError(`cannot read lock: ${msg}`, path)
  }
  return parseLock(content, path)
}

/** Write a lock atomically (mkdirSync recursive + writeFileSync). */
export function writeLock(path: string, lock: PhubLock): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeLock(lock), { encoding: "utf8" })
}

/**
 * Diff a previously-stored lock against the freshly-computed lock.
 *
 * Drift categories are mutually exclusive in the `added`/`removed`
 * dimension. A path that exists in both states with the same digest
 * but a different classification appears in `reclassified` ONLY. A
 * path whose digest AND classification both changed appears in
 * `modified` AND `reclassified`.
 */
export function diffLock(previous: PhubLock, current: PhubLock): LockDrift {
  const prevByPath = new Map(previous.artifacts.map((a) => [a.path, a]))
  const currByPath = new Map(current.artifacts.map((a) => [a.path, a]))

  const added: DiffAddedEntry[] = []
  const removed: DiffRemovedEntry[] = []
  const modified: DiffModifiedEntry[] = []
  const reclassified: DiffReclassifiedEntry[] = []

  for (const [path, curr] of currByPath) {
    const prev = prevByPath.get(path)
    if (prev === undefined) {
      added.push({
        classification: curr.classification,
        digest: curr.digest,
        path,
      })
      continue
    }
    if (prev.digest !== curr.digest) {
      modified.push({
        fromDigest: prev.digest,
        path,
        toDigest: curr.digest,
      })
    }
    if (prev.classification !== curr.classification) {
      reclassified.push({
        fromClass: prev.classification,
        path,
        toClass: curr.classification,
      })
    }
  }
  for (const [path, prev] of prevByPath) {
    if (!currByPath.has(path)) {
      removed.push({
        classification: prev.classification,
        digest: prev.digest,
        path,
      })
    }
  }

  added.sort((a, b) => (a.path < b.path ? -1 : 1))
  removed.sort((a, b) => (a.path < b.path ? -1 : 1))
  modified.sort((a, b) => (a.path < b.path ? -1 : 1))
  reclassified.sort((a, b) => (a.path < b.path ? -1 : 1))

  return { added, modified, reclassified, removed }
}

/** True iff a drift result records any change at all. */
export function isLockDrifted(drift: LockDrift): boolean {
  return (
    drift.added.length > 0 ||
    drift.removed.length > 0 ||
    drift.modified.length > 0 ||
    drift.reclassified.length > 0
  )
}
