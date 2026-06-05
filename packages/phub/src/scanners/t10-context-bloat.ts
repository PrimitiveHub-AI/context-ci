/**
 * T10 — Context bloat.
 *
 * TS port of apps/api/scanners/t10_context_bloat.py. Thresholds
 * mirror the Python source byte-for-byte per ADR-0023's lockstep
 * rule.
 */

import {
  type DetectorContext,
  type DiffHint,
  Severity,
  type Verdict,
} from "./types.js"

const OVERSIZED_THRESHOLD_CHARS = 32000
const EXCESSIVE_REPETITION_THRESHOLD = 0.2
const WHITESPACE_STUFFING_THRESHOLD = 0.4
// v0.1.1 (2026-06-04) lowered ratio 500 → 200, raised min-count 2 → 6.
// The 500 floor was over-strict — catalog primitives with 4–6 short
// sections in 2 KB routinely tripped it. Lockstep with
// apps/api/scanners/t10_context_bloat.py § v0.1.1.
const HEADING_PROLIFERATION_RATIO = 200
const HEADING_PROLIFERATION_MIN_COUNT = 6
const MIN_LINES_FOR_WHITESPACE_CHECK = 100
const NON_TRIVIAL_LINE_MIN_CHARS = 50

const H2_RE = /^##\s+\S/gm

// Multi-file callers (phub audit, /check repo scan) populate
// `ctx.filename`. T10's bloat semantics apply to primitives; skip for
// non-primitive files in repo-scan mode. Empty filename (single-blob
// / Forge mode) keeps the original behavior — fires on every input.
const PRIMITIVE_PATH_MARKERS: readonly string[] = [
  "/primitives/",
  "/skills/",
  "/skill/",
  "/prompts/",
  "/agents/",
  "/.claude/skills/",
  "/.cursor/rules/",
]
const PRIMITIVE_BASENAMES: ReadonlySet<string> = new Set([
  "skill.md",
  "agents.md",
  "claude.md",
  "cursor.md",
  "codex.md",
  "system.md",
  "prompt.md",
  "primitive.md",
  ".cursorrules",
])

function looksLikePrimitive(filename: string | undefined): boolean {
  if (!filename) return true // single-blob mode → keep v0.1 behavior.
  const lowered = filename.toLowerCase()
  const basename = lowered.split("/").pop() ?? ""
  if (PRIMITIVE_BASENAMES.has(basename)) return true
  const padded = `/${lowered}/`
  return PRIMITIVE_PATH_MARKERS.some((m) => padded.includes(m))
}

function checkOversized(content: string): DiffHint | null {
  const n = content.length
  if (n <= OVERSIZED_THRESHOLD_CHARS) return null
  return {
    line: 1,
    snippet: `<primitive: ${n} chars; threshold ${OVERSIZED_THRESHOLD_CHARS}>`,
    suggestion: `Primitive body is ${n} chars (≈ ${Math.floor(n / 4)} tokens), exceeding the v0.1 bloat threshold of ${OVERSIZED_THRESHOLD_CHARS} chars. Split into focused smaller primitives, or remove redundant sections.`,
    detailTag: "oversized-primitive",
  }
}

function checkExcessiveRepetition(content: string): DiffHint | null {
  const lines = content.split("\n")
  const nonTrivial = lines
    .map((ln) => ln.trim())
    .filter((ln) => ln.length >= NON_TRIVIAL_LINE_MIN_CHARS)
  if (nonTrivial.length < 10) return null
  const uniqueCount = new Set(nonTrivial).size
  const duplicateCount = nonTrivial.length - uniqueCount
  const ratio = duplicateCount / nonTrivial.length
  if (ratio <= EXCESSIVE_REPETITION_THRESHOLD) return null
  return {
    line: 1,
    snippet: `<${duplicateCount} duplicate lines of ${nonTrivial.length} non-trivial (${Math.round(ratio * 100)}%)>`,
    suggestion: `${Math.round(ratio * 100)}% of non-trivial lines (≥ ${NON_TRIVIAL_LINE_MIN_CHARS} chars) are exact duplicates. Deduplicate or refactor — the agent reads the same instruction multiple times for no benefit.`,
    detailTag: "excessive-repetition",
  }
}

function checkWhitespaceStuffing(content: string): DiffHint | null {
  const lines = content.split("\n")
  if (lines.length < MIN_LINES_FOR_WHITESPACE_CHECK) return null
  const blankCount = lines.filter((ln) => ln.trim().length === 0).length
  const ratio = blankCount / lines.length
  if (ratio <= WHITESPACE_STUFFING_THRESHOLD) return null
  return {
    line: 1,
    snippet: `<${blankCount} blank lines of ${lines.length} (${Math.round(ratio * 100)}%)>`,
    suggestion: `${Math.round(ratio * 100)}% of lines are blank. Visual padding wastes context budget; consolidate sections.`,
    detailTag: "whitespace-stuffing",
  }
}

function checkHeadingProliferation(content: string): DiffHint | null {
  const n = content.length
  if (n < 1000) return null
  H2_RE.lastIndex = 0
  let h2Count = 0
  while (H2_RE.exec(content) !== null) h2Count++
  if (h2Count < HEADING_PROLIFERATION_MIN_COUNT) return null
  const charsPerH2 = n / h2Count
  if (charsPerH2 >= HEADING_PROLIFERATION_RATIO) return null
  return {
    line: 1,
    snippet: `<${h2Count} h2 headings in ${n} chars; ${Math.round(charsPerH2)} chars/h2>`,
    suggestion: `${h2Count} h2 sections in ${n} chars (≈ ${Math.round(charsPerH2)} chars/section) is below the v0.1 floor of ${HEADING_PROLIFERATION_RATIO} chars/h2. Consolidate adjacent sections or split into focused primitives.`,
    detailTag: "heading-proliferation",
  }
}

export class T10ContextBloatDetector {
  readonly name = "t10.context_bloat"
  readonly threatCategory = "T10"
  readonly cciId = "CCI-010"
  readonly detectorVersion = "0.1.1"

  run(ctx: DetectorContext): Verdict {
    // v0.1.1 (2026-06-04): multi-file scan callers pass `filename`;
    // skip T10 when the file isn't a primitive. Single-blob (Forge /
    // mode=content) callers pass undefined filename and keep the
    // original behavior.
    if (!looksLikePrimitive(ctx.filename)) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "Skipped — file is not a primitive (T10 v0.1.1 scope).",
        detectorVersion: this.detectorVersion,
        diffHints: [],
      }
    }

    const hints: DiffHint[] = []
    for (const check of [
      checkOversized,
      checkExcessiveRepetition,
      checkWhitespaceStuffing,
      checkHeadingProliferation,
    ]) {
      const hint = check(ctx.content)
      if (hint !== null) hints.push(hint)
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No context-bloat patterns matched.",
        detectorVersion: this.detectorVersion,
        diffHints: [],
      }
    }
    const plural = hints.length === 1 ? "" : "s"
    return {
      detectorName: this.name,
      threatCategory: this.threatCategory,
      cciId: this.cciId,
      severity: Severity.WARN,
      passed: false,
      summary: `Matched ${hints.length} bloat pattern${plural}; primitive consumes context disproportionately.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
