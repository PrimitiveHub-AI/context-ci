/**
 * T2 — Unicode Steganography.
 *
 * TS port of apps/api/scanners/t2_unicode_steganography.py. The
 * codepoint sets and script ranges are byte-equivalent to Python.
 *
 * JS regex \w doesn't match Unicode letters by default; we use
 * /[\p{L}\p{N}_]+/gu to mirror Python's `\w+` under re.UNICODE.
 */

import {
  type DetectorContext,
  type DiffHint,
  MAX_HINTS_PER_VERDICT,
  Severity,
  truncateSnippet,
  type Verdict,
  lineForPosition,
} from "./types.js"

// Invisible / bidi-control codepoints. Each entry: char → [name, tag].
const INVISIBLE_CHARS: ReadonlyMap<string, readonly [string, string]> = new Map([
  ["​", ["ZERO WIDTH SPACE (U+200B)", "zero-width-invisible"]],
  ["‌", ["ZERO WIDTH NON-JOINER (U+200C)", "zero-width-invisible"]],
  ["‍", ["ZERO WIDTH JOINER (U+200D)", "zero-width-invisible"]],
  ["⁠", ["WORD JOINER (U+2060)", "zero-width-invisible"]],
  ["﻿", ["ZERO WIDTH NO-BREAK SPACE / BOM (U+FEFF)", "zero-width-invisible"]],
  ["‪", ["LEFT-TO-RIGHT EMBEDDING (U+202A)", "bidi-control"]],
  ["‫", ["RIGHT-TO-LEFT EMBEDDING (U+202B)", "bidi-control"]],
  ["‬", ["POP DIRECTIONAL FORMATTING (U+202C)", "bidi-control"]],
  ["‭", ["LEFT-TO-RIGHT OVERRIDE (U+202D)", "bidi-control"]],
  ["‮", ["RIGHT-TO-LEFT OVERRIDE (U+202E)", "bidi-control"]],
  ["⁦", ["LEFT-TO-RIGHT ISOLATE (U+2066)", "bidi-control"]],
  ["⁧", ["RIGHT-TO-LEFT ISOLATE (U+2067)", "bidi-control"]],
  ["⁨", ["FIRST STRONG ISOLATE (U+2068)", "bidi-control"]],
  ["⁩", ["POP DIRECTIONAL ISOLATE (U+2069)", "bidi-control"]],
])

const TAG_RANGE_START = 0xe0000
const TAG_RANGE_END = 0xe007f

const LATIN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0041, 0x005a],
  [0x0061, 0x007a],
  [0x00c0, 0x024f],
]
const CYRILLIC_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0400, 0x04ff],
  [0x0500, 0x052f],
]
const GREEK_RANGES: ReadonlyArray<readonly [number, number]> = [[0x0370, 0x03ff]]

// Mirror Python `\w+` under re.UNICODE — letters + numbers + underscore.
const WORD_RE = /[\p{L}\p{N}_]+/gu

function scriptFor(codepoint: number): "Latin" | "Cyrillic" | "Greek" | null {
  for (const [lo, hi] of LATIN_RANGES) if (codepoint >= lo && codepoint <= hi) return "Latin"
  for (const [lo, hi] of CYRILLIC_RANGES) if (codepoint >= lo && codepoint <= hi) return "Cyrillic"
  for (const [lo, hi] of GREEK_RANGES) if (codepoint >= lo && codepoint <= hi) return "Greek"
  return null
}

function scanInvisibleAndTagChars(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  // Iterate by code units; iterate using a for-of for Unicode-aware codepoint
  // iteration when checking the tag range (which lives above the BMP).
  let position = 0
  for (const ch of content) {
    if (hints.length >= MAX_HINTS_PER_VERDICT) break
    const charLen = ch.length // 1 for BMP, 2 for surrogate pairs
    const entry = INVISIBLE_CHARS.get(ch)
    if (entry !== undefined) {
      const [name, tag] = entry
      hints.push({
        line: lineForPosition(content, position),
        snippet: `<invisible: ${name}>`,
        suggestion: `Remove the hidden codepoint (${tag}); no legitimate use in a primitive document.`,
        detailTag: tag,
      })
    } else {
      const cp = ch.codePointAt(0)
      if (cp !== undefined && cp >= TAG_RANGE_START && cp <= TAG_RANGE_END) {
        hints.push({
          line: lineForPosition(content, position),
          snippet: `<tag-char: U+${cp.toString(16).toUpperCase().padStart(4, "0")}>`,
          suggestion: "Remove tag-range codepoint (U+E0000-U+E007F); used for steganographic encoding.",
          detailTag: "tag-character",
        })
      }
    }
    position += charLen
  }
  return hints
}

function scanMixedScriptWords(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  WORD_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WORD_RE.exec(content)) !== null) {
    if (hints.length >= MAX_HINTS_PER_VERDICT) break
    const word = match[0]
    if (word.length < 2) continue
    const scripts = new Set<string>()
    for (const ch of word) {
      const cp = ch.codePointAt(0)
      if (cp === undefined) continue
      const s = scriptFor(cp)
      if (s !== null) scripts.add(s)
    }
    if (scripts.has("Latin") && (scripts.has("Cyrillic") || scripts.has("Greek"))) {
      const sortedScripts = [...scripts].sort()
      // Show the word with codepoints visible (mirrors Python repr() minus quotes).
      const repr = [...word]
        .map((c) => {
          const cp = c.codePointAt(0) ?? 0
          if (cp < 0x80 && cp >= 0x20) return c
          return `\\u{${cp.toString(16)}}`
        })
        .join("")
      hints.push({
        line: lineForPosition(content, match.index),
        snippet: truncateSnippet(repr),
        suggestion: `Word mixes scripts ${JSON.stringify(sortedScripts)} — likely a homoglyph attack impersonating an ASCII identifier.`,
        detailTag: "mixed-script-confusable",
      })
    }
    if (match.index === WORD_RE.lastIndex) WORD_RE.lastIndex++
  }
  return hints
}

export class T2UnicodeSteganographyDetector {
  readonly name = "t2.unicode_steganography"
  readonly threatCategory = "T2"
  readonly cciId = "CCI-002"
  readonly detectorVersion = "0.1.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    hints.push(...scanInvisibleAndTagChars(ctx.content))
    if (hints.length < MAX_HINTS_PER_VERDICT) {
      const remaining = MAX_HINTS_PER_VERDICT - hints.length
      hints.push(...scanMixedScriptWords(ctx.content).slice(0, remaining))
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No Unicode-steganography patterns matched.",
        detectorVersion: this.detectorVersion,
        diffHints: [],
      }
    }

    const plural = hints.length === 1 ? "" : "s"
    return {
      detectorName: this.name,
      threatCategory: this.threatCategory,
      cciId: this.cciId,
      severity: Severity.FAIL,
      passed: false,
      summary: `Matched ${hints.length} Unicode-steganography pattern${plural}; hidden content invisible to human reviewers.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
