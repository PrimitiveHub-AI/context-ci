/**
 * T1 — Prompt Injection in Markdown.
 *
 * TS port of apps/api/scanners/t1_prompt_injection.py. Pattern set
 * mirrors the Python source byte-for-byte; behavior on shared
 * fixtures must match. See ADR-0023 for the cross-implementation
 * fidelity rule.
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
import { analyzeMarkdownContext, isInAnyCodeOrFrontmatter } from "./markdown-context.js"

// Pattern families that are commonly quoted in teaching content
// (cybersecurity skills, primitives explaining attacks). Skip those
// when inside fence / inline code / frontmatter — they're examples,
// not live injection. The other families (hidden-instructions,
// role-hijack) stay context-unaware because they ARE designed to
// abuse fence-like structures. Lockstep with
// apps/api/scanners/t1_prompt_injection.py § v0.2.0.
const CONTEXT_AWARE_TAGS: ReadonlySet<string> = new Set([
  "override-system-instructions",
  "credential-exfiltration-hint",
])

const OVERRIDE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /ignore\s+(?:all\s+|the\s+|any\s+)?(?:previous|prior|above|preceding)\s+(?:instructions?|prompts?|messages?|rules?|context)/gim,
    "override-system-instructions",
  ],
  [
    /disregard\s+(?:all\s+|the\s+|your\s+|any\s+)?(?:previous|prior|above|system|preceding)\s+(?:instructions?|prompts?|rules?)/gim,
    "override-system-instructions",
  ],
  [
    /forget\s+(?:all\s+|the\s+|everything\s+)?(?:previous|prior|above|preceding|i\s+(?:said|told))/gim,
    "override-system-instructions",
  ],
  [
    /override\s+(?:your\s+|the\s+|all\s+|any\s+)?(?:system|previous|default|original)(?:\s+(?:system|default|previous|original))?\s+(?:prompt|instructions?|rules?)/gim,
    "override-system-instructions",
  ],
]

const ROLE_HIJACK_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\byou\s+are\s+(?:now\s+|from\s+now\s+on\s+)?(?:DAN|do\s+anything\s+now|jailbroken|unrestricted|in\s+developer\s+mode|an?\s+amoral)/gim,
    "role-hijack",
  ],
  [
    /\bact\s+as\s+(?:if\s+you\s+(?:were\s+)?|a\s+|an\s+)?(?:unrestricted|jailbroken|uncensored|amoral|evil|malicious)\b/gim,
    "role-hijack",
  ],
  [
    /\bpretend\s+(?:to\s+be\s+(?:unrestricted|jailbroken|amoral|evil|without\s+restrictions)|(?:that\s+)?you\s+(?:are\s+(?:unrestricted|jailbroken)|have\s+no\s+rules))/gim,
    "role-hijack",
  ],
  [
    /\bfrom\s+now\s+on,?\s+(?:you\s+are\s+(?:not\s+|no\s+longer\s+)?bound|your\s+responses?\s+must|your\s+behavior\s+will)/gim,
    "role-hijack",
  ],
]

const HIDDEN_INSTRUCTION_PATTERNS: Array<readonly [RegExp, string]> = [
  [/<!--\s*(?:instructions?|prompt|system)\b/gim, "hidden-instructions"],
  [/^\s*\[SYSTEM\]\s*:/gim, "hidden-instructions"],
  [/^\s*\[INSTRUCTIONS?\]\s*:/gim, "hidden-instructions"],
  [/```\s*(?:system|instructions?|prompt)\s*$/gim, "hidden-instructions"],
]

const EXFIL_HINT_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bsend\s+(?:your\s+|the\s+|all\s+)?(?:env|environment|secret|secrets|token|tokens|credential|credentials|api[\s_-]?key|api[\s_-]?keys|password|passwords)(?:\s+(?:vars?|variables?|values?|files?|keys?))?\s+to\b/gim,
    "credential-exfiltration-hint",
  ],
  [
    /\bemail\s+(?:your\s+|the\s+|all\s+)?(?:env|environment|secret|secrets|token|tokens|credential|credentials|api[\s_-]?key|api[\s_-]?keys)(?:\s+(?:vars?|variables?|values?))?\s+to\b/gim,
    "credential-exfiltration-hint",
  ],
  [
    /\b(?:exfiltrate|leak)\s+(?:your\s+|the\s+)?(?:env|secrets?|tokens?|credentials?|api[\s_-]?keys?)/gim,
    "credential-exfiltration-hint",
  ],
]

const ALL_PATTERNS = [
  ...OVERRIDE_PATTERNS,
  ...ROLE_HIJACK_PATTERNS,
  ...HIDDEN_INSTRUCTION_PATTERNS,
  ...EXFIL_HINT_PATTERNS,
]

function hintForMatch(
  content: string,
  match: RegExpExecArray,
  tag: string,
): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: `Remove or rephrase (${tag}); this pattern is consistent with prompt injection.`,
    detailTag: tag,
  }
}

export class T1PromptInjectionDetector {
  readonly name = "t1.prompt_injection"
  readonly threatCategory = "T1"
  readonly cciId = "CCI-001"
  readonly detectorVersion = "0.2.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.0 (2026-06-04): selective markdown-context awareness.
    // See CONTEXT_AWARE_TAGS comment above for the discrimination.
    const mdCtx = analyzeMarkdownContext(ctx.content)

    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        if (
          CONTEXT_AWARE_TAGS.has(tag) &&
          isInAnyCodeOrFrontmatter(match.index, mdCtx)
        ) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
        hints.push(hintForMatch(ctx.content, match, tag))
        if (hints.length >= MAX_HINTS_PER_VERDICT) break outer
        // Guard against zero-width matches infinite-looping
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
        summary: "No prompt-injection patterns matched.",
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
      summary: `Matched ${hints.length} prompt-injection pattern${plural}; review before signing.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
