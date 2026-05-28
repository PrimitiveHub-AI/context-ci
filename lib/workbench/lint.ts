/**
 * Pure linting logic for the Workbench, validating against the Primitive
 * Spec v0.1 (docs/spec.md §2).
 *
 * Returns abstract findings that are mapped to:
 *   - CodeMirror Diagnostics by `codemirror-linter.ts` (inline squiggles + tooltips)
 *   - Right-panel list items by `app/workbench/page.tsx`
 *
 * One source of truth so the editor squiggle and the panel entry never disagree.
 */

import { extractFrontmatter, analyzeSections } from "./parse"

export type WorkbenchFinding = {
  severity: "error" | "warning" | "info"
  message: string
  /** 1-indexed line number where the finding is anchored. Optional. */
  line?: number
  /** Stable identifier (will map to docs/codes.md once that lands). */
  code: string
}

const REQUIRED_FIELDS: ReadonlyArray<string> = [
  "spec_version",
  "name",
  "version",
  "type",
  "domain",
  "author",
  "license",
  "tokens",
  "token_budget",
  "risk_level",
  "compatible_agents",
  "use_when",
  "do_not_use_when",
]

const VALID_TYPES = new Set([
  "engineering",
  "design",
  "security",
  "research",
  "architecture",
  "performance",
  "agent-behavior",
  "domain-expertise",
])

const VALID_RISK_LEVELS = new Set(["low", "medium", "high"])

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

function findLineOfKey(content: string, key: string, maxLine?: number): number | undefined {
  const lines = content.split("\n")
  const upto = maxLine ?? lines.length
  const re = new RegExp(`^\\s*${key}\\s*:`)
  for (let i = 0; i < Math.min(upto, lines.length); i++) {
    if (re.test(lines[i])) return i + 1
  }
  return undefined
}

export function lintWorkbenchContent(content: string): WorkbenchFinding[] {
  const findings: WorkbenchFinding[] = []
  const fm = extractFrontmatter(content)

  if (!fm.ok) {
    findings.push({
      severity: "error",
      message: fm.error,
      line: fm.line ?? 1,
      code: "FM-PARSE",
    })
    return findings
  }

  const data = fm.data

  // 1. Required-field presence
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      findings.push({
        severity: "error",
        message: `Missing required field: \`${field}\` (Spec §2.1)`,
        line: 1,
        code: "FM-MISSING-REQUIRED",
      })
    }
  }

  // 2. Field shape validation
  if (typeof data.name === "string" && !SLUG_RE.test(data.name)) {
    findings.push({
      severity: "error",
      message: "`name` must be a slug matching ^[a-z0-9][a-z0-9-]*[a-z0-9]$ (Spec §2.1)",
      line: findLineOfKey(content, "name", fm.endLine),
      code: "FM-NAME-SHAPE",
    })
  }

  if (typeof data.version === "string" && !SEMVER_RE.test(data.version)) {
    findings.push({
      severity: "error",
      message: `\`version\` must be semver 2.0 (got "${data.version}")`,
      line: findLineOfKey(content, "version", fm.endLine),
      code: "FM-VERSION-SEMVER",
    })
  }

  if (typeof data.type === "string" && !VALID_TYPES.has(data.type)) {
    findings.push({
      severity: "error",
      message: `\`type\` must be one of: ${Array.from(VALID_TYPES).join(", ")}`,
      line: findLineOfKey(content, "type", fm.endLine),
      code: "FM-TYPE-ENUM",
    })
  }

  if (typeof data.risk_level === "string" && !VALID_RISK_LEVELS.has(data.risk_level)) {
    findings.push({
      severity: "error",
      message: "`risk_level` must be one of: low, medium, high",
      line: findLineOfKey(content, "risk_level", fm.endLine),
      code: "FM-RISK-ENUM",
    })
  }

  if (typeof data.tokens === "number" && typeof data.token_budget === "number") {
    if (data.tokens > data.token_budget) {
      findings.push({
        severity: "error",
        message: `\`tokens\` (${data.tokens}) exceeds \`token_budget\` (${data.token_budget})`,
        line: findLineOfKey(content, "tokens", fm.endLine),
        code: "TOK-EXCEEDED",
      })
    } else if (data.tokens > 0.9 * data.token_budget) {
      findings.push({
        severity: "warning",
        message: `\`tokens\` (${data.tokens}) is above 90% of budget; consider splitting`,
        line: findLineOfKey(content, "tokens", fm.endLine),
        code: "TOK-DENSITY-HIGH",
      })
    }
  }

  if (Array.isArray(data.use_when) && (data.use_when as unknown[]).length === 0) {
    findings.push({
      severity: "error",
      message: "`use_when` must be non-empty (Spec §2.1)",
      line: findLineOfKey(content, "use_when", fm.endLine),
      code: "FM-USE-WHEN-EMPTY",
    })
  }

  if (Array.isArray(data.do_not_use_when) && (data.do_not_use_when as unknown[]).length === 0) {
    findings.push({
      severity: "error",
      message: "`do_not_use_when` must be non-empty (Spec §2.1)",
      line: findLineOfKey(content, "do_not_use_when", fm.endLine),
      code: "FM-DONT-USE-WHEN-EMPTY",
    })
  }

  if (typeof data.spec_version === "string" && data.spec_version !== "0.1") {
    findings.push({
      severity: "info",
      message: `Workbench is calibrated to Spec v0.1; you declared "${data.spec_version}"`,
      line: findLineOfKey(content, "spec_version", fm.endLine),
      code: "FM-SPEC-VERSION-DRIFT",
    })
  }

  // 3. Required body sections
  const sections = analyzeSections(fm.body)
  for (const s of sections.required) {
    if (!s.present) {
      findings.push({
        severity: "error",
        message: `Missing required section: \`## ${s.name}\` (Spec §3.1)`,
        code: "STRUCT-REQUIRED-MISSING",
      })
    }
  }
  for (const s of sections.recommended) {
    if (!s.present) {
      findings.push({
        severity: "info",
        message: `Recommended section not present: \`## ${s.name}\` (Spec §3.2)`,
        code: "STRUCT-RECOMMEND-MISSING",
      })
    }
  }

  return findings
}
