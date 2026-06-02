import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { walk, DEFAULT_WALK_OPTIONS } from "../src/audit/walker.js"

function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "phub-audit-walker-"))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(join(abs, ".."), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

describe("walk", () => {
  let root: string

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("returns every file in a clean tree, sorted stably", () => {
    root = makeTree({
      "AGENTS.md": "hi",
      "src/index.ts": "ok",
      "apps/api/AGENTS.md": "nested",
    })
    const r = walk(root, DEFAULT_WALK_OPTIONS)
    const rels = r.files.map((f) => relative(root, f)).sort()
    expect(rels).toEqual(["AGENTS.md", "apps/api/AGENTS.md", "src/index.ts"])
    expect(r.truncated).toBe(false)
  })

  it("skips node_modules / .git / dist / build / .next / coverage", () => {
    root = makeTree({
      "AGENTS.md": "keep",
      "node_modules/junk/foo.js": "x",
      ".git/HEAD": "ref",
      "dist/bundle.js": "y",
      "build/out.js": "z",
      ".next/cache.js": "w",
      "coverage/report.html": "v",
    })
    const r = walk(root, DEFAULT_WALK_OPTIONS)
    const rels = r.files.map((f) => relative(root, f))
    expect(rels).toEqual(["AGENTS.md"])
    const skipReasons = new Set(r.skipped.map((s) => s.reason))
    expect(skipReasons).toContain("skip-list")
  })

  it("skips dot-prefixed dirs except .claude/.cursor/.github", () => {
    root = makeTree({
      ".secret/key": "no",
      ".claude/skills/foo.md": "yes",
      ".cursor/rules/typescript.md": "yes",
      ".github/copilot-instructions.md": "yes",
    })
    const r = walk(root, DEFAULT_WALK_OPTIONS)
    const rels = r.files.map((f) => relative(root, f)).sort()
    expect(rels).toEqual([
      ".claude/skills/foo.md",
      ".cursor/rules/typescript.md",
      ".github/copilot-instructions.md",
    ])
    const hidden = r.skipped.filter((s) => s.reason === "hidden-dir")
    expect(hidden.some((s) => s.path === ".secret")).toBe(true)
  })

  it("does NOT follow symlinks (records them as skipped)", () => {
    root = makeTree({ "AGENTS.md": "real" })
    // Create a self-loop symlink that would otherwise hang a recursive walker.
    try {
      symlinkSync(root, join(root, "loop"))
    } catch {
      // Some test environments (Windows w/o admin) can't create symlinks.
      return
    }
    const r = walk(root, DEFAULT_WALK_OPTIONS)
    expect(r.skipped.some((s) => s.reason === "symlink")).toBe(true)
    expect(r.files.length).toBe(1)
  })

  it("honors maxFiles by truncating + flagging", () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 20; i++) files[`primitives/p${i}.md`] = "x"
    root = makeTree(files)
    const r = walk(root, { maxDepth: 12, maxFiles: 5 })
    expect(r.truncated).toBe(true)
    expect(r.files.length).toBe(5)
    expect(r.skipped.some((s) => s.reason === "limit")).toBe(true)
  })

  it("honors maxDepth", () => {
    root = makeTree({
      "a/b/c/d/e/f/deep.md": "deep",
      "shallow.md": "ok",
    })
    const r = walk(root, { maxDepth: 2, maxFiles: 100 })
    const rels = r.files.map((f) => relative(root, f))
    expect(rels).toContain("shallow.md")
    expect(rels.some((p) => p.endsWith("deep.md"))).toBe(false)
    expect(r.skipped.some((s) => s.reason === "depth")).toBe(true)
  })

  it("returns the file directly when root is a single file", () => {
    root = makeTree({ "AGENTS.md": "single" })
    const target = join(root, "AGENTS.md")
    const r = walk(target, DEFAULT_WALK_OPTIONS)
    expect(r.files).toEqual([target])
    expect(r.truncated).toBe(false)
  })

  it("throws on a nonexistent root", () => {
    expect(() => walk("/tmp/this-path-does-not-exist-phub-test-xyz", DEFAULT_WALK_OPTIONS)).toThrow()
  })
})
