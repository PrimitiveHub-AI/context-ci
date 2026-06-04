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

const FORUM_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:Source|From|Adapted\s+from|Taken\s+from|Copied\s+from|Borrowed\s+from):\s*(?:https?:\/\/)?(?:www\.)?stackoverflow\.com\b/gim,
    "forum-source-attribution",
  ],
  [
    /\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?:\/\/)?(?:www\.)?reddit\.com\b/gim,
    "forum-source-attribution",
  ],
  [
    /\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?:\/\/)?(?:www\.)?(?:medium\.com|dev\.to|substack\.com)\/\S+/gim,
    "forum-source-attribution",
  ],
  [
    /\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?:\/\/)?github\.com\/\S+\/\S+/gim,
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
  readonly detectorVersion = "0.1.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
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
