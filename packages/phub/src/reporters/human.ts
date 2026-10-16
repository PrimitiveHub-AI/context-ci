import { type VerifyBeforeLoadResult } from "../commands/verify-before-load.js"
import { type Verdict, Severity } from "../scanners/types.js"

const SEVERITY_BADGE: Record<Severity, string> = {
  [Severity.INFO]: "[INFO]",
  [Severity.WARN]: "[WARN]",
  [Severity.FAIL]: "[FAIL]",
}

/**
 * Render a list of verdicts as human-readable text. Output shape is
 * stable and parseable, but optimized for terminal reading first.
 *
 * Returns a multi-line string ready for stdout. Caller decides exit
 * code separately (any FAIL verdict = exit 1).
 */
export function renderHumanScanReport(filename: string, verdicts: readonly Verdict[]): string {
  const out: string[] = []
  out.push(`phub scan ${filename}`)
  out.push("")
  for (const v of verdicts) {
    out.push(`${SEVERITY_BADGE[v.severity]} ${v.detectorName} (${v.cciId}) — ${v.summary}`)
    for (const h of v.diffHints) {
      out.push(`  L${h.line}  ${h.snippet}`)
      out.push(`         ${h.suggestion}`)
    }
  }
  out.push("")

  const failed = verdicts.filter((v) => v.severity === Severity.FAIL).length
  const total = verdicts.length
  if (failed === 0) {
    out.push(`Result: ${total}/${total} detectors passed.`)
  } else {
    out.push(`Result: ${failed} of ${total} detectors flagged content. Review before publishing.`)
  }
  return out.join("\n")
}

export interface VerifyReportShape {
  /** TRUSTED: inspected && authenticated. Fails closed (false in v0.1). */
  valid: boolean
  /** Non-crypto checks passed. NOT a trust signal. */
  inspected?: boolean
  /** Cryptographically authenticated. False in v0.1. */
  authenticated?: boolean
  failures: ReadonlyArray<{ code: string; message: string; path?: string }>
  deferredSteps?: readonly string[]
  level?: string
}

export function renderHumanVerifyReport(filename: string, result: VerifyReportShape): string {
  // SECURITY (PH-SEC-001 / forged-bundle report): three distinct verdicts,
  // never collapsed. AUTHENTICATED (trusted) vs INSPECTED (well-formed but
  // NOT trusted — a forgery passes inspection) vs REJECTED (malformed).
  // Only `authenticated` is a trust verdict.
  const authenticated = result.authenticated ?? false
  const inspected = result.inspected ?? result.valid // tolerate an older verify
  const out: string[] = []
  out.push(`phub verify ${filename}`)
  out.push("")
  if (authenticated) {
    out.push("Trust Bundle AUTHENTICATED (signature + cert chain + Rekor verified).")
    return out.join("\n")
  }
  if (inspected) {
    out.push("Trust Bundle INSPECTED — NOT cryptographically authenticated.")
    out.push("  ⚠ This is NOT a trust verdict. Schema + content-digest" +
      (result.level === "policy" ? " + Context CI policy" : "") + " checks passed,")
    out.push("    but signature / certificate-chain / Rekor verification did not run.")
    out.push("    Do NOT trust this bundle's origin on this result alone. A forged bundle")
    out.push("    passes these same checks. Real authentication lands in @primitivehub/verify v0.2.")
    return out.join("\n")
  }
  out.push(`Trust Bundle REJECTED (${result.failures.length} failure(s)):`)
  for (const f of result.failures) {
    const at = f.path ? ` (at ${f.path})` : ""
    out.push(`  [${f.code}] ${f.message}${at}`)
  }
  return out.join("\n")
}

export interface VerifyBeforeLoadReport {
  path: string
  result: VerifyBeforeLoadResult
}

/**
 * Render the composite runtime gate for one or more paths. Verdict is
 * crisp by design — exactly one of SAFE / BLOCKED / UNSEALED per path —
 * and the block/posture split keeps the low-FP signal (tamper, drift, a
 * live scanner finding) visually separate from "you just haven't sealed
 * this yet". Caller owns the exit code.
 */
export function renderHumanVerifyBeforeLoadReport(
  reports: readonly VerifyBeforeLoadReport[],
  opts: { allowUnsealed: boolean },
): string {
  const out: string[] = []
  out.push(`phub verify-before-load (${reports.length} path${reports.length === 1 ? "" : "s"})`)
  out.push("")

  let blocked = 0
  let unsealed = 0
  for (const { path, result } of reports) {
    const blocking = result.reasons.filter((r) => r.tier === "block")
    const posture = result.reasons.filter((r) => r.tier === "posture")

    if (result.safe) {
      out.push(`[SAFE]    ${path} — verified, safe to load`)
    } else if (blocking.length > 0) {
      blocked++
      out.push(`[BLOCKED] ${path} — refused`)
    } else if (opts.allowUnsealed) {
      unsealed++
      out.push(`[WARN]    ${path} — unsealed (allowed by --allow-unsealed)`)
    } else {
      unsealed++
      out.push(`[BLOCKED] ${path} — unsealed`)
    }

    for (const r of blocking) out.push(`  [BLOCK]   ${r.code}  ${r.message}`)
    for (const r of posture) out.push(`  [POSTURE] ${r.code}  ${r.message}`)
  }

  out.push("")
  const total = reports.length
  if (blocked === 0 && unsealed === 0) {
    out.push(`Result: ${total}/${total} safe to load.`)
  } else {
    const parts: string[] = []
    if (blocked > 0) parts.push(`${blocked} blocked`)
    if (unsealed > 0) parts.push(`${unsealed} unsealed${opts.allowUnsealed ? " (allowed)" : ""}`)
    out.push(`Result: ${parts.join(", ")} of ${total}.`)
    if (unsealed > 0) {
      out.push(`  Seal unsealed artifacts: phub audit <dir> --update-lock`)
      if (!opts.allowUnsealed) {
        out.push(`  Or allow unsealed (dev / first run): phub verify-before-load … --allow-unsealed`)
      }
    }
  }
  return out.join("\n")
}
