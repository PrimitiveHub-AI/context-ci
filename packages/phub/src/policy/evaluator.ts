/**
 * Policy evaluation algorithm (spec § 6).
 *
 * Input:  raw verdicts from `phub scan`, a policy, the scan target filename.
 * Output: post-policy verdicts (some suppressed, some severity-adjusted,
 *         findings filtered by allow rules) + the final exit code.
 *
 * Pure function — no side effects. Easy to test against the
 * scenarios/*.json conformance fixtures.
 */

import { Severity, type Verdict, type DiffHint } from "../scanners/types.js"

import { matchAnyGlob } from "./glob.js"
import {
  type Policy,
  type PolicyAllowEntry,
  type PolicyAllowRule,
  type PolicySeverity,
} from "./types.js"

export interface AllowedHint {
  hint: DiffHint
  allowEntry: PolicyAllowEntry
}

export interface PolicyAdjustedVerdict {
  /** Verdict after suppression + severity override + hint filtering */
  verdict: Verdict
  /** Original verdict before adjustment (for reporters that want diff context) */
  originalVerdict: Verdict
  /** Hints suppressed by allow entries, with the matching reason */
  allowedHints: readonly AllowedHint[]
  /** True when the rule's severity was 'off' (verdict fully suppressed) */
  suppressedByOff: boolean
  /** Severity per policy (after override) */
  policySeverity: PolicySeverity
}

export interface PolicyEvaluation {
  /** All verdicts in input order, with adjustment metadata */
  adjusted: readonly PolicyAdjustedVerdict[]
  /** Process exit code per spec § 6 */
  exitCode: 0 | 1
  /** Summary counts (used by the CI integration + tests) */
  summary: {
    suppressedFindingsCount: number
    survivingFailVerdicts: number
    survivingWarningVerdicts: number
    survivingNoteVerdicts: number
    fullySuppressedVerdicts: number
  }
}

/* ------------------------------------------------------------------ */
/* allow-match predicate                                              */
/* ------------------------------------------------------------------ */

function ruleSelectorMatches(selector: PolicyAllowRule, v: Verdict): boolean {
  return (
    selector.id === "*" ||
    selector.id === v.cciId ||
    selector.id === v.detectorName ||
    selector.id === v.threatCategory
  )
}

function findMatchingAllow(
  v: Verdict,
  h: DiffHint,
  filename: string,
  allow: readonly PolicyAllowEntry[],
): PolicyAllowEntry | null {
  for (const entry of allow) {
    if (!matchAnyGlob(entry.files, filename)) continue
    for (const sel of entry.rules) {
      if (!ruleSelectorMatches(sel, v)) continue
      const tags = sel.detail_tags
      if (tags === undefined || tags.length === 0 || tags.includes(h.detailTag)) {
        return entry
      }
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* main entrypoint                                                    */
/* ------------------------------------------------------------------ */

export function applyPolicy(
  verdicts: readonly Verdict[],
  policy: Policy,
  filename: string,
): PolicyEvaluation {
  const adjusted: PolicyAdjustedVerdict[] = []

  for (const original of verdicts) {
    const ruleConfig = policy.rules[original.cciId]
    const policySeverity: PolicySeverity = ruleConfig?.severity ?? "error"

    // severity: off → fully suppress
    if (policySeverity === "off") {
      adjusted.push({
        verdict: {
          ...original,
          severity: Severity.INFO,
          passed: true,
          summary: `(${original.cciId}) disabled by policy (severity: off)`,
          diffHints: [],
        },
        originalVerdict: original,
        allowedHints: [],
        suppressedByOff: true,
        policySeverity,
      })
      continue
    }

    // Filter hints through the allow rules
    const surviving: DiffHint[] = []
    const allowed: AllowedHint[] = []
    for (const h of original.diffHints) {
      const match = findMatchingAllow(original, h, filename, policy.allow)
      if (match !== null) allowed.push({ hint: h, allowEntry: match })
      else surviving.push(h)
    }

    if (original.passed || (surviving.length === 0 && original.diffHints.length > 0)) {
      // Either the verdict was already passing, OR every hint was allowed
      adjusted.push({
        verdict: {
          ...original,
          severity: Severity.INFO,
          passed: true,
          summary:
            allowed.length > 0
              ? `${original.summary} — all ${allowed.length} finding(s) permitted by policy`
              : original.summary,
          diffHints: [],
        },
        originalVerdict: original,
        allowedHints: allowed,
        suppressedByOff: false,
        policySeverity,
      })
      continue
    }

    // Some hints survived — apply the severity override
    const newSeverity =
      policySeverity === "error"
        ? Severity.FAIL
        : policySeverity === "warning"
          ? Severity.WARN
          : Severity.INFO

    adjusted.push({
      verdict: {
        ...original,
        severity: newSeverity,
        passed: false,
        summary:
          allowed.length > 0
            ? `${original.summary} (${allowed.length} permitted by policy)`
            : original.summary,
        diffHints: surviving,
      },
      originalVerdict: original,
      allowedHints: allowed,
      suppressedByOff: false,
      policySeverity,
    })
  }

  // Compute summary + exit code.
  // suppressedFindingsCount counts findings the policy hid from CI:
  //   - hints matched by an allow entry, OR
  //   - hints attached to a verdict whose rule was disabled (severity: off)
  let suppressedFindingsCount = 0
  let fullySuppressedVerdicts = 0
  let survivingFailVerdicts = 0
  let survivingWarningVerdicts = 0
  let survivingNoteVerdicts = 0
  for (const a of adjusted) {
    suppressedFindingsCount += a.allowedHints.length
    if (a.suppressedByOff) {
      fullySuppressedVerdicts++
      suppressedFindingsCount += a.originalVerdict.diffHints.length
    }
    if (!a.verdict.passed) {
      if (a.verdict.severity === Severity.FAIL) survivingFailVerdicts++
      else if (a.verdict.severity === Severity.WARN) survivingWarningVerdicts++
      else if (a.verdict.severity === Severity.INFO) survivingNoteVerdicts++
    }
  }

  const exitCode: 0 | 1 =
    survivingFailVerdicts > 0 || (policy.strict && survivingWarningVerdicts > 0) ? 1 : 0

  return {
    adjusted,
    exitCode,
    summary: {
      suppressedFindingsCount,
      survivingFailVerdicts,
      survivingWarningVerdicts,
      survivingNoteVerdicts,
      fullySuppressedVerdicts,
    },
  }
}
