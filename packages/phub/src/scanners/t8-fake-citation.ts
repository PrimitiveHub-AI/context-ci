/**
 * T8 — Fake citations / fake expertise claims.
 *
 * TS port of apps/api/scanners/t8_fake_citation.py. Pattern set
 * mirrors the Python source byte-for-byte. Both detectors read the
 * system clock for "current year" — conformance fixtures use
 * year 2099 to stay detectable regardless of when CI runs.
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

function currentYear(): number {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return new Date().getFullYear()
}

const CVE_RE = /\bCVE-(\d{4})-(\d{4,7})\b/g
const RFC_RE = /\bRFC[\s-]?(\d{1,7})\b/gi
const ARXIV_RE = /\barXiv:(\d{2})(\d{2})\.(\d{4,5})(?:v\d+)?\b/gi

const ACCEPTED_DOI_PREFIXES: ReadonlySet<string> = new Set([
  "10.1145",
  "10.48550",
  "10.1109",
  "10.1007",
  "10.1038",
  "10.1126",
  "10.1093",
  "10.1017",
  "10.1057",
  "10.1080",
  "10.1162",
  "10.1186",
  "10.1371",
  "10.1525",
  "10.1561",
  "10.1613",
  "10.18653",
  "10.21105",
  "10.2200",
  "10.2202",
  "10.2307",
  "10.3389",
  "10.5210",
  "10.5281",
  "10.7717",
  "10.7287",
  "10.1051",
  "10.1207",
])

const DOI_RE = /\b(?:DOI:?\s*|doi\.org\/)(10\.\d{4,9})\/([^\s"',]+)/gi

const VAGUE_TRIGGERS = [
  String.raw`\baccording\s+to\s+(?:research|the\s+research|studies|the\s+study|recent\s+studies)`,
  String.raw`\bstudies\s+(?:show|demonstrate|confirm|prove)`,
  String.raw`\bresearch\s+(?:shows|demonstrates|confirms|proves)`,
  String.raw`\b(?:experts|researchers|scientists)\s+agree\b`,
  String.raw`\bit\s+is\s+(?:well[\s-]?(?:known|established))\b`,
  String.raw`\b(?:industry\s+standard|industry\s+consensus|widely\s+accepted)\s+(?:practice|opinion|view)`,
  String.raw`\bas\s+(?:documented|stated|outlined)\s+in\s+(?:the\s+)?(?:literature|standard|specification)\b`,
]
const VAGUE_TRIGGER_RE = new RegExp(VAGUE_TRIGGERS.join("|"), "gim")
const REFERENCE_SIGNAL_RE =
  /https?:\/\/|DOI:|doi\.org\/|arXiv:|\bRFC\b|\bRFC-?\d|\[\d+\]|\(20\d{2}\)\s*[.,]/i

const VAGUE_LOOKAHEAD_CHARS = 200

function scanInvalidCves(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  const cur = currentYear()
  CVE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CVE_RE.exec(content)) !== null) {
    const year = Number.parseInt(m[1]!, 10)
    if (year > cur + 1 || year < 1999) {
      hints.push({
        line: lineForPosition(content, m.index),
        snippet: truncateSnippet(m[0]),
        suggestion: `CVE year ${year} is implausible (current year is ${cur}; CVE program began 1999). This is a fake citation.`,
        detailTag: "invalid-cve",
      })
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
    }
    if (m.index === CVE_RE.lastIndex) CVE_RE.lastIndex++
  }
  return hints
}

function scanInvalidRfcs(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  RFC_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RFC_RE.exec(content)) !== null) {
    const rfcNum = Number.parseInt(m[1]!, 10)
    if (rfcNum === 0 || rfcNum > 9999) {
      hints.push({
        line: lineForPosition(content, m.index),
        snippet: truncateSnippet(m[0]),
        suggestion: `RFC ${rfcNum} does not exist (RFCs are numbered 1..9999 as of 2026). This is a fake citation.`,
        detailTag: "invalid-rfc",
      })
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
    }
    if (m.index === RFC_RE.lastIndex) RFC_RE.lastIndex++
  }
  return hints
}

function scanInvalidArxiv(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  const cur = currentYear() % 100
  ARXIV_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ARXIV_RE.exec(content)) !== null) {
    const yy = Number.parseInt(m[1]!, 10)
    const mm = Number.parseInt(m[2]!, 10)
    if (mm < 1 || mm > 12 || yy > cur + 1) {
      hints.push({
        line: lineForPosition(content, m.index),
        snippet: truncateSnippet(m[0]),
        suggestion: `arXiv ID YYMM=${m[1]}${m[2]} is invalid (month ${mm} out of range, or year ahead of ${cur + 2001}).`,
        detailTag: "invalid-arxiv",
      })
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
    }
    if (m.index === ARXIV_RE.lastIndex) ARXIV_RE.lastIndex++
  }
  return hints
}

function scanFakeDoiPrefixes(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  DOI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DOI_RE.exec(content)) !== null) {
    const prefix = m[1]!
    if (!ACCEPTED_DOI_PREFIXES.has(prefix)) {
      hints.push({
        line: lineForPosition(content, m.index),
        snippet: truncateSnippet(m[0]),
        suggestion: `DOI prefix ${JSON.stringify(prefix)} is not in the v0.1 accepted-authorities list. If this is a legitimate DOI from a less-common registrar, verify the registrant ID at https://www.doi.org/registrants_overview.html.`,
        detailTag: "fake-doi-prefix",
      })
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
    }
    if (m.index === DOI_RE.lastIndex) DOI_RE.lastIndex++
  }
  return hints
}

function scanVagueCitations(content: string): DiffHint[] {
  const hints: DiffHint[] = []
  VAGUE_TRIGGER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VAGUE_TRIGGER_RE.exec(content)) !== null) {
    const windowStart = m.index + m[0].length
    const window = content.slice(windowStart, windowStart + VAGUE_LOOKAHEAD_CHARS)
    if (!REFERENCE_SIGNAL_RE.test(window)) {
      hints.push({
        line: lineForPosition(content, m.index),
        snippet: truncateSnippet(m[0]),
        suggestion: `Vague authority-appeal without a resolvable citation within the next ${VAGUE_LOOKAHEAD_CHARS} characters. Either inline the source (URL / DOI / arXiv / RFC) or rephrase to drop the appeal.`,
        detailTag: "vague-citation",
      })
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
    }
    if (m.index === VAGUE_TRIGGER_RE.lastIndex) VAGUE_TRIGGER_RE.lastIndex++
  }
  return hints
}

export class T8FakeCitationDetector {
  readonly name = "t8.fake_citation"
  readonly threatCategory = "T8"
  readonly cciId = "CCI-008"
  readonly detectorVersion = "0.1.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    const scanners = [
      scanInvalidCves,
      scanInvalidRfcs,
      scanInvalidArxiv,
      scanFakeDoiPrefixes,
      scanVagueCitations,
    ]
    for (const scanner of scanners) {
      if (hints.length >= MAX_HINTS_PER_VERDICT) break
      const remaining = MAX_HINTS_PER_VERDICT - hints.length
      hints.push(...scanner(ctx.content).slice(0, remaining))
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No fake-citation patterns matched.",
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
      summary: `Matched ${hints.length} fake-citation pattern${plural}; unverifiable or impossible references.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}
