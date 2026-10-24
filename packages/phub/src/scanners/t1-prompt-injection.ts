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
import {
  analyzeMarkdownContext,
  isCodeArtifact,
  isInAnyCodeOrFrontmatter,
} from "./markdown-context.js"
import { isInQuotedPhrase } from "./semantic-context.js"

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

// v0.2.3 (RC3). Syntactic-carrier families whose attack vector IS a
// fence-like structure. They stay a hard FAIL even in a code artifact —
// only the prose families above get the code-artifact down-weight.
// Lockstep with apps/api/scanners/t1_prompt_injection.py § v0.2.3.
const SYNTACTIC_CARRIER_TAGS: ReadonlySet<string> = new Set([
  "hidden-instructions",
  "role-hijack",
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
  // v0.2.2 (Round 13 PR 13.3 — closes FN-025): multilingual
  // override-system phrasebook (Chinese + Russian). Lockstep with
  // apps/api/scanners/t1_prompt_injection.py § v0.2.2.
  [
    /(?:请\s*)?(?:忽略|无视|放弃|抛弃|跳过|绕过)\s*(?:之前的?|先前的?|上面的?|前面的?|系统|默认|原始)?\s*(?:指令|提示词?|规则|限制|约束|配置)/gim,
    "override-system-instructions",
  ],
  [
    /(?:игнорируй(?:те)?|забудь(?:те)?|отмени(?:те)?|отброс(?:ь|ьте))\s+(?:все\s+)?(?:предыдущие|предыдущих|прежние|системные|любые)\s+(?:инструкции|указания|правила|сообщения|подсказки)/gim,
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
  readonly detectorVersion = "0.2.3"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.0 (2026-06-04): selective markdown-context awareness.
    // See CONTEXT_AWARE_TAGS comment above for the discrimination.
    const mdCtx = analyzeMarkdownContext(ctx.content)

    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        const matchEnd = match.index + match[0].length
        if (
          CONTEXT_AWARE_TAGS.has(tag) &&
          isInAnyCodeOrFrontmatter(match.index, mdCtx)
        ) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
        // v0.2.1 (Round 6 — closes FP-014): override-system-instructions
        // matches wrapped in paired "..." / '...' quotes are defender
        // prose enumerating attacker phrasings (e.g. T1 defense primer
        // teaching engineers what shapes to refuse). The same pattern
        // closed FP-013 on CCI-008 (T8 quoted vague-triggers); promoted
        // into shared semantic-context per ADR-0036 so any future
        // detector can opt in.
        if (
          CONTEXT_AWARE_TAGS.has(tag) &&
          isInQuotedPhrase(ctx.content, match.index, matchEnd)
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
    // v0.2.3 (RC3 — language-aware down-weight). In a non-markdown code
    // artifact a surviving prose-family match is almost always a string
    // literal / comment / fixture, not live agent prose. When EVERY hint is
    // a prose family (no syntactic carrier) AND the artifact is code,
    // down-weight to WARN (reviewer-triage, still RISKY). Syntactic carriers
    // stay FAIL; markdown / pasted content / unknown extensions keep FAIL.
    // Lockstep with apps/api/scanners/t1_prompt_injection.py § v0.2.3.
    const hasSyntacticCarrier = hints.some((h) => SYNTACTIC_CARRIER_TAGS.has(h.detailTag))
    if (isCodeArtifact(ctx.filename) && !hasSyntacticCarrier) {
      const base = (ctx.filename ?? "").replace(/\\/g, "/").split("/").pop() || "code"
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.WARN,
        passed: true,
        summary: `Matched ${hints.length} prompt-injection pattern${plural} in a non-markdown code artifact (${base}); likely a string literal or fixture — down-weighted to WARN for review, not a hard fail.`,
        detectorVersion: this.detectorVersion,
        diffHints: hints,
      }
    }

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
