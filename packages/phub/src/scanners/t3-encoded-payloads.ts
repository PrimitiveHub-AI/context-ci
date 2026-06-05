/**
 * T3 — Encoded payloads.
 *
 * TS port of apps/api/scanners/t3_encoded_payloads.py per ADR-0023's
 * lockstep parity rule. Pattern thresholds + regex shapes mirror the
 * Python source byte-for-byte.
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
import {
  analyzeMarkdownContext,
  isInAnyCodeOrFrontmatter,
  type MarkdownContext,
} from "./markdown-context.js"

const MIN_BASE64_LEN = 80
const MIN_HEX_LEN = 80

const BASE64_RE = new RegExp(`\\b[A-Za-z0-9+/]{${MIN_BASE64_LEN},}={0,2}\\b`, "g")
const HEX_RE = new RegExp(`\\b[a-fA-F0-9]{${MIN_HEX_LEN},}\\b`, "g")

const DECODE_AND_EXECUTE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:base64[\s_-]?decode|b64decode|atob|from_base64|decode\s+base64)\s+(?:the\s+|this\s+|following\s+)?.{0,40}(?:and\s+(?:run|execute|eval|exec)|then\s+(?:run|execute|eval|exec))/gim,
    "decode-and-execute",
  ],
  // v0.2.2 (Round 2 — closes corpus FN on S-019 "decode the following
  // base64 string and run"). Widened the article slot from a single
  // optional article (the/this/following) to up to 30 chars of word/
  // whitespace so multi-word noun phrases between `decode` and the
  // format keyword (e.g. "the following base64 STRING") still match.
  [
    /\b(?:decode|deobfuscate)\s+[\w\s]{0,30}\b(?:hex|base64|payload|blob)\b.{0,80}?\s+(?:and|then)\s+(?:run|execute|eval|exec)/gim,
    "decode-and-execute",
  ],
  // v0.2.2 — closes corpus FN on S-021 "Run the result of decoding hex
  // on the following payload". Added `decod\w*` so participle / gerund
  // forms (decoding, decoded) match alongside the bare verb.
  [
    /\b(?:run|exec|eval)\s+(?:the\s+)?(?:result|output|decoded)\s+of\s+(?:base64|hex|decod\w*)/gim,
    "decode-and-execute",
  ],
]

const ROT13_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:rot13|caesar[\s_-]?cipher|shift[\s_-]?by[\s_-]?13)\s+(?:the\s+|this\s+|following\s+).{0,40}(?:and|then)\s+(?:run|execute|eval|read|follow)/gim,
    "rot13-instruction",
  ],
  [
    /\b(?:apply|decode)\s+rot13\s+(?:to\s+)?(?:the\s+|this\s+|following\s+)/gim,
    "rot13-instruction",
  ],
]

const ALL_INSTRUCTION_PATTERNS = [...DECODE_AND_EXECUTE_PATTERNS, ...ROT13_PATTERNS]

function scanLongEncodedBlobs(content: string, mdCtx: MarkdownContext): DiffHint[] {
  const hints: DiffHint[] = []
  const blobPatterns: Array<readonly [RegExp, string, string]> = [
    [BASE64_RE, "base64-long-blob", "base64"],
    [HEX_RE, "hex-long-blob", "hex"],
  ]
  for (const [pattern, tag, label] of blobPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (hints.length >= MAX_HINTS_PER_VERDICT) return hints
      // v0.2.0 (ADR-0023 lockstep with Python t3 v0.2.0): skip blobs
      // inside frontmatter / inline code / fenced code blocks.
      if (isInAnyCodeOrFrontmatter(match.index, mdCtx, match.index + match[0].length)) {
        if (match.index === pattern.lastIndex) pattern.lastIndex++
        continue
      }
      const raw = match[0]
      hints.push({
        line: lineForPosition(content, match.index),
        snippet: `<${label} ${raw.length} chars: ${truncateSnippet(raw)}>`,
        suggestion: `Long encoded blob (${tag}). If this is example data, wrap it in a code fence and add a comment explaining what it decodes to. If this is a real payload an agent is meant to decode + execute, remove it — Trust Bundles must declare what content does.`,
        detailTag: tag,
      })
      if (match.index === pattern.lastIndex) pattern.lastIndex++
    }
  }
  return hints
}

function scanInstructions(content: string, mdCtx: MarkdownContext): DiffHint[] {
  const hints: DiffHint[] = []
  outer: for (const [pattern, tag] of ALL_INSTRUCTION_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (hints.length >= MAX_HINTS_PER_VERDICT) break outer
      // v0.2.0 (ADR-0023 lockstep): skip instruction patterns inside
      // frontmatter / inline code / fenced code blocks.
      if (isInAnyCodeOrFrontmatter(match.index, mdCtx, match.index + match[0].length)) {
        if (match.index === pattern.lastIndex) pattern.lastIndex++
        continue
      }
      hints.push({
        line: lineForPosition(content, match.index),
        snippet: truncateSnippet(match[0]),
        suggestion: `Decode-and-execute instruction (${tag}). The primitive instructs the agent to decode hidden content and run it — this is the T3 attack shape. Remove the instruction or rephrase as a non-actionable description.`,
        detailTag: tag,
      })
      if (match.index === pattern.lastIndex) pattern.lastIndex++
    }
  }
  return hints
}

export class T3EncodedPayloadsDetector {
  readonly name = "t3.encoded_payloads"
  readonly threatCategory = "T3"
  readonly cciId = "CCI-003"
  readonly detectorVersion = "0.2.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    const mdCtx = analyzeMarkdownContext(ctx.content)
    hints.push(...scanLongEncodedBlobs(ctx.content, mdCtx))
    if (hints.length < MAX_HINTS_PER_VERDICT) {
      const remaining = MAX_HINTS_PER_VERDICT - hints.length
      hints.push(...scanInstructions(ctx.content, mdCtx).slice(0, remaining))
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No encoded-payload patterns matched.",
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
      summary: `Matched ${hints.length} encoded-payload pattern${plural}; hidden content invisible to human reviewers.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
