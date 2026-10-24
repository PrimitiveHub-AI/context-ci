/**
 * Wire types for the /api/v1/check endpoint (ADR-0034).
 *
 * Mirrors the Django Ninja schema in `apps/api/checks/api.py`. The
 * backend emits camelCase via `CamelJSONRenderer`, so these match
 * the renderer's output, not the snake_case Python dataclass fields.
 */

export type CheckMode = "content" | "url" | "npx" | "github"

export type CheckSeverity = "info" | "warn" | "fail"

export type CheckVerdictBand = "clean" | "caution" | "suspicious" | "high-risk"

export interface CheckDiffHint {
  line: number | null
  snippet: string
  suggestion: string
  detailTag: string
  /** "Show your work": how to tell a true positive from a false positive
   *  for this pattern (ADR-0041 trust UX). Optional for back-compat. */
  howToJudge?: string
}

export interface CheckVerdictEntry {
  detectorName: string
  threatCategory: string
  cciId: string
  severity: CheckSeverity
  passed: boolean
  summary: string
  detectorVersion: string
  diffHints: CheckDiffHint[]
}

export interface CheckClassCounts {
  malicious: number
  risky: number
  policy: number
  clean: number
}

/** One density-damped group contributing to the signature-risk score.
 *  Keys are camelCase on the wire (authored camelCase in verdict.py's
 *  `top_groups`). */
export interface CheckScoreGroup {
  cciId: string
  detailTag: string
  occurrences: number
  weight: number
  samplePaths: string[]
}

/** The score `derivation` block (verdict.py `score_findings`). This is a
 *  free-form passthrough dict on the wire — the Camel renderer only aliases
 *  pydantic schemas, so these OUTER keys keep their Python snake_case, while
 *  the `top_groups` entries are authored camelCase. Access defensively; the
 *  exact key set is pinned by a contract test in test_check_api.py. */
export interface CheckScoreDerivation {
  rule: string
  engine?: string
  rubric?: string
  // "risky-bounded" branch
  n_risky_findings?: number
  n_risky_groups?: number
  risky_fail_weight?: number
  risky_warn_weight?: number
  raw_penalty?: number
  risky_cap?: number
  capped_penalty?: number
  top_groups?: CheckScoreGroup[]
  // "malicious-dominates" branch
  n_malicious?: number
  base_penalty?: number
  incremental_penalty?: number
}

export interface CheckSummary {
  /** Canonical headline: the signature-risk score (0–100; 100 = no
   *  signature risk). This is NOT a trust/provenance rating — a signature
   *  match is evidence of a pattern, not proof of malice. */
  signatureRiskScore: number
  /** @deprecated back-compat alias of `signatureRiskScore`; will be removed. */
  trustScore: number
  verdictBand: CheckVerdictBand
  passed: boolean
  detectorsRun: number
  detectorsTriggered: number
  failCount: number
  warnCount: number
  /** INFO detector-evaluations (detectors × files that found nothing) —
   *  NOT a count of clean files. See `cleanFiles`. */
  infoCount: number
  /** Count of scanned files whose every verdict was INFO (nothing fired). */
  cleanFiles?: number
  highestSeverity: CheckSeverity
  classCounts?: CheckClassCounts
  derivation?: CheckScoreDerivation
  // Present on `mode=npx`:
  filesScanned?: number
  filesSkippedBinary?: number
  totalUncompressedBytes?: number
  compressedBytes?: number
}

export interface CheckFile {
  path: string
  bytes: number
  verdicts: CheckVerdictEntry[]
}

export interface CheckTargetContent {
  kind: "content"
  displayName: string
  bytes: number
}

export interface CheckTargetUrl {
  kind: "url"
  displayName: string
  url: string
  bytes: number
  maxBytes: number
}

export interface CheckTargetNpm {
  kind: "npm-package"
  displayName: string
  name: string
  version: string
  registry: string
  tarballUrl: string
  integrity: string | null
  shasum: string | null
  fileCount: number
  totalUncompressedBytes: number
  compressedBytes: number
}

export interface CheckTargetGithub {
  kind: "github-repo"
  displayName: string
  name: string
  version: string
  registry: string
  tarballUrl: string
  integrity: string | null
  shasum: string | null
  /** Immutable commit SHA the scan inspected (vs the mutable `version`
   *  branch/ref). `null` when the codeload top-dir didn't carry a full SHA. */
  commitSha?: string | null
  fileCount: number
  totalUncompressedBytes: number
  compressedBytes: number
}

export type CheckTarget =
  | CheckTargetContent
  | CheckTargetUrl
  | CheckTargetNpm
  | CheckTargetGithub

export interface CheckResponse {
  requestId: string
  mode: CheckMode
  target: CheckTarget
  summary: CheckSummary
  files: CheckFile[]
  verdicts: CheckVerdictEntry[]
}
