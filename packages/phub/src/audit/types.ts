/**
 * Audit result types — shared between the audit command and the
 * reporters that render its output.
 *
 * Lives in `audit/` (not `commands/`) so reporters can import it
 * without creating a `commands/ → reporters/ → commands/` cycle.
 */

import { type PolicyAdjustedVerdict } from "../policy/evaluator.js"
import { type Verdict } from "../scanners/types.js"

import { type ArtifactClass } from "./classifier.js"
import { type LockDrift, type PhubLock } from "./lock.js"
import { type SkippedEntry } from "./walker.js"

export interface AuditedArtifact {
  /** Path relative to the audit root, normalized to forward slashes. */
  path: string
  classification: ArtifactClass
  /** Hex-encoded SHA-256 of file bytes. */
  digest: string
  /** True iff the classification's content was run through the scanner roster. */
  scanned: boolean
  /** Raw verdicts before policy adjustment. Empty if `scanned === false`. */
  verdicts: Verdict[]
  /** Per-policy adjusted verdicts (mirrors `phub scan` output). */
  adjustedVerdicts: PolicyAdjustedVerdict[]
  /** True iff at least one adjusted verdict exits 1 after policy. */
  flagged: boolean
}

export interface AuditSummary {
  totalArtifacts: number
  byClassification: Record<string, number>
  flaggedArtifacts: number
  totalFindings: number
}

export interface AuditLockState {
  /** "check" → compared against lock; "update" → wrote lock; "off" → no lock op. */
  mode: "check" | "update" | "off"
  /** Resolved lock path (the file we read or wrote). */
  lockPath: string
  /** Drift summary; null when mode is "update" or "off". */
  drift: LockDrift | null
  /** True iff drift was detected (always false in "update"/"off" modes). */
  hasDrift: boolean
  /** True iff the lock file did not exist when `check` ran. */
  missing: boolean
  /** True iff the lock's top10_version differs from the runtime constant. */
  specVersionMismatch: boolean
  /**
   * The lock that the audit command read from disk (mode === "check") or
   * the lock that it wrote (mode === "update"). null when missing.
   */
  lock: PhubLock | null
}

export interface AuditResult {
  /** Absolute path of the audit root. */
  root: string
  /** Policy source string (file path or implicit-default marker). */
  policySource: string
  /** Every classified artifact, sorted (classification, path). */
  artifacts: AuditedArtifact[]
  /** Every entry the walker chose not to descend into, with reason. */
  skipped: SkippedEntry[]
  /** True iff the walker hit `maxFiles` before exhausting the tree. */
  truncated: boolean
  summary: AuditSummary
  /** Lockfile state for this run; null when no --check-lock / --update-lock / --lock-only flag was set. */
  lockState: AuditLockState | null
  /** True iff every scanned artifact's policy-adjusted verdicts pass. */
  scanClean: boolean
  exitCode: 0 | 1
}
