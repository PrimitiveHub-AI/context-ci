/**
 * T4 — Remote content fetching at load time.
 *
 * TS port of apps/api/scanners/t4_remote_fetch.py. Pattern set
 * mirrors the Python source byte-for-byte per ADR-0023 lockstep rule.
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
} from "./markdown-context.js"

const FETCH_AND_INCLUDE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:fetch|download|retrieve|pull|load)\s+(?:the\s+)?(?:contents?\s+of\s+)?https?:\/\/\S+\s+(?:and|then)\s+(?:append|include|add|use|merge|insert|inject)/gim,
    "fetch-and-include",
  ],
  [
    /\b(?:include|inject|append|merge)\s+(?:the\s+(?:contents?|response|body)\s+of\s+)?(?:curl|wget|fetch)\s+\S*https?:\/\//gim,
    "fetch-and-include",
  ],
  [
    /\b(?:read|load)\s+(?:the\s+)?(?:contents?\s+of\s+)?file:\/\/\S+\s+(?:as|into|and)\s+(?:your|the)\s+(?:context|prompt|memory)/gim,
    "fetch-and-include",
  ],
]

const LOAD_TIME_FETCH_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:before\s+(?:you\s+)?(?:respond(?:ing)?|answer(?:ing)?|repl(?:y|ying)|proceed(?:ing)?)|at\s+(?:the\s+)?start\s+of\s+(?:every|each)\s+(?:conversation|session|turn)|on\s+(?:every\s+)?(?:load|read|consume)),?\s+(?:fetch|download|curl|wget|retrieve|pull|load)\s+/gim,
    "load-time-fetch",
  ],
  [
    /\b(?:fetch|download|curl|wget|retrieve)\s+(?:from\s+)?https?:\/\/\S+\s+(?:before|prior\s+to|each\s+time)\s+(?:responding|answering|replying)/gim,
    "load-time-fetch",
  ],
  [
    /\b(?:always|first|initially|on\s+startup),?\s+(?:fetch|download|retrieve|pull)\s+https?:\/\//gim,
    "load-time-fetch",
  ],
]

const AGENT_SIDE_INCLUDE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /<link\s+[^>]*rel\s*=\s*["']?(?:import|preload|prefetch|stylesheet)["']?[^>]*href\s*=\s*["']?https?:\/\//gim,
    "agent-side-include",
  ],
  [
    /<iframe\s+[^>]*src\s*=\s*["']?https?:\/\//gim,
    "agent-side-include",
  ],
  [
    /@import\s+(?:url\()?["']?https?:\/\//gim,
    "agent-side-include",
  ],
  [
    /\b(?:treat|interpret|use)\s+(?:the\s+)?(?:embedded|imported|linked)\s+content\s+as\s+(?:instructions|prompt|context)/gim,
    "agent-side-include",
  ],
]

const ALL_PATTERNS = [
  ...FETCH_AND_INCLUDE_PATTERNS,
  ...LOAD_TIME_FETCH_PATTERNS,
  ...AGENT_SIDE_INCLUDE_PATTERNS,
]

function hintForMatch(content: string, match: RegExpExecArray, tag: string): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: `Remote-fetch instruction (${tag}). The primitive turns into a dynamic loader at runtime — the attacker controls what gets included AFTER the bundle was signed. Remove the fetch instruction or inline the content (then re-sign).`,
    detailTag: tag,
  }
}

export class T4RemoteFetchDetector {
  readonly name = "t4.remote_fetch"
  readonly threatCategory = "T4"
  readonly cciId = "CCI-004"
  readonly detectorVersion = "0.2.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.0 (ADR-0023 lockstep with Python t4 v0.2.0): skip matches
    // inside frontmatter, inline code, or fenced code blocks — these
    // are reference / documentary contexts, not execution instructions.
    const mdCtx = analyzeMarkdownContext(ctx.content)
    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        if (isInAnyCodeOrFrontmatter(match.index, mdCtx)) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
        hints.push(hintForMatch(ctx.content, match, tag))
        if (hints.length >= MAX_HINTS_PER_VERDICT) break outer
        if (match.index === pattern.lastIndex) pattern.lastIndex++
      }
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No remote-fetch patterns matched.",
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
      summary: `Matched ${hints.length} remote-fetch pattern${plural}; primitive turns into a dynamic loader at runtime.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
