/**
 * Per-page TOC extractor.
 *
 * Walks markdown source, pulls every h2 + h3 (h1 is the page title;
 * h4+ is too deep for a sticky sidebar), assigns each one a slug
 * using the same `github-slugger` algorithm that `rehype-slug` uses
 * at render time. The two slugs MUST agree — if rehype-slug ever
 * changes its algorithm, the TOC links break visibly.
 *
 * Code fences are stripped before scanning so a comment like
 * `## NotAHeading` inside a code block doesn't pollute the TOC.
 *
 * Pure function; no I/O.
 */

import GithubSlugger from "github-slugger"

export interface TocEntry {
  depth: 2 | 3
  id: string
  text: string
}

const FENCE_RE = /^[ \t]{0,3}(```|~~~)/

/**
 * Strip fenced code blocks so headings inside them aren't picked up.
 * Conservative — only handles ``` and ~~~ fences, the only kinds the
 * docs corpus uses.
 */
function stripFences(source: string): string {
  const out: string[] = []
  let inFence = false
  for (const line of source.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence) out.push(line)
  }
  return out.join("\n")
}

const HEADING_RE = /^(#{2,3})[ \t]+(.+?)[ \t]*#*\s*$/

/**
 * Extract h2/h3 headings from markdown source into a flat list with
 * stable slugs. The TOC component renders this directly — the
 * sidebar's hierarchy is captured by `depth`.
 */
export function extractToc(source: string): TocEntry[] {
  const stripped = stripFences(source)
  const slugger = new GithubSlugger()
  const out: TocEntry[] = []
  for (const line of stripped.split("\n")) {
    const m = HEADING_RE.exec(line)
    if (m === null) continue
    const [, hashes, rawText] = m
    if (hashes === undefined || rawText === undefined) continue
    const depth = (hashes.length === 2 ? 2 : 3) as 2 | 3
    // Strip inline markdown (link brackets, emphasis, code spans) from
    // the visible text. Slug is computed on the original text so it
    // matches what rehype-slug emits — rehype-slug operates on the
    // rendered text content of the heading node, which is the same
    // stripped form.
    const text = stripInlineMarkdown(rawText).trim()
    if (text.length === 0) continue
    const id = slugger.slug(text)
    out.push({ depth, id, text })
  }
  return out
}

const INLINE_MARKDOWN_RE = /\[([^\]]+)\]\([^)]+\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g

function stripInlineMarkdown(text: string): string {
  return text.replace(
    INLINE_MARKDOWN_RE,
    (_match, link, code, strong, em, under) =>
      link ?? code ?? strong ?? em ?? under ?? "",
  )
}
