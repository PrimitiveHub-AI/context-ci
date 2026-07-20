/**
 * T9 — Copyright-contaminated primitives.
 *
 * TS port of apps/api/scanners/t9_copyright_contamination.py.
 * Pattern set mirrors the Python source byte-for-byte per ADR-0023's
 * lockstep rule.
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
  isInFrontmatter,
  isInInlineCode,
} from "./markdown-context.js"
import { isInDeclarationContext, isInNegationContext } from "./semantic-context.js"

const PERMISSIVE_LICENSE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bPermission\s+is\s+hereby\s+granted,?\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy/gims,
    "permissive-license-header",
  ],
  [
    /\bRedistribution\s+and\s+use\s+in\s+source\s+and\s+binary\s+forms,?\s+with\s+or\s+without\s+modification/gims,
    "permissive-license-header",
  ],
  [
    /\bLicensed\s+under\s+the\s+Apache\s+License,?\s+Version\s+2\.0\s+\(the\s+["']?License["']?\)/gims,
    "permissive-license-header",
  ],
  [
    /\bThis\s+Source\s+Code\s+Form\s+is\s+subject\s+to\s+the\s+terms\s+of\s+the\s+Mozilla\s+Public\s+License/gims,
    "permissive-license-header",
  ],
  [
    /\bSPDX-License-Identifier:\s+(?:MIT|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0|ISC)/gim,
    "permissive-license-header",
  ],
]

const GPL_LICENSE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bThis\s+program\s+is\s+free\s+software[:;]\s+you\s+can\s+redistribute\s+it\s+and\/or\s+modify/gims,
    "gpl-header",
  ],
  [
    /\bThis\s+library\s+is\s+free\s+software[:;]\s+you\s+can\s+redistribute\s+it\s+and\/or\s+modify/gims,
    "gpl-header",
  ],
  [
    /\bunder\s+the\s+terms\s+of\s+the\s+GNU\s+(?:General|Lesser|Affero|Library)\s+(?:General\s+)?Public\s+License/gims,
    "gpl-header",
  ],
  [
    /\bSPDX-License-Identifier:\s+(?:GPL-[23]\.0(?:-(?:only|or-later))?|LGPL-[23]\.[01](?:-(?:only|or-later))?|AGPL-3\.0(?:-(?:only|or-later))?)/gim,
    "gpl-header",
  ],
]

const YEAR_REGEX_FRAGMENT = String.raw`(?:19|20|21)\d{2}(?:[-,]\s?(?:19|20|21)\d{2})?`

const PROPRIETARY_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `©\\s*${YEAR_REGEX_FRAGMENT}\\s+[A-Z][\\w.,&\\s-]{2,60}?\\s+All\\s+(?:R|r)ights\\s+(?:R|r)eserved`,
      "gims",
    ),
    "proprietary-copyright-notice",
  ],
  [
    new RegExp(
      `\\bCopyright\\s+(?:©|\\(c\\)|\\(C\\))\\s*${YEAR_REGEX_FRAGMENT}\\s+[A-Z][\\w.,&\\s-]{2,60}?\\s+All\\s+(?:R|r)ights\\s+(?:R|r)eserved`,
      "gims",
    ),
    "proprietary-copyright-notice",
  ],
  [
    new RegExp(
      `\\bAll\\s+Rights\\s+Reserved\\b.{0,40}\\b${YEAR_REGEX_FRAGMENT}\\b`,
      "gims",
    ),
    "proprietary-copyright-notice",
  ],
  [
    new RegExp(
      `\\b${YEAR_REGEX_FRAGMENT}\\s+[A-Z][\\w.,&\\s-]{2,60}?\\s+All\\s+Rights\\s+Reserved`,
      "gims",
    ),
    "proprietary-copyright-notice",
  ],
]

const CC_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:CC|Creative\s+Commons)[\s_-]?BY[\s_-]?SA(?:[\s_-]?\d(?:\.\d)?)?/gim,
    "cc-attribution-required",
  ],
  [
    /\b(?:CC|Creative\s+Commons)[\s_-]?BY[\s_-]?NC(?:[\s_-]?\d(?:\.\d)?)?/gim,
    "cc-attribution-required",
  ],
  [
    /\b(?:CC|Creative\s+Commons)[\s_-]?BY(?:[\s_-]?\d(?:\.\d)?)?(?!\w)/gim,
    "cc-attribution-required",
  ],
  [/\blicensed\s+under\s+Creative\s+Commons\b/gim, "cc-attribution-required"],
]

// v0.2.3 (2026-06-04) — GitHub `Source:` attribution pattern removed.
// A skill citing `Source: https://github.com/foo/bar` is doing the
// RIGHT thing (attribution). GitHub repos carry their OWN per-repo
// license, not blanket CC-BY-SA, so attribution is not a downstream
// licensing risk. See FP-008 in docs/false-positive-resolution.md.
// Lockstep with apps/api/scanners/t9_copyright_contamination.py.
const FORUM_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    // Stack Overflow content is CC-BY-SA — attribution is real.
    /\b(?:Source|From|Adapted\s+from|Taken\s+from|Copied\s+from|Borrowed\s+from):\s*(?:https?:\/\/)?(?:www\.)?stackoverflow\.com\b/gim,
    "forum-source-attribution",
  ],
  [
    // Reddit user-license + attribution complications.
    /\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?:\/\/)?(?:www\.)?reddit\.com\b/gim,
    "forum-source-attribution",
  ],
  [
    /\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?:\/\/)?(?:www\.)?(?:medium\.com|dev\.to|substack\.com)\/\S+/gim,
    "forum-source-attribution",
  ],
]

const ALL_PATTERNS = [
  ...PERMISSIVE_LICENSE_PATTERNS,
  ...GPL_LICENSE_PATTERNS,
  ...PROPRIETARY_PATTERNS,
  ...CC_PATTERNS,
  ...FORUM_PATTERNS,
]

const SUGGESTION_BY_TAG: Record<string, string> = {
  "permissive-license-header":
    "Verbatim MIT / Apache / BSD / MPL license boilerplate embedded in a primitive. If the primitive is teaching about licensing, allow it via policy + FP ledger (per ADR-0030). Otherwise remove or attribute the copied text.",
  "gpl-header":
    "Verbatim GPL / LGPL / AGPL boilerplate embedded in a primitive. Consuming the primitive imports the GPL family's strong-copyleft obligations onto the consumer's project. Remove the boilerplate or replace with attribution + a link to the upstream source.",
  "proprietary-copyright-notice":
    "Third-party copyright notice ('© <vendor> <year>' / 'All Rights Reserved') embedded in primitive content. If the notice is the project's own, allow via policy with an FP-NNN ledger entry. Otherwise the embedded content is unattributed third-party material.",
  "cc-attribution-required":
    "Creative Commons license marker indicates attribution is required for downstream use. Add the canonical attribution + link to the original source, or remove the content.",
  "forum-source-attribution":
    "Forum / community source link suggests the primitive copies content from a site with attribution requirements (Stack Overflow content is CC-BY-SA; GitHub READMEs carry their own licenses). Verify the upstream license and either inline the attribution or rephrase in the operator's own words.",
}

// v0.2.3 (2026-06-04) — License-family canonical-position exemption.
// Lockstep with apps/api/scanners/t9_copyright_contamination.py § v0.2.3.
//
// Apache 2.0 / BSD / MIT headers at the top of every file in a
// normally-licensed repo were generating overwhelming noise on /check's
// GitHub repo scans. We exempt license-family tags from firing when
// the match sits in canonical positions:
//   1. A LICENSE / COPYING / NOTICE / COPYRIGHT file (anywhere in it).
//   2. A source-code file's top-of-file header region (first 40 lines).
// proprietary-copyright-notice and forum-source-attribution remain
// context-unaware — they are meaningful wherever they appear.

const HEADER_REGION_LINES = 40

const LICENSE_FILE_BASENAMES: ReadonlySet<string> = new Set([
  "license",
  "license.md",
  "license.txt",
  "license.rst",
  "copying",
  "copying.md",
  "copying.txt",
  "notice",
  "notice.md",
  "notice.txt",
  "copyright",
  "copyright.md",
  "copyright.txt",
])

const SOURCE_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".py", ".pyi", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".java", ".kt", ".scala", ".groovy",
  ".c", ".h", ".cc", ".cpp", ".hpp", ".hh", ".cxx",
  ".m", ".mm", ".swift",
  ".go", ".rs", ".rb",
  ".php", ".pl", ".pm",
  ".lua", ".sh", ".bash", ".zsh", ".fish", ".ps1",
  ".sql", ".css", ".scss", ".less",
  ".vue", ".svelte", ".dart",
  ".erl", ".ex", ".exs",
  ".clj", ".cljs", ".hs", ".elm",
  ".f", ".f90", ".r", ".jl", ".nim", ".zig", ".v",
])

const HEADER_EXEMPT_TAGS: ReadonlySet<string> = new Set([
  "permissive-license-header",
  "gpl-header",
  "cc-attribution-required",
])

function isLicenseFile(filePath: string | undefined): boolean {
  if (!filePath) return false
  const basename = filePath.split("/").pop()?.toLowerCase() ?? ""
  if (LICENSE_FILE_BASENAMES.has(basename)) return true
  const parts = filePath.toLowerCase().split("/").filter(Boolean)
  return parts.includes("licenses") || parts.includes("license")
}

function isSourceFile(filePath: string | undefined): boolean {
  if (!filePath) return false
  const lowered = filePath.toLowerCase()
  const dot = lowered.lastIndexOf(".")
  if (dot < 0) return false
  return SOURCE_FILE_EXTENSIONS.has(lowered.slice(dot))
}

function isInHeaderRegion(content: string, offset: number): boolean {
  // 1-indexed line number.
  let line = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++
  }
  return line <= HEADER_REGION_LINES
}

function hintForMatch(content: string, match: RegExpExecArray, tag: string): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: SUGGESTION_BY_TAG[tag] ?? "Copyright contamination pattern matched.",
    detailTag: tag,
  }
}

export class T9CopyrightContaminationDetector {
  readonly name = "t9.copyright_contamination"
  readonly threatCategory = "T9"
  readonly cciId = "CCI-009"
  readonly detectorVersion = "0.2.3"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.1 (ADR-0035): skip matches inside frontmatter + inline code.
    // v0.2.2 (ADR-0036): also skip matches in declaration context.
    // v0.2.3 (lockstep with Python — 2026-06-04): for license-family
    // tags only, exempt the canonical positions — LICENSE-named files
    // and source-file top-of-file header region. Apache 2.0 / BSD /
    // MIT headers at the top of every file in a normally-licensed
    // repo were generating overwhelming noise on /check's GitHub
    // repo scans.
    const mdCtx = analyzeMarkdownContext(ctx.content)
    const licenseFile = isLicenseFile(ctx.filename)
    const sourceFile = isSourceFile(ctx.filename)

    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        if (
          isInFrontmatter(match.index, mdCtx) ||
          isInInlineCode(match.index, mdCtx) ||
          isInDeclarationContext(ctx.content, match.index, match.index + match[0].length) ||
          isInNegationContext(ctx.content, match.index)
        ) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
        // License-family canonical-position exemption.
        if (
          HEADER_EXEMPT_TAGS.has(tag) &&
          (licenseFile || (sourceFile && isInHeaderRegion(ctx.content, match.index)))
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
        summary: "No copyright-contamination patterns matched.",
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
      summary: `Matched ${hints.length} copyright-contamination pattern${plural}; downstream licensing risk.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
