/**
 * Path-pattern classifier for agent-context artifacts.
 *
 * Maps a repo-relative path to one of the artifact classes in the
 * Context CI Top 10 v0.1 classification list (per ADR-0025 §
 * "Discovery scope"). Pure function; no I/O.
 *
 * The classifier is deterministic and auditable — no LLM heuristic.
 * New artifact classes are added by extending this file AND the spec
 * table in `docs/decisions/0025-active-posture-and-phub-audit.md` AND
 * the Top 10 spec (ADR-0016) in the same PR.
 */

/**
 * The closed set of artifact classes phub v0.1 recognizes.
 *
 * Ordering matches the discovery-scope table in ADR-0025 — more
 * specific classes appear before less specific ones so reporters can
 * group consistently.
 */
export const ARTIFACT_CLASSES = [
  "agents-md",
  "claude-md",
  "cursor-rules",
  "windsurf-rules",
  "aider-config",
  "copilot-instructions",
  "claude-skill",
  "claude-agent",
  "claude-command",
  "primitive",
  "skill",
  "prompt",
  "mcp-config",
] as const

export type ArtifactClass = (typeof ARTIFACT_CLASSES)[number]

/**
 * Classes whose content is markdown/plain-text and therefore scannable
 * with the current T1/T2/T5 detector roster. The remaining classes
 * (e.g. `mcp-config`) are classified for inventory but get their own
 * detector family in a future PR.
 */
const TEXT_SCANNABLE: ReadonlySet<ArtifactClass> = new Set<ArtifactClass>([
  "agents-md",
  "claude-md",
  "cursor-rules",
  "windsurf-rules",
  "copilot-instructions",
  "claude-skill",
  "claude-agent",
  "claude-command",
  "primitive",
  "skill",
  "prompt",
])

/** True if a class's content runs through the markdown-text detectors. */
export function isTextScannable(cls: ArtifactClass): boolean {
  return TEXT_SCANNABLE.has(cls)
}

/**
 * Classify a path. Input is a relative path from the audit root using
 * forward slashes (the walker normalizes Windows paths before calling).
 * Returns null when the path is not a known context artifact.
 */
export function classify(relPath: string): ArtifactClass | null {
  const norm = relPath.replace(/\\/g, "/")
  const segments = norm.split("/").filter((s) => s.length > 0)
  if (segments.length === 0) return null
  const base = segments[segments.length - 1] ?? ""

  // Dotfile bases — match by exact basename.
  if (base === ".cursorrules") return "cursor-rules"
  if (base === ".windsurfrules") return "windsurf-rules"
  if (base === ".aider.conf.yml" || base === ".aiderignore") return "aider-config"

  // Github copilot instructions — anchored at any `.github/` ancestor.
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === ".github" && segments[i + 1] === "copilot-instructions.md" && i + 1 === segments.length - 1) {
      return "copilot-instructions"
    }
  }

  // .claude/{skills,agents,commands}/**/*.md
  const claudeIdx = segments.indexOf(".claude")
  if (claudeIdx >= 0 && base.endsWith(".md")) {
    const next = segments[claudeIdx + 1]
    if (next === "skills") return "claude-skill"
    if (next === "agents") return "claude-agent"
    if (next === "commands") return "claude-command"
  }

  // .cursor/rules/** — Cursor's MDC rules subtree.
  if (segments.includes(".cursor") && segments.includes("rules")) {
    if (base.endsWith(".md") || base.endsWith(".mdc")) return "cursor-rules"
  }

  // MCP config (JSON) — basename match.
  if (base === "mcp.json" || base.endsWith(".mcp.json")) return "mcp-config"

  // Bare project files anywhere in the tree.
  if (base === "AGENTS.md") return "agents-md"
  if (base === "CLAUDE.md") return "claude-md"
  if (base === "SKILL.md") return "skill"

  // Directory-bucket classes — only for .md files.
  if (!base.endsWith(".md")) return null
  if (segments.includes("primitives")) return "primitive"
  if (segments.includes("skills")) return "skill"
  if (segments.includes("prompts")) return "prompt"

  return null
}
