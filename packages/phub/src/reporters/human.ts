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
  valid: boolean
  failures: ReadonlyArray<{ code: string; message: string; path?: string }>
  deferredSteps?: readonly string[]
}

export function renderHumanVerifyReport(filename: string, result: VerifyReportShape): string {
  const out: string[] = []
  out.push(`phub verify ${filename}`)
  out.push("")
  if (result.valid) {
    out.push("Trust Bundle verified.")
    if (result.deferredSteps && result.deferredSteps.length > 0) {
      out.push(`  (verification steps deferred in v0.1: ${result.deferredSteps.join(", ")})`)
    }
    return out.join("\n")
  }
  out.push(`Trust Bundle rejected (${result.failures.length} failure(s)):`)
  for (const f of result.failures) {
    const at = f.path ? ` (at ${f.path})` : ""
    out.push(`  [${f.code}] ${f.message}${at}`)
  }
  return out.join("\n")
}
