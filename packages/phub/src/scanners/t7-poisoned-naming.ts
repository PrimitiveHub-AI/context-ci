/**
 * T7 — Poisoned naming / typosquatting / impersonation.
 *
 * TS port of apps/api/scanners/t7_poisoned_naming.py. Vendor list +
 * typosquat patterns mirror the Python source byte-for-byte per
 * ADR-0023's lockstep rule.
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
import { analyzeMarkdownContext, isInFrontmatter, isInInlineCode } from "./markdown-context.js"
import { isInMentionContext } from "./semantic-context.js"

const VENDORS = [
  "Anthropic",
  "OpenAI",
  "Google",
  "Microsoft",
  "Meta",
  "Apple",
  "Amazon",
  "AWS",
  "GitHub",
  "GitLab",
  "Bitbucket",
  "Vercel",
  "Netlify",
  "Cloudflare",
  "Stripe",
  "Auth0",
  "Okta",
  "LangChain",
  "LlamaIndex",
  "Hugging Face",
  "HuggingFace",
  "Pinecone",
  "Weaviate",
  "Cursor",
  "Aider",
  "Cline",
  "Continue",
  "MongoDB",
  "Supabase",
  "PostgreSQL",
  "Postgres",
  "Snowflake",
  "Databricks",
  "Datadog",
  "Sentry",
  "PagerDuty",
]
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const VENDOR_ALT = VENDORS.map(escapeRegex).join("|")

// Typosquats: digit-for-letter substitutions that produce visually
// similar names. Each pattern must EXCLUDE the canonical letter — the
// detector is meant to catch IMITATIONS, not bare mentions. v0.2.3
// (2026-06-04) fixed character classes that accidentally included the
// canonical letter and were firing on every legitimate vendor mention
// (e.g. `[A4O0]nthropic` matched "Anthropic" itself, `[O0]kta` matched
// "Okta", `M[i1l]crosoft` matched "Microsoft"). Lockstep with
// apps/api/scanners/t7_poisoned_naming.py per ADR-0023.
const TYPOSQUAT_PATTERNS: string[] = [
  String.raw`\bAnthrop1c\b`,         // 1-for-i in Anthropic
  String.raw`\b4nthropic\b`,         // 4-for-A in Anthropic
  String.raw`\b0nthropic\b`,         // 0-for-A (debatable but distinctive)
  String.raw`\b0penAI\b`,            // 0-for-O in OpenAI
  String.raw`\b0pen[Aa][Ii]\b`,      // 0-for-O + casing variants
  String.raw`\bOp3nAI\b`,            // 3-for-e in OpenAI
  String.raw`\bG0ogle\b`,            // 0-for-o (first o)
  String.raw`\bGo0gle\b`,            // 0-for-o (second o)
  String.raw`\bGoog1e\b`,            // 1-for-l in Google
  String.raw`\bM1crosoft\b`,         // 1-for-i in Microsoft
  String.raw`\bMlcrosoft\b`,         // l-for-i in Microsoft (visual)
  String.raw`\bClaud3\b`,            // 3-for-e in Claude
  String.raw`\bGPT4-?official\b`,    // GPT4-official impersonation
  String.raw`\bM3ta\b`,              // 3-for-e in Meta
  String.raw`\b0kta\b(?!\w)`,        // 0-for-O in Okta
  String.raw`\bSt1ipe\b`,            // 1-for-r in Stripe (visually weak; kept for symmetry)
]

const OFFICIAL_CLAIM_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\b(?:the\\s+)?official\\s+(?:${VENDOR_ALT})\\s+(?:primitive|skill|tool|prompt|agent|integration|sdk)`,
      "gim",
    ),
    "official-vendor-claim",
  ],
  [
    new RegExp(`\\bthis\\s+is\\s+(?:the\\s+)?official\\s+(?:${VENDOR_ALT})\\b`, "gim"),
    "official-vendor-claim",
  ],
  [
    new RegExp(`\\bfrom\\s+the\\s+(?:${VENDOR_ALT})\\s+team\\b`, "gim"),
    "official-vendor-claim",
  ],
  [
    new RegExp(
      `\\b(?:${VENDOR_ALT})'s\\s+(?:official|recommended|certified|endorsed)\\s+(?:primitive|skill|tool|prompt|agent|integration|sdk)`,
      "gim",
    ),
    "official-vendor-claim",
  ],
]

const FALSE_AFFILIATION_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\b(?:endorsed|certified|approved|sanctioned|verified)\\s+by\\s+(?:${VENDOR_ALT})\\b`,
      "gim",
    ),
    "false-affiliation-claim",
  ],
  [
    new RegExp(`\\bas\\s+(?:featured|recommended|adopted)\\s+by\\s+(?:${VENDOR_ALT})\\b`, "gim"),
    "false-affiliation-claim",
  ],
  [
    new RegExp(`\\bin\\s+partnership\\s+with\\s+(?:${VENDOR_ALT})\\b`, "gim"),
    "false-affiliation-claim",
  ],
]

const TYPOSQUAT_TUPLES: Array<readonly [RegExp, string]> = TYPOSQUAT_PATTERNS.map((p) => [
  new RegExp(p, "gim"),
  "vendor-typosquat",
])

// v0.2.4 (Round 6 fix 3 — closes FN-011): Unicode-confusable patterns
// for known vendor names. The character classes mix the canonical
// Latin letter with its commonly-substituted Cyrillic / Greek
// confusable; matches in the "any non-ASCII letter is present in the
// canonical-Latin slot" sense fire `vendor-homoglyph`. ASCII-only
// renders (no confusable used) DON'T match — the bare-Latin word
// is the vendor's REAL name and isn't impersonation.
//
// Boundary defense: `(?<![A-Za-z0-9_])` / `(?![A-Za-z0-9_])` are used
// instead of `\b` because `\b` is ASCII-only in default mode and a
// Cyrillic letter at the boundary doesn't trigger it.
//
// Vendor-list-first scope: Anthropic + OpenAI. A generic NFKC + script
// -mixing detector is the planned Round 7+ generalisation.
const HOMOGLYPH_VENDOR_PATTERNS: string[] = [
  // Anthropic: Cyrillic А (U+0410) or а (U+0430) instead of Latin A/a.
  // The non-leading "nthropic" stays canonical Latin so this fires
  // specifically on the mixed-script attack shape.
  String.raw`(?<![A-Za-z0-9_])[Аа]nthropic(?![A-Za-z0-9_])`,
  // OpenAI: Cyrillic О (U+041E) or о (U+043E) instead of Latin O/o.
  String.raw`(?<![A-Za-z0-9_])[Оо]pen[Aa][Ii](?![A-Za-z0-9_])`,
]

const HOMOGLYPH_TUPLES: Array<readonly [RegExp, string]> = HOMOGLYPH_VENDOR_PATTERNS.map(
  (p) => [new RegExp(p, "gim"), "vendor-homoglyph"],
)

const ALL_PATTERNS = [
  ...OFFICIAL_CLAIM_PATTERNS,
  ...FALSE_AFFILIATION_PATTERNS,
  ...TYPOSQUAT_TUPLES,
  ...HOMOGLYPH_TUPLES,
]

const SUGGESTIONS: Record<string, string> = {
  "official-vendor-claim":
    "Prose claims this primitive is the official work of a named vendor. Real vendor affiliations are proven via Sigstore identity attestations, not text. Rephrase as 'inspired by' / 'integrates with' / 'works with', or, if the claim is real, sign the bundle with the vendor's identity cert.",
  "false-affiliation-claim":
    "Prose asserts endorsement/certification by a named vendor. Same fix as above — drop the claim or back it with an attestation chain.",
  "vendor-typosquat":
    "Vendor name appears typosquatted (digit-for-letter or near-confusable). If accidental, fix the spelling. If deliberate, this is impersonation.",
  "vendor-homoglyph":
    "Vendor name appears with a non-ASCII letter visually identical to the canonical Latin spelling (Cyrillic / Greek confusable). This is the classic visual-impersonation shape and never benign in primitive content. If this is a foreign-language reference, use the language's native spelling (e.g. \"Антропик\") rather than a mixed-script form.",
}

function hintForMatch(content: string, match: RegExpExecArray, tag: string): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: SUGGESTIONS[tag] ?? "Impersonation pattern matched.",
    detailTag: tag,
  }
}

export class T7PoisonedNamingDetector {
  readonly name = "t7.poisoned_naming"
  readonly threatCategory = "T7"
  readonly cciId = "CCI-007"
  readonly detectorVersion = "0.2.4"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.1 (ADR-0035): skip matches inside frontmatter.
    // v0.2.2 (ADR-0036): for the bare-vendor-name typosquat family
    // only, also skip matches in mention context — "Stripe's
    // typography" and "like Linear" are references, not
    // impersonation. OFFICIAL_CLAIM + FALSE_AFFILIATION patterns
    // remain context-unaware because they're explicit impersonation
    // prose ("the official X primitive", "endorsed by Y").
    const mdCtx = analyzeMarkdownContext(ctx.content)

    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        if (isInFrontmatter(match.index, mdCtx) || isInInlineCode(match.index, mdCtx)) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
        if (
          (tag === "vendor-typosquat" || tag === "vendor-homoglyph") &&
          isInMentionContext(ctx.content, match.index, match.index + match[0].length)
        ) {
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
        summary: "No poisoned-naming patterns matched.",
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
      summary: `Matched ${hints.length} poisoned-naming pattern${plural}; impersonation / typosquat claim detected.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
