import { describe, expect, it } from "vitest"

import { classify, isTextScannable, ARTIFACT_CLASSES } from "../src/audit/classifier.js"

describe("classify (ADR-0025 discovery scope)", () => {
  it("recognizes AGENTS.md at root and nested", () => {
    expect(classify("AGENTS.md")).toBe("agents-md")
    expect(classify("apps/api/AGENTS.md")).toBe("agents-md")
    expect(classify("nested/very/deep/AGENTS.md")).toBe("agents-md")
  })

  it("recognizes CLAUDE.md at root and nested", () => {
    expect(classify("CLAUDE.md")).toBe("claude-md")
    expect(classify("apps/web/CLAUDE.md")).toBe("claude-md")
  })

  it("recognizes IDE rule dotfiles by basename", () => {
    expect(classify(".cursorrules")).toBe("cursor-rules")
    expect(classify(".windsurfrules")).toBe("windsurf-rules")
    expect(classify(".aider.conf.yml")).toBe("aider-config")
    expect(classify(".aiderignore")).toBe("aider-config")
  })

  it("recognizes copilot-instructions only when anchored at .github/", () => {
    expect(classify(".github/copilot-instructions.md")).toBe("copilot-instructions")
    expect(classify("foo/.github/copilot-instructions.md")).toBe("copilot-instructions")
    // Outside .github/, the same filename is just an .md — falls through to null
    // because no directory bucket matches.
    expect(classify("docs/copilot-instructions.md")).toBeNull()
  })

  it("differentiates .claude/{skills,agents,commands}/*.md", () => {
    expect(classify(".claude/skills/code-review.md")).toBe("claude-skill")
    expect(classify(".claude/agents/explore.md")).toBe("claude-agent")
    expect(classify(".claude/commands/init.md")).toBe("claude-command")
  })

  it("recognizes .cursor/rules/**/*.{md,mdc}", () => {
    expect(classify(".cursor/rules/typescript.md")).toBe("cursor-rules")
    expect(classify(".cursor/rules/nested/python.mdc")).toBe("cursor-rules")
  })

  it("classifies MCP config files (not scanned in v0.1)", () => {
    expect(classify("mcp.json")).toBe("mcp-config")
    expect(classify("apps/api/mcp.json")).toBe("mcp-config")
    expect(classify("foo.mcp.json")).toBe("mcp-config")
  })

  it("classifies primitives/skills/prompts directory buckets", () => {
    expect(classify("apps/web/content/primitives/some.md")).toBe("primitive")
    expect(classify("packages/foo/skills/helper.md")).toBe("skill")
    expect(classify("packages/foo/SKILL.md")).toBe("skill")
    expect(classify("docs/prompts/system.md")).toBe("prompt")
  })

  it("returns null for unrelated files", () => {
    expect(classify("README.md")).toBeNull()
    expect(classify("apps/web/lib/data.ts")).toBeNull()
    expect(classify("apps/web/styles/globals.css")).toBeNull()
    expect(classify("notes.txt")).toBeNull()
  })

  it("returns null for non-md files inside primitives/skills buckets", () => {
    expect(classify("apps/web/content/primitives/preview.png")).toBeNull()
    expect(classify("packages/foo/skills/index.ts")).toBeNull()
  })

  it("more-specific classes win over less-specific (claude-skill before skill)", () => {
    // A file under both .claude/skills/ and a generic skills/ bucket
    // should be claude-skill, not skill.
    expect(classify(".claude/skills/code-review.md")).toBe("claude-skill")
  })

  it("normalizes Windows-style separators", () => {
    expect(classify("apps\\api\\AGENTS.md")).toBe("agents-md")
    expect(classify(".claude\\skills\\foo.md")).toBe("claude-skill")
  })
})

describe("isTextScannable", () => {
  it("returns true for markdown-text classes", () => {
    expect(isTextScannable("agents-md")).toBe(true)
    expect(isTextScannable("claude-md")).toBe(true)
    expect(isTextScannable("claude-skill")).toBe(true)
    expect(isTextScannable("primitive")).toBe(true)
    expect(isTextScannable("cursor-rules")).toBe(true)
  })

  it("returns false for mcp-config + aider-config (no v0.1 scanner)", () => {
    expect(isTextScannable("mcp-config")).toBe(false)
    expect(isTextScannable("aider-config")).toBe(false)
  })
})

describe("ARTIFACT_CLASSES", () => {
  it("matches the documented set in ADR-0025", () => {
    expect(ARTIFACT_CLASSES).toEqual([
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
    ])
  })
})
