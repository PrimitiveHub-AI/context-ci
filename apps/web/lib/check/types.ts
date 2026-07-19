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

export interface CheckSummary {
  trustScore: number
  verdictBand: CheckVerdictBand
  passed: boolean
  detectorsRun: number
  detectorsTriggered: number
  failCount: number
  warnCount: number
  infoCount: number
  highestSeverity: CheckSeverity
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
