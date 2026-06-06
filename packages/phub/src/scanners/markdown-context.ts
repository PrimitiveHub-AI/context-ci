/**
 * Markdown context analyzer — v0.2.1 (ADR-0035).
 *
 * Pure function that classifies character offsets in a markdown document
 * into one of three context types the detector roster cares about:
 *
 *   - frontmatter (YAML block at file head delimited by ^---$ ... ^---$)
 *   - fenced code block (delimited by ^``` or ^~~~ runs)
 *   - inline code span (single-line `...` or ``...`` etc.)
 *
 * Zero runtime deps. Hand-rolled to match the markdown subset the
 * threat model cares about — NOT a general-purpose parser. Edge cases
 * NOT handled (and documented as v0.2.x follow-up):
 *   - indented code blocks (4-space indent, no fence)
 *   - HTML <code> embedded in markdown
 *   - nested fences with different markers
 *   - multi-line inline code (spec-permitted but vanishingly rare)
 *
 * Lockstep partner: apps/api/scanners/markdown_context.py — both sides
 * MUST produce identical boundaries for the same input. Parity is
 * enforced via the corpus measurement scripts (ADR-0032).
 */

/** Range of offsets [start, end). Half-open: end is exclusive. */
export type OffsetRange = readonly [number, number]

export interface MarkdownContext {
  /** Character offset where frontmatter ends (exclusive). 0 if no frontmatter. */
  frontmatterEndOffset: number
  /** Fenced code blocks, in document order, non-overlapping. */
  fencedRanges: ReadonlyArray<OffsetRange>
  /** Inline code spans, in document order, non-overlapping with each other. */
  inlineCodeRanges: ReadonlyArray<OffsetRange>
}

/**
 * Analyze the markdown content. Returns context boundaries.
 *
 * Algorithm:
 *   1. Detect frontmatter: file starts with "---\n" → scan for next
 *      "\n---\n" or "\n---" at EOF. End-offset is the byte after the
 *      closing "---" line.
 *   2. Walk the document line-by-line (skipping frontmatter region).
 *      Track fenced-code state. A fence opens with ^```* or ^~~~* and
 *      closes with the same marker. Ranges include the fence markers
 *      themselves so a detector checking "is this match inside a fence"
 *      gets the right answer for content on the fence-marker lines too.
 *   3. For non-fenced lines, scan character-by-character for backtick
 *      runs. A run of N backticks opens an inline span; the next
 *      same-length run on the same line closes it. Mismatched / unclosed
 *      runs are ignored (per CommonMark behavior).
 */
export function analyzeMarkdownContext(content: string): MarkdownContext {
  const frontmatterEndOffset = detectFrontmatter(content)
  const fencedRanges = detectFencedRanges(content, frontmatterEndOffset)
  const inlineCodeRanges = detectInlineCodeRanges(content, frontmatterEndOffset, fencedRanges)
  return { frontmatterEndOffset, fencedRanges, inlineCodeRanges }
}

/**
 * Find the byte offset where the YAML frontmatter ends, or 0 if none.
 *
 * Recognized shapes:
 *   ---\n
 *   ...lines...
 *   ---\n      (or ---$ at EOF)
 *
 * Frontmatter MUST be the very first thing in the file (no leading
 * blank lines, no BOM handling — BOM is on the caller).
 */
function detectFrontmatter(content: string): number {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return 0
  // Find the closing "---" line after the opening.
  const startOfBody = content.indexOf("\n", 0) + 1
  let pos = startOfBody
  while (pos < content.length) {
    const lineEnd = nextLineBreakOrEnd(content, pos)
    const line = content.slice(pos, lineEnd).replace(/\r$/, "")
    if (line === "---") {
      // End of frontmatter — return offset of next line.
      if (lineEnd >= content.length) return content.length
      // Step over the line break after "---".
      return lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
    }
    pos = lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
  }
  // Unclosed frontmatter — treat as no frontmatter to avoid swallowing
  // the whole document.
  return 0
}

function nextLineBreakOrEnd(content: string, from: number): number {
  for (let i = from; i < content.length; i++) {
    if (content[i] === "\n") return i
    if (content[i] === "\r" && content[i + 1] === "\n") return i
  }
  return content.length
}

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})\s*([^`\n]*)$/

/**
 * Walk the document and collect fenced code regions.
 *
 * A fence opens with ```* or ~~~* at line start (≤ 3 spaces of indent
 * permitted per CommonMark). The closing fence MUST match the marker
 * char and have ≥ the same length.
 *
 * Ranges returned are inclusive of the fence-marker lines.
 */
function detectFencedRanges(content: string, skipUntil: number): OffsetRange[] {
  const ranges: OffsetRange[] = []
  let pos = skipUntil
  while (pos < content.length) {
    const lineEnd = nextLineBreakOrEnd(content, pos)
    const line = content.slice(pos, lineEnd).replace(/\r$/, "")
    const m = FENCE_RE.exec(line)
    if (m) {
      const marker = m[2]!
      const markerChar = marker[0]!
      const markerLen = marker.length
      const rangeStart = pos
      // Walk forward looking for the closing fence.
      let cursor = lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
      let closed = false
      while (cursor < content.length) {
        const innerLineEnd = nextLineBreakOrEnd(content, cursor)
        const innerLine = content.slice(cursor, innerLineEnd).replace(/\r$/, "")
        const closeMatch = innerLine.match(new RegExp(`^( {0,3})(${markerChar === "`" ? "`" : "~"}{${markerLen},})\\s*$`))
        if (closeMatch) {
          const stepOver = innerLineEnd + (content[innerLineEnd] === "\r" && content[innerLineEnd + 1] === "\n" ? 2 : 1)
          ranges.push([rangeStart, stepOver])
          pos = stepOver
          closed = true
          break
        }
        cursor = innerLineEnd + (content[innerLineEnd] === "\r" && content[innerLineEnd + 1] === "\n" ? 2 : 1)
      }
      if (!closed) {
        // Unclosed fence — treat as fenced through EOF (CommonMark behavior).
        ranges.push([rangeStart, content.length])
        return ranges
      }
    } else {
      pos = lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
    }
  }
  return ranges
}

/**
 * Find inline code spans in non-fenced, non-frontmatter regions.
 *
 * A span of N backticks opens an inline span; the next same-length
 * run of backticks on the same line closes it. Mismatched or unclosed
 * runs are ignored (CommonMark behavior).
 *
 * Single-line constraint: this v0.2.1 analyzer does NOT recognize
 * multi-line inline code (CommonMark permits it but it's vanishingly
 * rare in the corpus we care about).
 */
function detectInlineCodeRanges(
  content: string,
  skipUntil: number,
  fencedRanges: ReadonlyArray<OffsetRange>,
): OffsetRange[] {
  const ranges: OffsetRange[] = []
  let pos = skipUntil
  while (pos < content.length) {
    const lineEnd = nextLineBreakOrEnd(content, pos)
    // Skip lines whose start is inside any fenced range.
    if (isInRanges(pos, fencedRanges)) {
      pos = lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
      continue
    }
    scanLineForInlineCode(content, pos, lineEnd, ranges)
    pos = lineEnd + (content[lineEnd] === "\r" && content[lineEnd + 1] === "\n" ? 2 : 1)
  }
  return ranges
}

function scanLineForInlineCode(
  content: string,
  lineStart: number,
  lineEnd: number,
  out: OffsetRange[],
): void {
  let i = lineStart
  while (i < lineEnd) {
    if (content[i] === "`") {
      // Count the run length.
      let runStart = i
      while (i < lineEnd && content[i] === "`") i++
      const runLen = i - runStart
      // Find the matching closing run of the same length on this line.
      let j = i
      while (j < lineEnd) {
        if (content[j] === "`") {
          let closeRunStart = j
          while (j < lineEnd && content[j] === "`") j++
          if (j - closeRunStart === runLen) {
            out.push([runStart, j])
            break
          }
        } else {
          j++
        }
      }
      // If no close found, leave i past the opening run; the orphan
      // backticks are treated as literal text.
    } else {
      i++
    }
  }
}

function isInRanges(offset: number, ranges: ReadonlyArray<OffsetRange>): boolean {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) return true
  }
  return false
}

/** True iff `offset` is inside the frontmatter block. */
export function isInFrontmatter(offset: number, ctx: MarkdownContext): boolean {
  return offset < ctx.frontmatterEndOffset
}

/** True iff `offset` is inside any fenced code block. */
export function isInFence(offset: number, ctx: MarkdownContext): boolean {
  return isInRanges(offset, ctx.fencedRanges)
}

/**
 * Return the fence range that contains `offset`, or `null` if the
 * offset is outside every fence. Lockstep partner:
 * `apps/api/scanners/markdown_context.py::fence_containing`.
 */
export function fenceContaining(offset: number, ctx: MarkdownContext): OffsetRange | null {
  for (const r of ctx.fencedRanges) {
    if (offset >= r[0] && offset <= r[1]) return r
  }
  return null
}

/** True iff `offset` is inside any inline code span. */
export function isInInlineCode(offset: number, ctx: MarkdownContext): boolean {
  return isInRanges(offset, ctx.inlineCodeRanges)
}

/**
 * Convenience for detectors that opt into the v0.2.1 set: skip
 * frontmatter + inline code + fenced code. Detectors that want a
 * different subset (e.g., CCI-007 v0.2.1 skips ONLY frontmatter)
 * compose the individual predicates instead.
 *
 * v0.2.2 (Round 2 lockstep, 2026-06-05): accepts an optional `end`
 * offset so range-spanning matches are caught. The canonical
 * motivating case is CCI-005's install-instruction regex, which
 * matches "Install via `pip ..." — start outside inline code, end
 * inside it. Without the range check the match fires; with it, the
 * span-into-code is recognized as documentary context. Detectors
 * that pass only `offset` keep v0.2.1 single-point semantics.
 */
export function isInAnyCodeOrFrontmatter(
  offset: number,
  ctx: MarkdownContext,
  end?: number,
): boolean {
  if (isInFrontmatter(offset, ctx) || isInFence(offset, ctx) || isInInlineCode(offset, ctx)) {
    return true
  }
  if (end !== undefined && end > offset) {
    const tail = end - 1
    if (isInFrontmatter(tail, ctx) || isInFence(tail, ctx) || isInInlineCode(tail, ctx)) {
      return true
    }
  }
  return false
}
