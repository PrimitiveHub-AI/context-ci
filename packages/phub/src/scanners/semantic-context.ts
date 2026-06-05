/**
 * Semantic context utilities — v0.2.2 (ADR-0036).
 *
 * Three pure predicates that classify the prose AROUND a regex match,
 * not the syntactic location of the match itself (that's ADR-0035's
 * markdown-context analyzer). Each predicate answers ONE question:
 *
 *   isInNegationContext   — "is the match scoped under a negation?"
 *                            (e.g., 'never run X', 'do not Y')
 *   isInMentionContext    — "is the match a reference to the vendor,
 *                            not a claim to BE the vendor?"
 *                            (e.g., 'Stripe's typography', 'like Linear')
 *   isInDeclarationContext— "is the match a license being described,
 *                            not a license under which content is copied?"
 *                            (e.g., 'CC-BY-4.0 (corpus content)')
 *
 * These are heuristics. The corpus measurement (ADR-0032) is the
 * arbiter — if a v0.2.2 keyword set drops recall on an existing
 * adversarial sample, the CI gate blocks the merge.
 *
 * Lockstep partner: apps/api/scanners/semantic_context.py — both
 * sides MUST produce identical verdicts for the same input.
 */

// Maximum lookback when searching for sentence start. Defense against
// pathological input (single-line megastrings).
const MAX_SENTENCE_LOOKBACK = 240

// Common non-terminal "." abbreviations the sentence-boundary heuristic
// should skip. Not a real tokenizer — covers the cases we actually see.
const ABBREV_BEFORE_DOT = /\b(?:Mr|Mrs|Dr|St|Mt|Jr|Sr|vs|etc|e\.g|i\.e)\.$/i

/**
 * Find the offset where the sentence containing `pos` starts.
 *
 * Walks backward through `content` looking for a sentence terminator
 * (`. ` / `! ` / `? ` / `\n\n`). Returns the offset of the first
 * character of the current sentence. Caps the search at
 * MAX_SENTENCE_LOOKBACK characters.
 */
export function findSentenceStart(content: string, pos: number): number {
  const floor = Math.max(0, pos - MAX_SENTENCE_LOOKBACK)
  for (let i = pos - 1; i > floor; i--) {
    const c = content[i]
    if (c === "\n") {
      // Paragraph boundary if the previous char is also a newline.
      if (i > 0 && content[i - 1] === "\n") return i + 1
      continue
    }
    if (c === "." || c === "!" || c === "?") {
      // Skip common abbreviations.
      const trailing = content.slice(Math.max(0, i - 5), i + 1)
      if (ABBREV_BEFORE_DOT.test(trailing)) continue
      // Sentence terminator if followed by whitespace.
      if (i + 1 < content.length && /\s/.test(content[i + 1] ?? "")) {
        return i + 2
      }
    }
  }
  return floor
}

// ----- isInNegationContext ----------------------------------------------------

/**
 * Keywords that downgrade a downstream match from FAIL to PASS.
 *
 * Tuned to the canonical FP-001 shape ("**No** npx skill installs") and
 * common variants. Each keyword is a regex source; combined into one
 * pattern at startup.
 *
 * Negation precedence rule: keyword MUST appear BEFORE the match,
 * within the same sentence (ADR-0036 § 2). A keyword AFTER the match
 * does not negate the match.
 */
const NEGATION_KEYWORDS_SOURCE: readonly string[] = [
  String.raw`\bnever\b`,
  String.raw`\bdo not\b`,
  String.raw`\bdon't\b`,
  String.raw`\bdoes not\b`,
  String.raw`\bdoesn't\b`,
  String.raw`\bforbidden\b`,
  String.raw`\bprohibited\b`,
  String.raw`\bavoid\b`,
  String.raw`\bavoids\b`,
  String.raw`\bavoiding\b`,
  String.raw`\bmust not\b`,
  String.raw`\bmustn't\b`,
  String.raw`\bshould not\b`,
  String.raw`\bshouldn't\b`,
  String.raw`\brefuse to\b`,
  String.raw`\brefuses to\b`,
  String.raw`\brefused\b`,
  String.raw`\bcannot\b`,
  String.raw`\bcan't\b`,
  String.raw`\bno\b`, // "No npx skill installs"
  String.raw`\bnot\b`,
  String.raw`\bnone of\b`,
  String.raw`\bdisallowed\b`,
  String.raw`\bbanned\b`,
  String.raw`\bunsafe\b`,
  String.raw`\bvulnerable\b`,
  String.raw`\battack(?:s|er|ed|ing)?\b`,
  String.raw`\bvector\b`,
  String.raw`\bmalicious\b`,
]

const NEGATION_RE = new RegExp(NEGATION_KEYWORDS_SOURCE.join("|"), "i")

/**
 * True iff the match is preceded by a negation keyword within the
 * same sentence.
 *
 * @param content the full document text
 * @param matchStart the start offset of the regex match
 */
export function isInNegationContext(content: string, matchStart: number): boolean {
  const sentenceStart = findSentenceStart(content, matchStart)
  const before = content.slice(sentenceStart, matchStart)
  return NEGATION_RE.test(before)
}

// ----- isInMentionContext -----------------------------------------------------

/**
 * Prose patterns BEFORE the match that signal "the match is a
 * reference/comparison, not an identity claim".
 */
const MENTION_BEFORE_RE = new RegExp(
  String.raw`\b(?:like|as|such as|similar to|compared to|vs|versus|tier of|inspired by|in the style of|alongside|including|including:|register to|borrowing from)\s*$`,
  "i",
)

/**
 * Prose patterns AFTER the match that signal "the match is the
 * possessive of a referenced vendor".
 *
 * Examples:
 *   "Stripe's typography"          → possessive, mention
 *   "Linear's roadmap"             → possessive, mention
 *   "Vercel's dashboard"           → possessive, mention
 *   "Sigstore, Linear's roadmap"   → comma-separated list of exemplars
 */
const MENTION_AFTER_RE = new RegExp(
  String.raw`^(?:'s\s+\w+|-style\b|-grade\b|-quality\b|-class\b|-level\b|\s*[,/]\s*(?:and\s+)?[A-Z]\w+|\s+(?:doesn't|does not|tier\b|Docs\b|docs\b|site\b|Foundation\b|blog\b|guide\b|design\b|dashboard\b|roadmap\b|design\s+system\b|design\s+language\b))`,
)

/**
 * True iff the match appears in a mention/reference context.
 *
 * Window: 50 chars before + 50 chars after the match. The lookbehind
 * window is `before`; the lookahead window starts AT matchEnd.
 *
 * Note: this is intentionally narrow. OFFICIAL_CLAIM and
 * FALSE_AFFILIATION patterns (which catch explicit impersonation
 * prose like "endorsed by Stripe") do NOT get downgraded by this
 * check — the per-detector opt-in only applies the mention check to
 * the bare-vendor-name TYPOSQUAT_PATTERNS family.
 */
export function isInMentionContext(content: string, matchStart: number, matchEnd: number): boolean {
  const before = content.slice(Math.max(0, matchStart - 50), matchStart)
  const after = content.slice(matchEnd, Math.min(content.length, matchEnd + 50))
  if (MENTION_BEFORE_RE.test(before)) return true
  if (MENTION_AFTER_RE.test(after)) return true
  // Comma-separated list (vendor in a list of exemplars):
  //   "Sigstore, Linear's roadmap, Vercel's dashboard, Stripe's payment"
  // If we see ", " or "/" immediately before AND another capitalised
  // vendor-like word immediately after, treat as mention.
  if (/[,/]\s*$/.test(before) && /^(?:\s*[,/]?\s*[a-z'A-Z][a-zA-Z'’]+)/.test(after)) {
    return true
  }
  return false
}

// ----- isInDeclarationContext --------------------------------------------------

/**
 * Parenthesized markers that follow a license string when the document
 * is DESCRIBING a license (declaration), not BORROWING content under
 * the license (quotation).
 */
const DECLARATION_AFTER_RE = new RegExp(
  String.raw`^\s*\((?:corpus|primitive|content|license|licensed|ships under|published under|under|the\s+\w+\s+license)[^)]{0,40}\)`,
  "i",
)

/**
 * `license:` prose that documents what license something is under —
 * appears in markdown table cells, frontmatter-shaped meta-docs, etc.
 *
 * Looks at the 30 chars BEFORE the match for declaration-context
 * indicators like "license is", "license:", "ships under", "is
 * licensed as".
 */
const DECLARATION_BEFORE_RE = new RegExp(
  String.raw`(?:license\s*(?:is|:)\s*|ships\s+under\s+|published\s+under\s+|licensed\s+as\s+|licensed\s+under\s+|is\s+licensed\s+)$`,
  "i",
)

/**
 * True iff the matched license string sits in a declaration context.
 * Closes FP-004 ("CC-BY-4.0 (corpus content)" body table).
 */
export function isInDeclarationContext(
  content: string,
  matchStart: number,
  matchEnd: number,
): boolean {
  const after = content.slice(matchEnd, Math.min(content.length, matchEnd + 60))
  if (DECLARATION_AFTER_RE.test(after)) return true
  const before = content.slice(Math.max(0, matchStart - 30), matchStart)
  if (DECLARATION_BEFORE_RE.test(before)) return true
  return false
}
