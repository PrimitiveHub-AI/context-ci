/**
 * `verifyBeforeLoad` — composite runtime gate for agent-context primitives.
 *
 * The reference implementation that the MCP server's `verify_before_load`
 * tool calls. Lives in `@primitivehub/phub` (not `@primitivehub/mcp-server`)
 * per ADR-0023 + ADR-0031: trust-decision logic stays in phub; transports
 * are pure wrappers.
 *
 * Semantics
 * ---------
 * Refuses-by-default. Returns `{safe, reasons[], checks}`:
 *   - safe === false IF any check is concerning.
 *   - reasons[] is a stable, machine-greppable list of failure codes
 *     (`PATH_NOT_IN_LOCK`, `PATH_DIGEST_MISMATCH`, …) with human-readable
 *     context appended. Agents branch on the code, not the prose.
 *   - checks{} surfaces the raw data so an agent can decide to override
 *     (e.g. "missing lock is OK in dev; refuse in prod").
 *
 * Composes existing primitives:
 *   - `runAudit({ lockMode: "check" })` for lock + scanner state.
 *   - Optional `verifyBundle` call (the MCP wrapper passes the bundle;
 *     verifyBundle lives in `@primitivehub/verify`).
 *
 * No new validation logic. If `verifyBeforeLoad` says "safe", it's
 * because runAudit + verifyBundle said so. If you don't trust those,
 * don't trust this.
 */

import { existsSync } from "node:fs"
import { relative, resolve } from "node:path"

import { runAudit, type AuditOptions } from "./audit.js"
import { type AuditResult } from "../audit/types.js"
import { Severity } from "../scanners/types.js"

/** Failure codes — stable across patch releases. Agents branch on these. */
export type VerifyBeforeLoadReasonCode =
  | "LOCK_MISSING"
  | "LOCK_SPEC_VERSION_MISMATCH"
  | "PATH_NOT_FOUND"
  | "PATH_UNCLASSIFIED"
  | "PATH_NOT_IN_LOCK"
  | "PATH_DIGEST_MISMATCH"
  | "PATH_UNATTESTED"
  | "PATH_FLAGGED_BY_SCANNER"

/**
 * Severity tier for a reason — the low-FP distinction the firewall draws
 * between "this is an attack / tamper signal" and "this artifact is simply
 * unsealed". `safe` still goes false the instant ANY reason fires
 * (refuse-by-default, ADR-0029); `tier` is purely additive metadata that
 * lets a transport render a crisp verdict and offer an opt-in dev path
 * (`--allow-unsealed`) without weakening the gate.
 *
 *   - "block"   — integrity / detection signal. Tamper, drift, a live
 *                 scanner finding, or a caller-demanded attestation that is
 *                 absent. Never a false positive you'd want to wave through.
 *   - "posture" — the operator simply hasn't sealed this artifact yet
 *                 (no lock, path not in lock, not a known class). Real on a
 *                 hardened repo; noise on first run. Downgradable by policy.
 */
export type VerifyBeforeLoadReasonTier = "block" | "posture"

/** code → tier. The single source of truth for the block/posture split. */
const REASON_TIER: Record<VerifyBeforeLoadReasonCode, VerifyBeforeLoadReasonTier> = {
  LOCK_MISSING: "posture",
  PATH_UNCLASSIFIED: "posture",
  PATH_NOT_IN_LOCK: "posture",
  LOCK_SPEC_VERSION_MISMATCH: "block",
  PATH_NOT_FOUND: "block",
  PATH_DIGEST_MISMATCH: "block",
  PATH_UNATTESTED: "block",
  PATH_FLAGGED_BY_SCANNER: "block",
}

export interface VerifyBeforeLoadReason {
  code: VerifyBeforeLoadReasonCode
  tier: VerifyBeforeLoadReasonTier
  message: string
}

export interface VerifyBeforeLoadOptions {
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Path to the artifact being loaded. Relative or absolute. */
  path: string
  /** Optional policy path. Defaults to discovery. */
  policyPath?: string
  /** Optional explicit lock path. Defaults to `<workspaceRoot>/.primitivehub/phub.lock`. */
  lockPath?: string
  /**
   * When true, an `unattested` lock entry (the v0.1 default) counts as
   * unsafe. Use when consuming registry primitives that should carry
   * `rekor:*` or `registry:*` attestations.
   */
  requireAttestation?: boolean
  /** Audit walker caps. */
  maxFiles?: number
  maxDepth?: number
}

export interface VerifyBeforeLoadChecks {
  workspace: { root: string; relativePath: string; absolutePath: string }
  lock: {
    lockPath: string | null
    lockExists: boolean
    specVersionMatch: boolean
    pathInLock: boolean
    pathDigestMatch: boolean | null
    pathAttestation: string | null
  }
  artifact: {
    discovered: boolean
    classification: string | null
    digest: string | null
    scanned: boolean
    flagged: boolean
    verdicts: ReadonlyArray<{
      cciId: string
      severity: string
      passed: boolean
      summary: string
    }>
  }
}

export interface VerifyBeforeLoadResult {
  safe: boolean
  reasons: ReadonlyArray<VerifyBeforeLoadReason>
  checks: VerifyBeforeLoadChecks
}

/**
 * True iff the result carries at least one `block`-tier reason (tamper,
 * drift, a live scanner finding, or a demanded-but-absent attestation).
 *
 * The low-FP predicate a transport uses to decide whether an unsafe result
 * is a hard stop or merely an unsealed-posture warning it may wave through
 * under an explicit opt-in (`phub verify-before-load --allow-unsealed`,
 * `phub-scan mode:gate allow-unsealed:true`). `safe === false` with no
 * block-tier reason means "clean content, just not sealed yet".
 */
export function hasBlockingReason(result: VerifyBeforeLoadResult): boolean {
  return result.reasons.some((r) => r.tier === "block")
}

/**
 * Run the composite gate. Synchronous — every underlying primitive
 * (`runAudit`) is synchronous in v0.1. The MCP wrapper is async only
 * because it also runs `verifyBundle` (which uses Web Crypto and is
 * therefore Promise-based).
 */
export function verifyBeforeLoad(opts: VerifyBeforeLoadOptions): VerifyBeforeLoadResult {
  const workspaceRoot = resolve(opts.workspaceRoot)
  const absolutePath = resolve(workspaceRoot, opts.path)
  const relativePath = relative(workspaceRoot, absolutePath).replace(/\\/g, "/")

  const auditOpts: AuditOptions = {
    json: false,
    sarif: false,
    strict: false,
    detectors: [],
    maxFiles: opts.maxFiles ?? 10000,
    maxDepth: opts.maxDepth ?? 16,
    lockMode: "check",
  }
  if (opts.policyPath !== undefined) auditOpts.policyPath = opts.policyPath
  if (opts.lockPath !== undefined) auditOpts.lockPath = opts.lockPath

  const auditResult: AuditResult = runAudit(workspaceRoot, auditOpts)
  return decide(auditResult, opts, { workspaceRoot, absolutePath, relativePath })
}

function decide(
  auditResult: AuditResult,
  opts: VerifyBeforeLoadOptions,
  paths: { workspaceRoot: string; absolutePath: string; relativePath: string },
): VerifyBeforeLoadResult {
  const reasons: VerifyBeforeLoadReason[] = []
  const push = (code: VerifyBeforeLoadReasonCode, message: string): void => {
    reasons.push({ code, tier: REASON_TIER[code], message })
  }

  const lockState = auditResult.lockState
  const lockEntry = lockState?.lock?.artifacts.find((a) => a.path === paths.relativePath) ?? null
  const artifact = auditResult.artifacts.find((a) => a.path === paths.relativePath) ?? null

  // ── Lock checks ───────────────────────────────────────────────────
  if (lockState === null || lockState.missing) {
    push(
      "LOCK_MISSING",
      `no .primitivehub/phub.lock under ${paths.workspaceRoot} — operator has not sealed any artifacts`,
    )
  } else if (lockState.specVersionMismatch) {
    push(
      "LOCK_SPEC_VERSION_MISMATCH",
      `lock pinned to a different Top 10 spec version than this runtime expects`,
    )
  }

  // ── Path-existence + classification ───────────────────────────────
  if (!existsSync(paths.absolutePath)) {
    push("PATH_NOT_FOUND", `'${paths.relativePath}' does not exist under ${paths.workspaceRoot}`)
  } else if (artifact === null) {
    push(
      "PATH_UNCLASSIFIED",
      `'${paths.relativePath}' is not a known agent-context artifact class (see ADR-0025)`,
    )
  }

  // ── Per-path lock entry ───────────────────────────────────────────
  let pathDigestMatch: boolean | null = null
  let pathAttestation: string | null = null
  if (artifact !== null && lockState !== null && !lockState.missing) {
    if (lockEntry === null) {
      push(
        "PATH_NOT_IN_LOCK",
        `'${paths.relativePath}' is in the working tree but not in the lock — operator has not sealed this artifact`,
      )
    } else {
      pathAttestation = lockEntry.attestation
      const expectedDigest = `sha256:${artifact.digest}`
      pathDigestMatch = lockEntry.digest === expectedDigest
      if (!pathDigestMatch) {
        push(
          "PATH_DIGEST_MISMATCH",
          `'${paths.relativePath}' content (${expectedDigest}) does not match the lock (${lockEntry.digest})`,
        )
      } else if (opts.requireAttestation === true) {
        // SECURITY (R01): a lock attestation string is METADATA, not a verified
        // proof. The old check only rejected the exact label "unattested", so an
        // attacker who controls the lock could write "rekor:FAKE" and pass the
        // strict gate. v0.1 has NO cryptographic attestation verification, so no
        // label can be trusted — fail closed for every value until real
        // verification lands (verify v0.2 / PH-006 identity pinning).
        push(
          "PATH_UNATTESTED",
          `'${paths.relativePath}' attestation '${lockEntry.attestation}' is a lock label, not a cryptographically verified proof — requireAttestation cannot be satisfied in this version (no attestation verification yet; lands in verify v0.2). Refusing.`,
        )
      }
    }
  }

  // ── Scanner verdicts on this specific artifact ────────────────────
  const verdicts: Array<{ cciId: string; severity: string; passed: boolean; summary: string }> = []
  if (artifact !== null) {
    for (const adj of artifact.adjustedVerdicts) {
      verdicts.push({
        cciId: adj.verdict.cciId,
        severity: adj.verdict.severity,
        passed: adj.verdict.passed,
        summary: adj.verdict.summary,
      })
    }
    if (artifact.flagged) {
      const failingIds = artifact.adjustedVerdicts
        .filter((adj) => adj.verdict.severity === Severity.FAIL && !adj.verdict.passed)
        .map((adj) => adj.verdict.cciId)
      push("PATH_FLAGGED_BY_SCANNER", `'${paths.relativePath}' triggers ${failingIds.join(", ")} (post-policy)`)
    }
  }

  const checks: VerifyBeforeLoadChecks = {
    workspace: {
      root: paths.workspaceRoot,
      absolutePath: paths.absolutePath,
      relativePath: paths.relativePath,
    },
    lock: {
      lockPath: lockState?.lockPath ?? null,
      lockExists: lockState !== null && !lockState.missing,
      specVersionMatch: lockState !== null && !lockState.specVersionMismatch,
      pathInLock: lockEntry !== null,
      pathDigestMatch,
      pathAttestation,
    },
    artifact: {
      discovered: artifact !== null,
      classification: artifact?.classification ?? null,
      digest: artifact?.digest ?? null,
      scanned: artifact?.scanned ?? false,
      flagged: artifact?.flagged ?? false,
      verdicts,
    },
  }

  return { safe: reasons.length === 0, reasons, checks }
}
