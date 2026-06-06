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

// v0.1.2 (Round 6 fix 4 — closes FN-013): emoji-density check.
// The v0.1 thresholds (oversized chars, repetition, whitespace,
// heading proliferation) all measure structure; an attacker-built
// primitive padded with consecutive emoji glyphs ("🚀🚀🚀..." x 30
// per line) stays small in chars/h2/whitespace metrics but visually
// hides the actual instruction below the bloat. T10 v0.1.2 flags
// either > 5% emoji density across non-whitespace codepoints OR any
// single line with ≥ 10 consecutive emoji-presentation codepoints.
//
// Codepoint coverage: Misc Symbols + Dingbats (U+2600..U+27BF) and
// the Extended Pictographs blocks (U+1F300..U+1FAFF). This covers
// the v0.2 corpus attack shape; ZWJ-joined emoji sequences and skin
// -tone modifiers are out of scope (their components match the same
// blocks). Lockstep with apps/api/scanners/t10_context_bloat.py § v0.1.2.
const EMOJI_DENSITY_RATIO = 0.05
const EMOJI_CONSECUTIVE_RUN_THRESHOLD = 10

function isEmojiPresentation(cp: number): boolean {
  return (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x1f300 && cp <= 0x1faff)
}

function checkEmojiDensity(content: string): DiffHint | null {
  let emojiCount = 0
  let nonWsCount = 0
  let maxRun = 0
  let curRun = 0
  for (const ch of content) {
    const cp = ch.codePointAt(0) ?? 0
    if (ch === "\n") {
      if (curRun > maxRun) maxRun = curRun
      curRun = 0
      continue
    }
    if (/\s/.test(ch)) {
      curRun = 0
      continue
    }
    nonWsCount++
    if (isEmojiPresentation(cp)) {
      emojiCount++
      curRun++
    } else {
      if (curRun > maxRun) maxRun = curRun
      curRun = 0
    }
  }
  if (curRun > maxRun) maxRun = curRun
  if (nonWsCount === 0) return null
  const densityRatio = emojiCount / nonWsCount
  if (densityRatio <= EMOJI_DENSITY_RATIO && maxRun < EMOJI_CONSECUTIVE_RUN_THRESHOLD) {
    return null
  }
  return {
    line: 1,
    snippet: `<${emojiCount} emoji of ${nonWsCount} non-whitespace codepoints (${Math.round(densityRatio * 100)}%); max consecutive run ${maxRun}>`,
    suggestion: `Emoji density (${Math.round(densityRatio * 100)}%) or longest consecutive emoji run (${maxRun} codepoints) exceeds the v0.2 bloat threshold (${Math.round(EMOJI_DENSITY_RATIO * 100)}% / ${EMOJI_CONSECUTIVE_RUN_THRESHOLD}-emoji run). Visual padding wastes context budget and obscures the primitive's actual instruction.`,
    detailTag: "emoji-density",
  }
}

// v0.1.3 (Round 10 PR 10.3 — closes FN-017 on S-109 markdown-table-
// density bury attack). v0.1.2 thresholds miss a small primitive
// (~6 KB, below the oversized cap) padded with a long innocuous
// markdown table burying the directive at the bottom. Signal: when
// > 50% of non-blank lines are markdown table rows AND the rows are
// structurally repetitive (most share the same column count), the
// primitive uses table bloat to bury an instruction below the
// attention budget. Lockstep with apps/api/scanners/t10_context_bloat.py § v0.1.3.
const TABLE_DENSITY_RATIO = 0.5
const TABLE_REPETITION_RATIO = 0.8
const TABLE_MIN_NON_BLANK_LINES = 30
const TABLE_MIN_TABLE_ROWS = 20
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/

function checkTableDensity(content: string): DiffHint | null {
  const lines = content.split("\n")
  const nonBlank = lines.filter((ln) => ln.trim().length > 0)
  if (nonBlank.length < TABLE_MIN_NON_BLANK_LINES) return null
  const tableRows = nonBlank.filter((ln) => TABLE_ROW_RE.test(ln))
  if (tableRows.length < TABLE_MIN_TABLE_ROWS) return null
  const tableRatio = tableRows.length / nonBlank.length
  if (tableRatio < TABLE_DENSITY_RATIO) return null
  const colCounts = tableRows.map((ln) => (ln.match(/\|/g) ?? []).length)
  const tally = new Map<number, number>()
  for (const c of colCounts) tally.set(c, (tally.get(c) ?? 0) + 1)
  let mostCommonCount = 0
  let mostCommonHits = 0
  for (const [c, n] of tally) {
    if (n > mostCommonHits) {
      mostCommonHits = n
      mostCommonCount = c
    }
  }
  const repetitionRatio = mostCommonHits / colCounts.length
  if (repetitionRatio < TABLE_REPETITION_RATIO) return null
  const tablePct = Math.round(tableRatio * 100)
  const repPct = Math.round(repetitionRatio * 100)
  return {
    line: 1,
    snippet: `<${tableRows.length} of ${nonBlank.length} non-blank lines are table rows (${tablePct}%); ${repPct}% share ${mostCommonCount - 1} columns>`,
    suggestion: `Markdown-table density ${tablePct}% (threshold ${Math.round(TABLE_DENSITY_RATIO * 100)}%) with structural repetition ${repPct}% (threshold ${Math.round(TABLE_REPETITION_RATIO * 100)}%). The primitive is using a long innocuous table to bury its actual instruction; the instruction sits below the attention budget. Move the active directive above the table or split the reference data into a separate primitive.`,
    detailTag: "table-density",
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
  readonly detectorVersion = "0.1.3"

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
      checkEmojiDensity,
      checkTableDensity,
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
