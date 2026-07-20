import { dirname, relative, resolve } from "node:path"

import { ADR_PAGES } from "../decisions"
import { DOC_PAGES } from "../docs"
import { findDocsRoot } from "./discovery"
import { SPEC_PAGES } from "../specs"

/**
 * Build a single table of `repo/path → app route` for every page
 * we render. Lookups are by repo-relative path so the source
 * location of the markdown is irrelevant.
 */
function buildRouteMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const page of DOC_PAGES) {
    map.set(`docs/usage/${page.file}`, `/docs/${page.slug}`)
  }
  for (const adr of ADR_PAGES) {
    map.set(`docs/decisions/${adr.file}`, `/decisions/${adr.slug}`)
  }
  for (const spec of SPEC_PAGES) {
    map.set(`docs/${spec.file}`, `/specs/${spec.slug}`)
  }
  // The docs index has a known URL too.
  map.set("docs/usage/README.md", "/docs")
  map.set("docs/decisions/README.md", "/decisions")
  return map
}

const ROUTE_MAP = buildRouteMap()
const REPO_ROOT = resolve(findDocsRoot(), "..")

function repoRelative(absPath: string): string {
  const rel = relative(REPO_ROOT, absPath)
  return rel.replace(/\\/g, "/")
}

/**
 * Rewrite a single relative link to its app route, if a match
 * exists. Returns the original href unchanged on no match.
 */
function rewriteLink(href: string, sourceAbsPath: string): string {
  // Only rewrite markdown links — leave external, absolute, anchor,
  // and other-extension links alone.
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("/")
  ) {
    return href
  }
  if (!href.includes(".md")) return href

  const [filePart, anchor] = href.split("#")
  const absolute = resolve(dirname(sourceAbsPath), filePart)
  const repoPath = repoRelative(absolute)
  const route = ROUTE_MAP.get(repoPath)
  if (!route) return href
  return anchor ? `${route}#${anchor}` : route
}

/**
 * Apply link rewriting across an entire markdown source. Operates
 * on standard `](href)` link syntax. Does not touch reference-style
 * links (`[text][ref]`) — none of our docs use them.
 */
export function rewriteMarkdownLinks(source: string, sourceAbsPath: string): string {
  return source.replace(
    /\]\(([^)\s]+(?:#[^)\s]+)?)\)/g,
    (_match, href: string) => `](${rewriteLink(href, sourceAbsPath)})`,
  )
}

/**
 * Strip the per-page "[← back to index] · prev · next →" banner
 * that the usage docs carry — the sidebar replaces it on the web.
 */
export function stripBackToIndexBanner(source: string): string {
  return source.replace(/^> \[← back to index\][^\n]*\n+/m, "")
}

/**
 * Strip an authored in-body "## Table of contents" section — the
 * sticky "On this page" sidebar (PageToc) already covers it, so
 * rendering both is a visible duplicate.
 *
 * Conservative on purpose: matches only an H2 whose text is literally
 * "Table of contents" (case-insensitive), and removes everything from
 * that heading up to — but not including — the next H1/H2 heading (or
 * end of file). A trailing `---` rule that belongs to the TOC block is
 * swept up in the range; separators outside the block are untouched.
 */
export function stripInBodyTableOfContents(source: string): string {
  return source.replace(
    /^##[ \t]+table of contents[ \t]*#*[ \t]*\r?\n(?:(?!^#{1,2}[ \t]).*\r?\n?)*/im,
    "",
  )
}
