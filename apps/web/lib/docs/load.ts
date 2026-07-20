import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { findDocsRoot } from "../markdown/discovery"
import {
  rewriteMarkdownLinks,
  stripBackToIndexBanner,
  stripInBodyTableOfContents,
} from "../markdown/link-rewriter"

const DOCS_USAGE_DIR = join(findDocsRoot(), "usage")

/**
 * Read raw markdown for the named file under docs/usage/.
 * Throws if the file doesn't exist.
 */
export function readDocSource(file: string): string {
  const fullPath = join(DOCS_USAGE_DIR, file)
  if (!existsSync(fullPath)) {
    throw new Error(`docs/usage/${file} not found at ${fullPath}`)
  }
  return readFileSync(fullPath, "utf8")
}

/**
 * Pre-process markdown for web rendering:
 *
 * 1. Strip the per-page back-to-index banner — the sidebar covers it.
 * 2. Strip an authored in-body "## Table of contents" — the sticky
 *    "On this page" sidebar already covers it, so both is a duplicate.
 * 3. Rewrite intra-docs + cross-section relative links via the shared
 *    link-rewriter (knows /docs + /decisions + /specs URL spaces).
 */
export function preprocessDocMarkdown(source: string, file: string): string {
  const sourceAbsPath = join(DOCS_USAGE_DIR, file)
  const stripped = stripInBodyTableOfContents(stripBackToIndexBanner(source))
  return rewriteMarkdownLinks(stripped, sourceAbsPath)
}
