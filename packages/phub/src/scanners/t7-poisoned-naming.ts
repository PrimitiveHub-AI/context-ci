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
  // v0.3.1 (Round 10 PR 10.2 — closes FN-015): AI-coding-tool vendors
  // currently outside the curated list. Each addition automatically
  // extends BOTH the official-vendor-claim / false-affiliation /
  // vendor-typosquat regex families AND the v0.3.0 generic homoglyph
  // skeleton check; no per-vendor pattern authoring needed. Lockstep
  // with apps/api/scanners/t7_poisoned_naming.py § v0.3.1.
  "Replit",
  "Glitch",
  "StackBlitz",
  "Codespaces",
  "Bolt",
  "Lovable",
  "Cody",
  "Sourcegraph",
]
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const VENDOR_ALT = VENDORS.map(escapeRegex).join("|")

// v0.3.2 (Round 13 PR 13.2 — closes FN-023): curated list of
// high-trust npm + PyPI packages whose names are common
// impersonation targets. Distinct from VENDORS (vendor BRAND
// names like Anthropic); packages are the SPECIFIC PUBLISHED
// ARTIFACTS attackers impersonate by writing "the official
// <package-name> primitive endorsed by the <package-name>
// maintainer team." Lockstep with apps/api/scanners/
// t7_poisoned_naming.py § v0.3.2.
const HIGH_TRUST_PACKAGES = [
  // npm
  "lodash", "express", "react", "vue", "axios", "dotenv",
  "ua-parser-js", "eslint", "prettier", "webpack", "vite",
  "next", "nuxt", "babel", "rollup", "tailwindcss", "svelte",
  "moment", "jquery", "underscore",
  // PyPI
  "requests", "urllib3", "numpy", "pandas", "django",
  "flask", "pytest", "sqlalchemy", "pyyaml", "setuptools",
]
const HIGH_TRUST_PACKAGE_ALT = HIGH_TRUST_PACKAGES.map(escapeRegex).join("|")

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
  // v0.3.2 (Round 13 PR 13.2 — closes FN-023): package-name
  // official-claim shapes. Reads from HIGH_TRUST_PACKAGES — the
  // specific published-artifact names attackers impersonate.
  [
    new RegExp(
      `\\b(?:the\\s+)?official\\s+(?:${HIGH_TRUST_PACKAGE_ALT})\\s+(?:primitive|skill|tool|prompt|agent|integration|sdk|helper|package)`,
      "gim",
    ),
    "package-official-claim",
  ],
  [
    new RegExp(
      `\\bfrom\\s+the\\s+(?:${HIGH_TRUST_PACKAGE_ALT})\\s+(?:maintainer|maintainers|team|engineering)\\b`,
      "gim",
    ),
    "package-official-claim",
  ],
  [
    new RegExp(
      `\\bendorsed\\s+by\\s+(?:the\\s+)?(?:${HIGH_TRUST_PACKAGE_ALT})\\s+(?:maintainer|maintainers|team|engineering)\\b`,
      "gim",
    ),
    "package-official-claim",
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

// v0.3.0 (Round 7 PR 7.2 — generic Unicode confusables, replaces the
// v0.2.4 hardcoded Anthropic/OpenAI patterns). Implements UTS #39's
// "skeleton" identifier-comparison method scoped to the project's
// vendor list. Each canonical vendor name has a precomputed skeleton
// (lowercase Latin form); each input "word" containing any non-ASCII
// codepoint is mapped through CONFUSABLES_MAP and compared to the
// vendor-skeleton set. A match means an attacker rendered a vendor
// name with one or more Cyrillic/Greek confusable substitutions —
// the classic visual-impersonation supply-chain shape.
//
// The map covers the codepoints that actually appear in the v0.2.4
// attack samples + the broader set that confusables.txt lists for
// the letters in the project's vendor names. Generic enough to catch
// "Аpple" or "Мicrosoft" or "Ѕtripe" without re-tuning per vendor.
//
// Lockstep with apps/api/scanners/t7_poisoned_naming.py § v0.3.0.
const CONFUSABLES_MAP: ReadonlyMap<string, string> = new Map([
  // Cyrillic uppercase
  ["А", "A"], ["В", "B"], ["С", "C"], ["Е", "E"],
  ["Н", "H"], ["І", "I"], ["К", "K"], ["М", "M"],
  ["О", "O"], ["Р", "P"], ["Ѕ", "S"], ["Т", "T"],
  ["Х", "X"],
  // Cyrillic lowercase
  ["а", "a"], ["с", "c"], ["е", "e"], ["о", "o"],
  ["р", "p"], ["ѕ", "s"],
  // Greek uppercase
  ["Α", "A"], ["Β", "B"], ["Ε", "E"], ["Η", "H"],
  ["Ι", "I"], ["Κ", "K"], ["Μ", "M"], ["Ν", "N"],
  ["Ο", "O"], ["Ρ", "P"], ["Τ", "T"], ["Υ", "Y"],
  ["Χ", "X"], ["Ϲ", "C"],
  // Greek lowercase
  ["α", "a"], ["ο", "o"], ["ρ", "p"],
])

function skeleton(s: string): string {
  let out = ""
  for (const ch of s) {
    out += CONFUSABLES_MAP.get(ch) ?? ch
  }
  return out
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return true
  }
  return false
}

// Single-word vendors only. Multi-word forms ("Hugging Face") have
// single-word siblings in the list ("HuggingFace") so the homoglyph
// check still catches their attack shape.
const SINGLE_WORD_VENDOR_SKELETONS: ReadonlyMap<string, string> = new Map(
  VENDORS.filter((v) => !/\s/.test(v)).map((v) => [skeleton(v).toLowerCase(), v]),
)

// Word tokenizer: contiguous run of letters / digits / "._-" with a
// letter-class anchor. Covers Latin + the Cyrillic / Greek blocks
// the confusables map handles; matches at word boundaries via the
// surrounding-context filter (non-letter chars before/after).
const HOMOGLYPH_WORD_RE = /[A-Za-zͰ-ϿЀ-ӿ][A-Za-z0-9._Ͱ-ϿЀ-ӿ-]*/g

const ALL_PATTERNS = [
  ...OFFICIAL_CLAIM_PATTERNS,
  ...FALSE_AFFILIATION_PATTERNS,
  ...TYPOSQUAT_TUPLES,
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
  readonly detectorVersion = "0.3.2"

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
          tag === "vendor-typosquat" &&
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

    // v0.3.0 (Round 7 PR 7.2): generic homoglyph pass using UTS #39
    // skeleton comparison. Tokenises the content into words, skips
    // pure-ASCII words (the vendor's REAL name), maps non-ASCII
    // codepoints through CONFUSABLES_MAP, compares the resulting
    // skeleton to SINGLE_WORD_VENDOR_SKELETONS. Hits fire
    // `vendor-homoglyph`.
    HOMOGLYPH_WORD_RE.lastIndex = 0
    let wm: RegExpExecArray | null
    while ((wm = HOMOGLYPH_WORD_RE.exec(ctx.content)) !== null) {
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
      const word = wm[0]
      if (!hasNonAscii(word)) {
        if (wm.index === HOMOGLYPH_WORD_RE.lastIndex) HOMOGLYPH_WORD_RE.lastIndex++
        continue
      }
      const skel = skeleton(word).toLowerCase()
      const canonical = SINGLE_WORD_VENDOR_SKELETONS.get(skel)
      if (canonical === undefined) {
        if (wm.index === HOMOGLYPH_WORD_RE.lastIndex) HOMOGLYPH_WORD_RE.lastIndex++
        continue
      }
      // Same frontmatter / inline-code / mention-context skips as the
      // regex-driven patterns.
      if (isInFrontmatter(wm.index, mdCtx) || isInInlineCode(wm.index, mdCtx)) {
        if (wm.index === HOMOGLYPH_WORD_RE.lastIndex) HOMOGLYPH_WORD_RE.lastIndex++
        continue
      }
      if (isInMentionContext(ctx.content, wm.index, wm.index + word.length)) {
        if (wm.index === HOMOGLYPH_WORD_RE.lastIndex) HOMOGLYPH_WORD_RE.lastIndex++
        continue
      }
      hints.push({
        line: lineForPosition(ctx.content, wm.index),
        snippet: truncateSnippet(`${word} (renders as “${canonical}” via Cyrillic/Greek confusables)`),
        suggestion: SUGGESTIONS["vendor-homoglyph"]!,
        detailTag: "vendor-homoglyph",
      })
      if (wm.index === HOMOGLYPH_WORD_RE.lastIndex) HOMOGLYPH_WORD_RE.lastIndex++
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
