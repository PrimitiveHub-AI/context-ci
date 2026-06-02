import { describe, expect, it } from "vitest"

import { matchGlob, matchAnyGlob } from "../src/policy/glob.js"

describe("matchGlob — basename matching", () => {
  it("matches a basename literal at any depth", () => {
    expect(matchGlob("CLAUDE.md", "CLAUDE.md")).toBe(true)
    expect(matchGlob("CLAUDE.md", "/srv/app/CLAUDE.md")).toBe(true)
    expect(matchGlob("CLAUDE.md", "a/b/c/CLAUDE.md")).toBe(true)
  })

  it("does NOT match unrelated basenames", () => {
    expect(matchGlob("CLAUDE.md", "README.md")).toBe(false)
    expect(matchGlob("CLAUDE.md", "claude.md")).toBe(false) // case-sensitive
  })
})

describe("matchGlob — wildcards", () => {
  it("* matches one segment, no /", () => {
    expect(matchGlob("docs/*.md", "docs/foo.md")).toBe(true)
    expect(matchGlob("docs/*.md", "docs/sub/foo.md")).toBe(false)
  })

  it("** matches any depth (including zero)", () => {
    expect(matchGlob("docs/**/*.md", "docs/foo.md")).toBe(true)
    expect(matchGlob("docs/**/*.md", "docs/sub/foo.md")).toBe(true)
    expect(matchGlob("docs/**/*.md", "docs/a/b/c/foo.md")).toBe(true)
  })

  it("** with prefix matches files at the root of the prefix", () => {
    expect(matchGlob("**/AGENTS.md", "AGENTS.md")).toBe(true)
    expect(matchGlob("**/AGENTS.md", "apps/web/AGENTS.md")).toBe(true)
  })

  it("? matches one character (excluding /)", () => {
    expect(matchGlob("file?.md", "file1.md")).toBe(true)
    expect(matchGlob("file?.md", "file12.md")).toBe(false)
    expect(matchGlob("file?.md", "fil/.md")).toBe(false)
  })
})

describe("matchGlob — regex special chars are escaped", () => {
  it("escapes . correctly (literal, not 'any char')", () => {
    expect(matchGlob("file.md", "fileXmd")).toBe(false)
    expect(matchGlob("file.md", "file.md")).toBe(true)
  })

  it("does not allow regex injection via brackets/anchors", () => {
    expect(matchGlob("file[abc].md", "filea.md")).toBe(false)
    expect(matchGlob("file[abc].md", "file[abc].md")).toBe(true)
  })
})

describe("matchAnyGlob", () => {
  it("returns true if ANY pattern matches", () => {
    expect(matchAnyGlob(["a.md", "b.md"], "b.md")).toBe(true)
    expect(matchAnyGlob(["a.md", "b.md"], "c.md")).toBe(false)
  })

  it("empty pattern list never matches", () => {
    expect(matchAnyGlob([], "anything.md")).toBe(false)
  })
})
