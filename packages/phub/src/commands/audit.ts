/**
 * `phub audit` — the first active surface (ADR-0025) + lockfile
 * integration (ADR-0026).
 *
 * Discovers every agent-context artifact under a path, classifies it,
 * digests it (SHA-256), runs the existing scanner roster on the
 * text-scannable classes, and emits a project-level report. Optionally
 * compares the discovered state against a committed `phub.lock`
 * (`--check-lock`) or writes a fresh one (`--update-lock`).
 *
 * This command introduces NO new detectors — it is an orchestration
 * surface over the existing scanner kernel. Detector-parity rule
 * (ADR-0023) therefore stands unchanged: the Python and TS detector
 * implementations are still the canonical pair.
 */

import { existsSync, readFileSync, lstatSync } from "node:fs"
import { resolve, relative, sep, join, isAbsolute } from "node:path"

import { classify, isTextScannable } from "../audit/classifier.js"
import { sha256Hex } from "../audit/digest.js"
import { classifyUncovered, type UncoveredFile } from "../audit/uncovered.js"
import {
  diffLock,
  isLockDrifted,
  lockFromAudit,
  readLock,
  serializeLock,
  writeLock,
  LockParseError,
  LOCK_TOP10_VERSION,
  type PhubLock,
} from "../audit/lock.js"
import {
  type AuditLockState,
  type AuditResult,
  type AuditedArtifact,
  type AuditSummary,
} from "../audit/types.js"
import {
  walk,
  DEFAULT_WALK_OPTIONS,
  type WalkOptions,
} from "../audit/walker.js"
import { applyPolicy, type PolicyAdjustedVerdict } from "../policy/evaluator.js"
import { resolvePolicy } from "../policy/loader.js"
import {
  PolicyLoadError,
  type Policy,
  type PolicyAllowEntry,
} from "../policy/types.js"
import { renderAuditHumanReport } from "../reporters/audit-human.js"
import { renderSarifForArtifacts } from "../reporters/sarif.js"
import { DETECTORS, detectorByName } from "../scanners/registry.js"
import { Severity, type Detector, type Verdict } from "../scanners/types.js"

export type { AuditResult, AuditedArtifact, AuditSummary } from "../audit/types.js"

export type LockMode = "check" | "update" | "lock-only" | "off"

export interface AuditOptions {
  json: boolean
  sarif: boolean
  detectors?: readonly string[]
  strict: boolean
  /** Path to a context-policy YAML file. Undefined → discover + implicit default. */
  policyPath?: string
  /** --allow-fail=<id> repeats; appended to policy.allow as synthetic entries. */
  allowFailFor?: readonly string[]
  maxFiles: number
  maxDepth: number
  /** Lock-integration mode. Default "off". */
  lockMode?: LockMode
  /** Override the auto-discovered lock path. */
  lockPath?: string
}

const NORM = (p: string): string => p.split(sep).join("/")

const DEFAULT_LOCK_DIRNAME = ".primitivehub"
const DEFAULT_LOCK_FILENAME = "phub.lock"

function defaultLockPath(rootDir: string): string {
  return join(rootDir, DEFAULT_LOCK_DIRNAME, DEFAULT_LOCK_FILENAME)
}

function resolveLockPath(rootDir: string, override: string | undefined): string {
  if (override === undefined) return defaultLockPath(rootDir)
  return isAbsolute(override) ? override : resolve(rootDir, override)
}

function syntheticAllow(allowIds: readonly string[]): readonly PolicyAllowEntry[] {
  if (allowIds.length === 0) return []
  return [
    {
      reason: "synthetic from --allow-fail",
      files: ["**/*"],
      rules: allowIds.map((id) => ({ id })),
    },
  ]
}

function applyCliOverridesToPolicy(policy: Policy, opts: AuditOptions): Policy {
  let merged = policy
  if (opts.strict && !policy.strict) {
    merged = { ...merged, strict: true }
  }
  const extra = syntheticAllow(opts.allowFailFor ?? [])
  if (extra.length > 0) {
    merged = { ...merged, allow: [...merged.allow, ...extra] }
  }
  return merged
}

function selectDetectors(ids: readonly string[] | undefined): readonly Detector[] {
  if (!ids || ids.length === 0) return DETECTORS
  const picked = ids
    .map((id) => detectorByName(id))
    .filter((d): d is Detector => d !== undefined)
  return picked.length > 0 ? picked : DETECTORS
}

/**
 * Core audit logic, decoupled from the CLI for in-process embedders.
 */
export function runAudit(rootPathArg: string, opts: AuditOptions): AuditResult {
  const root = resolve(rootPathArg)
  const walkOpts: WalkOptions = {
    maxDepth: opts.maxDepth ?? DEFAULT_WALK_OPTIONS.maxDepth,
    maxFiles: opts.maxFiles ?? DEFAULT_WALK_OPTIONS.maxFiles,
  }

  const walked = walk(root, walkOpts)
  // SECURITY (R04): coverage is complete only if the walker exhausted the
  // tree. maxFiles truncation OR a subtree skipped past maxDepth means
  // un-scanned artifacts may exist — fail closed downstream. Deliberate
  // skips (skip-list / hidden dirs / symlinks) do NOT count against coverage.
  const coverageComplete = !walked.truncated && !walked.skipped.some((s) => s.reason === "depth")
  const detectors = selectDetectors(opts.detectors)
  const lockMode: LockMode = opts.lockMode ?? "off"
  const skipScanning = lockMode === "lock-only"

  const resolved = resolvePolicy(opts.policyPath)
  const policy = applyCliOverridesToPolicy(resolved.policy, opts)

  // When the root is itself a single file, classification uses the
  // basename rather than a relative-to-root path.
  const rootIsFile = (() => {
    try {
      return lstatSync(root).isFile()
    } catch {
      return false
    }
  })()

  const artifacts: AuditedArtifact[] = []
  const uncovered: UncoveredFile[] = []

  for (const abs of walked.files) {
    const rel = rootIsFile ? NORM(abs).split("/").pop() ?? abs : NORM(relative(root, abs))
    if (rel.length === 0) continue
    const cls = classify(rel)
    if (cls === null) {
      // Not a context artifact. If it's notable surface phub audit does
      // not review (executable scripts), record it for the warning block
      // rather than dropping it silently.
      const kind = classifyUncovered(rel)
      if (kind !== null) uncovered.push({ path: rel, kind })
      continue
    }

    let content: Buffer
    try {
      content = readFileSync(abs)
    } catch {
      // File vanished between walk and read (rare, but possible) — skip.
      continue
    }
    const digest = sha256Hex(content)

    let verdicts: Verdict[] = []
    let adjusted: PolicyAdjustedVerdict[] = []
    let flagged = false
    const scanned = !skipScanning && isTextScannable(cls)
    if (scanned) {
      const text = content.toString("utf8")
      verdicts = detectors.map((d) => d.run({ content: text, filename: rel }))
      const evaluation = applyPolicy(verdicts, policy, rel)
      adjusted = [...evaluation.adjusted]
      flagged = evaluation.exitCode === 1
    }
    artifacts.push({
      path: rel,
      classification: cls,
      digest,
      scanned,
      verdicts,
      adjustedVerdicts: adjusted,
      flagged,
    })
  }

  // Stable display order: by classification (ARTIFACT_CLASSES order), then path.
  artifacts.sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification < b.classification ? -1 : 1
    }
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  })
  uncovered.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const byClassification: Record<string, number> = {}
  let flaggedArtifacts = 0
  let totalFindings = 0
  for (const a of artifacts) {
    byClassification[a.classification] = (byClassification[a.classification] ?? 0) + 1
    if (a.flagged) flaggedArtifacts++
    for (const adj of a.adjustedVerdicts) {
      if (adj.verdict.severity === Severity.FAIL || (policy.strict && adj.verdict.severity === Severity.WARN)) {
        totalFindings += adj.verdict.diffHints.length
      }
    }
  }
  const summary: AuditSummary = {
    totalArtifacts: artifacts.length,
    byClassification,
    flaggedArtifacts,
    totalFindings,
  }
  const scanClean = flaggedArtifacts === 0

  // Build the current lock projection from the artifact list for
  // both check-lock and update-lock modes. The projection is
  // independent of scanner state (lock pins state, not verdicts).
  const currentLock = lockFromAudit(artifacts)

  let lockState: AuditLockState | null = null
  if (lockMode !== "off") {
    const rootDir = rootIsFile ? resolve(root, "..") : root
    const lockPath = resolveLockPath(rootDir, opts.lockPath)
    if (lockMode === "check") {
      lockState = doCheckLock(lockPath, currentLock)
    } else {
      // "update" always writes to disk.
      // "lock-only" writes to disk UNLESS paired with --json (in which
      // case the command layer streams the lock to stdout instead).
      // SECURITY (R04): never persist a lock built from an incomplete walk —
      // it would bake "clean / known" for artifacts we never examined, and a
      // later --check-lock would pass against a lock that silently omits them.
      const writeToDisk = !(lockMode === "lock-only" && opts.json)
      if (writeToDisk && coverageComplete) writeLock(lockPath, currentLock)
      lockState = {
        mode: "update",
        lockPath,
        drift: null,
        hasDrift: false,
        missing: false,
        specVersionMismatch: false,
        lock: currentLock,
      }
    }
  }

  // Project-level exit code:
  //   scanner findings: exit 1 (unless --no-fail, handled in the CLI)
  //   lock drift:       exit 1 (under --check-lock)
  //   missing lock:     exit 2 (under --check-lock, surfaced as throw)
  //   spec mismatch:    exit 2 (under --check-lock, surfaced via lockState)
  let exitCode: 0 | 1 = scanClean ? 0 : 1
  if (lockState?.mode === "check" && lockState.hasDrift) exitCode = 1

  return {
    root,
    policySource: resolved.source,
    artifacts,
    skipped: walked.skipped,
    uncovered,
    truncated: walked.truncated,
    coverageComplete,
    summary,
    lockState,
    scanClean,
    exitCode,
  }
}

/** Actionable fail-closed message for an audit whose walk didn't cover the tree. */
function incompleteCoverageMessage(result: AuditResult, opts: AuditOptions): string {
  const bits: string[] = []
  if (result.truncated) bits.push(`file cap reached (--max-files=${opts.maxFiles})`)
  const depthSkips = result.skipped.filter((s) => s.reason === "depth").length
  if (depthSkips > 0) bits.push(`${depthSkips} subtree(s) skipped past --max-depth=${opts.maxDepth}`)
  return (
    `phub audit: INCOMPLETE COVERAGE — ${bits.join("; ")}. ` +
    `Un-scanned artifacts may exist, so this audit cannot certify the tree clean and no lock was written. ` +
    `Raise the caps (--max-files / --max-depth) or audit a narrower path, then re-run.\n`
  )
}

function doCheckLock(lockPath: string, currentLock: PhubLock): AuditLockState {
  if (!existsSync(lockPath)) {
    return {
      mode: "check",
      lockPath,
      drift: null,
      hasDrift: false,
      missing: true,
      specVersionMismatch: false,
      lock: null,
    }
  }
  const previous = readLock(lockPath)
  const specVersionMismatch = previous.top10_version !== LOCK_TOP10_VERSION
  const drift = diffLock(previous, currentLock)
  return {
    mode: "check",
    lockPath,
    drift,
    hasDrift: isLockDrifted(drift),
    missing: false,
    specVersionMismatch,
    lock: previous,
  }
}

/** Top-level dispatch for `phub audit`. Returns process exit code. */
export function auditCommand(rootArg: string | undefined, opts: AuditOptions): number {
  const target = rootArg ?? process.cwd()
  let result: AuditResult
  try {
    result = runAudit(target, opts)
  } catch (err) {
    if (err instanceof PolicyLoadError) {
      process.stderr.write(`phub audit: invalid policy at ${err.source}: ${err.message}\n`)
      return 2
    }
    if (err instanceof LockParseError) {
      process.stderr.write(`phub audit: invalid lock at ${err.source}: ${err.message}\n`)
      return 2
    }
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub audit: ${msg}\n`)
    return 2
  }

  // --check-lock with missing lock is a usage error, not a finding.
  if (result.lockState?.mode === "check" && result.lockState.missing) {
    process.stderr.write(
      `phub audit: no lock to check against at ${result.lockState.lockPath}; run \`phub audit --update-lock\` to create one.\n`,
    )
    return 2
  }
  if (result.lockState?.mode === "check" && result.lockState.specVersionMismatch && result.lockState.lock) {
    process.stderr.write(
      `phub audit: lock at ${result.lockState.lockPath} was generated against Top 10 v${result.lockState.lock.top10_version}; current is v${LOCK_TOP10_VERSION}. Re-lock required: run \`phub audit --update-lock\`.\n`,
    )
    return 2
  }

  // SECURITY (R04): a --lock-only --json stream built from an incomplete
  // walk would emit a partial lock as authoritative. Refuse before streaming.
  if (opts.lockMode === "lock-only" && opts.json && result.lockState?.lock) {
    if (!result.coverageComplete) {
      process.stderr.write(incompleteCoverageMessage(result, opts))
      return 2
    }
    process.stdout.write(serializeLock(result.lockState.lock))
    return result.exitCode
  }

  if (opts.sarif) {
    process.stdout.write(renderSarifForArtifacts(result) + "\n")
  } else if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          root: result.root,
          policySource: result.policySource,
          artifacts: result.artifacts.map((a) => ({
            path: a.path,
            classification: a.classification,
            digest: a.digest,
            scanned: a.scanned,
            flagged: a.flagged,
            verdicts: a.adjustedVerdicts.map((adj) => adj.verdict),
          })),
          skipped: result.skipped,
          uncovered: result.uncovered,
          truncated: result.truncated,
          coverageComplete: result.coverageComplete,
          summary: result.summary,
          lock: result.lockState
            ? {
                mode: result.lockState.mode,
                path: result.lockState.lockPath,
                hasDrift: result.lockState.hasDrift,
                drift: result.lockState.drift,
              }
            : null,
        },
        null,
        2,
      ) + "\n",
    )
  } else {
    process.stdout.write(renderAuditHumanReport(result) + "\n")
  }

  // SECURITY (R04): fail closed — an incomplete walk cannot certify "clean".
  // The report above still shows what WAS found; the exit code tells the
  // truth about coverage so CI and `verify-before-load` don't trust a 0.
  if (!result.coverageComplete) {
    process.stderr.write(incompleteCoverageMessage(result, opts))
    return 2
  }

  return result.exitCode
}
