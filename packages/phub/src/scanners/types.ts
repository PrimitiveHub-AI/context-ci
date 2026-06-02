/**
 * Detector contract shared by all phub scanners.
 *
 * Mirrors apps/api/scanners/types.py + apps/api/scanners/protocol.py
 * but in TS shape. The two implementations are kept aligned by
 * fixture parity; future work: cross-language scanner-conformance
 * suite analogous to docs/trust-contract/conformance/.
 */

export const Severity = {
  INFO: "info",
  WARN: "warn",
  FAIL: "fail",
} as const

export type Severity = (typeof Severity)[keyof typeof Severity]

/**
 * A single match annotation: where in the document the detector fired,
 * a truncated snippet, and a suggestion to the author.
 */
export interface DiffHint {
  /** 1-indexed line number where the match starts */
  line: number
  /** Truncated snippet of the matched text (≤ 120 chars) */
  snippet: string
  /** Suggested remediation in plain English */
  suggestion: string
  /** Short tag identifying which pattern family fired (e.g. "role-hijack") */
  detailTag: string
}

export interface Verdict {
  detectorName: string
  /** Legacy threat category id (T1..T10), back-compat with pre-CCI attestations */
  threatCategory: string
  /** Context CI Top 10 v0.1 stable ID per ADR-0016 */
  cciId: string
  severity: Severity
  passed: boolean
  summary: string
  detectorVersion: string
  diffHints: DiffHint[]
}

export interface DetectorContext {
  /** The raw markdown content to scan (UTF-8 string) */
  content: string
  /** Optional filename for error messages */
  filename?: string
}

export interface Detector {
  readonly name: string
  readonly threatCategory: string
  readonly cciId: string
  readonly detectorVersion: string
  run(ctx: DetectorContext): Verdict
}

export const MAX_HINTS_PER_VERDICT = 10
export const SNIPPET_MAX_CHARS = 120

/** Truncate a string for hint display, appending "…" if cut. */
export function truncateSnippet(s: string): string {
  return s.length > SNIPPET_MAX_CHARS
    ? s.slice(0, SNIPPET_MAX_CHARS) + "…"
    : s
}

/** 1-indexed line number for a character position in `content`. */
export function lineForPosition(content: string, position: number): number {
  let line = 1
  for (let i = 0; i < position && i < content.length; i++) {
    if (content[i] === "\n") line++
  }
  return line
}
