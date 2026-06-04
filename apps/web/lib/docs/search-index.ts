/**
 * Search index builder for the docs corpus.
 *
 * Walks every page in DOC_PAGES, ADR_PAGES, SPEC_PAGES; reads the
 * markdown source; extracts h2/h3 + a short snippet; emits a flat
 * JSON document the client-side search palette consumes.
 *
 * Built once at module load (Next.js server-component evaluation
 * time). The index is small enough (~80 pages × ~10 headings each =
 * ~800 entries) that we ship the whole thing client-side and do
 * substring matching in memory — no Pagefind / Algolia dep.
 *
 * Each SearchEntry has a stable URL: page-level entries link to the
 * page root; heading entries link to `#<id>` so a click jumps to
 * the matching section.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { ADR_PAGES } from "../decisions"
import { DOC_PAGES } from "../docs"
import { findDocsRoot } from "../markdown/discovery"
import { extractToc, type TocEntry } from "../markdown/toc"
import { SPEC_PAGES } from "../specs"

export type SearchSection = "docs" | "decisions" | "specs"

export interface SearchEntry {
  /** Title of the parent page (always present, used as primary label for page-level entries). */
  pageTitle: string
  /** Section the page lives in. */
  section: SearchSection
  /** Page URL (no fragment). */
  pageUrl: string
  /** Heading text — when this is a heading entry, the visible label. */
  headingText?: string
  /** Heading anchor — when this is a heading entry, append #<id> to pageUrl. */
  headingId?: string
  /** h2 (top-level heading inside the page) or h3. */
  headingDepth?: 2 | 3
  /** One-line description (page-level entries only). */
  description?: string
}

interface SearchPage {
  section: SearchSection
  pageTitle: string
  pageUrl: string
  description: string
  source: string
}

const DOCS_ROOT = findDocsRoot()

function pageSources(): SearchPage[] {
  const out: SearchPage[] = []
  for (const p of DOC_PAGES) {
    out.push({
      section: "docs",
      pageTitle: p.title,
      pageUrl: `/docs/${p.slug}`,
      description: p.description,
      source: safeRead(join(DOCS_ROOT, "usage", p.file)),
    })
  }
  for (const a of ADR_PAGES) {
    out.push({
      section: "decisions",
      pageTitle: `ADR-${a.number}: ${a.title}`,
      pageUrl: `/decisions/${a.slug}`,
      description: `${a.status}${a.date ? ` · ${a.date}` : ""}`,
      source: safeRead(join(DOCS_ROOT, "decisions", a.file)),
    })
  }
  for (const s of SPEC_PAGES) {
    out.push({
      section: "specs",
      pageTitle: s.title,
      pageUrl: `/specs/${s.slug}`,
      description: s.description,
      source: safeRead(join(DOCS_ROOT, s.file)),
    })
  }
  return out
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

/**
 * Build the flat index. Cached at module level so subsequent calls
 * during a single server-component render reuse the result.
 */
let cached: SearchEntry[] | null = null

export function getSearchIndex(): SearchEntry[] {
  if (cached !== null) return cached
  const out: SearchEntry[] = []
  for (const p of pageSources()) {
    // Page-level entry.
    out.push({
      section: p.section,
      pageTitle: p.pageTitle,
      pageUrl: p.pageUrl,
      description: p.description,
    })
    // Per-heading entries.
    const toc: TocEntry[] = extractToc(p.source)
    for (const t of toc) {
      out.push({
        section: p.section,
        pageTitle: p.pageTitle,
        pageUrl: p.pageUrl,
        headingText: t.text,
        headingId: t.id,
        headingDepth: t.depth,
      })
    }
  }
  cached = out
  return out
}
