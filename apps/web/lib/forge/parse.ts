/**
 * Live document analysis for the Forge: extracts the frontmatter,
 * detects required and recommended sections, computes a rough token count.
 *
 * Token counting here is intentionally a fast heuristic (`length / 4`) —
 * the *real* canonical token count comes from a tokenizer pass in Context CI
 * (Phase 4). The Forge shows an estimate so the author can see budget
 * pressure as they type.
 *
 * Section names are aligned with the Primitive Spec v0.1 — see docs/spec.md.
 */

import { parse as parseYaml } from "yaml"

export type SectionStatus = {
  name: string
  present: boolean
  required: boolean
}

export type FrontmatterParseResult =
  | { ok: true; data: Record<string, unknown>; startLine: number; endLine: number; body: string }
  | { ok: false; error: string; line?: number; col?: number; startLine: number; endLine: number; body: string }

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const REQUIRED_SECTIONS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "Purpose", re: /^##\s+Purpose\b/im },
  { name: "Core Principles", re: /^##\s+Core\s+Principles?\b/im },
  { name: "Decision Rules", re: /^##\s+Decision\s+Rules?\b/im },
  { name: "Anti-Patterns", re: /^##\s+Anti[-\s]?Patterns?\b/im },
  { name: "Review Checklist", re: /^##\s+Review\s+Checklist\b/im },
  { name: "Agent Behavior", re: /^##\s+Agent\s+Behavior(\s+Instructions)?\b/im },
]

const RECOMMENDED_SECTIONS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "Expected Output Format", re: /^##\s+Expected\s+Output(\s+Format)?\b/im },
  { name: "Examples", re: /^##\s+Examples?\b/im },
  { name: "References", re: /^##\s+References?\b/im },
  { name: "Changelog", re: /^##\s+Changelog\b/im },
]

export function extractFrontmatter(content: string): FrontmatterParseResult {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return {
      ok: false,
      error: "No YAML frontmatter found. A primitive must begin with a `---` block.",
      startLine: 1,
      endLine: 1,
      body: content,
    }
  }

  const yamlText = match[1]
  const body = match[2] ?? ""
  // Frontmatter occupies lines 1..(yamlText line count + 2)
  const yamlLines = yamlText.split("\n").length
  const startLine = 1
  const endLine = yamlLines + 2 // opening + content + closing ---

  try {
    const data = (parseYaml(yamlText) as Record<string, unknown>) ?? {}
    return { ok: true, data, startLine, endLine, body }
  } catch (e: unknown) {
    type YamlErrorLike = { message?: string; linePos?: Array<{ line: number; col: number }> }
    const err = e as YamlErrorLike
    return {
      ok: false,
      error: err.message ?? "Invalid YAML",
      line: err.linePos?.[0]?.line,
      col: err.linePos?.[0]?.col,
      startLine,
      endLine,
      body,
    }
  }
}

export function analyzeSections(body: string): {
  required: SectionStatus[]
  recommended: SectionStatus[]
  requiredPresentCount: number
  recommendedPresentCount: number
} {
  const required = REQUIRED_SECTIONS.map((s) => ({
    name: s.name,
    present: s.re.test(body),
    required: true,
  }))
  const recommended = RECOMMENDED_SECTIONS.map((s) => ({
    name: s.name,
    present: s.re.test(body),
    required: false,
  }))
  return {
    required,
    recommended,
    requiredPresentCount: required.filter((s) => s.present).length,
    recommendedPresentCount: recommended.filter((s) => s.present).length,
  }
}

export function estimateTokens(content: string): number {
  // Rough heuristic — see file header. Real tokens come from Context CI.
  return Math.max(0, Math.round(content.length / 4))
}

export function countLines(content: string): number {
  return content.split("\n").length
}
