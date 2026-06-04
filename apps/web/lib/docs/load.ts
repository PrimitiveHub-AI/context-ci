import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { fileToSlug } from "./index"

/**
 * Discover the repo's docs/usage/ directory. Walks up from the
 * compiled module location (or process.cwd()) looking for a sibling
 * docs/usage/. Works in both dev mode (cwd = apps/web) and in
 * container builds where the repo is copied to /app.
 */
function findDocsUsageDir(): string {
  const candidates: string[] = []

  // 1. Walk up from the source file's directory.
  try {
    const __filename = fileURLToPath(import.meta.url)
    let cursor = dirname(__filename)
    for (let i = 0; i < 10; i++) {
      candidates.push(join(cursor, "docs", "usage"))
      const parent = resolve(cursor, "..")
      if (parent === cursor) break
      cursor = parent
    }
  } catch {
    // ESM may not be available in every runtime; skip.
  }

  // 2. Walk up from cwd.
  let cursor = process.cwd()
  for (let i = 0; i < 10; i++) {
    candidates.push(join(cursor, "docs", "usage"))
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "README.md"))) return candidate
  }
  throw new Error(
    `could not locate docs/usage/ — searched ${candidates.length} candidates: ${candidates.slice(0, 5).join(", ")}…`,
  )
}

const DOCS_DIR = findDocsUsageDir()

/**
 * Read raw markdown for the named file under docs/usage/.
 * Throws if the file doesn't exist.
 */
export function readDocSource(file: string): string {
  const fullPath = join(DOCS_DIR, file)
  if (!existsSync(fullPath)) {
    throw new Error(`docs/usage/${file} not found at ${fullPath}`)
  }
  return readFileSync(fullPath, "utf8")
}

/**
 * Pre-process markdown before MDX rendering:
 *
 * 1. Rewrite intra-docs relative links (./03-context-policy.md →
 *    /docs/context-policy) so internal navigation stays clean.
 * 2. Rewrite anchors of the form (./03-context-policy.md#section)
 *    too.
 * 3. Strip the leading "[← back to index] · prev · next" navigation
 *    line — the sidebar replaces it.
 * 4. Leave links to ../decisions/*.md, ../*.md (specs), ../../packages/…
 *    as relative — they remain raw GitHub-style paths for now. Future
 *    work: a separate `/decisions/[slug]` route + spec routes.
 */
export function preprocessDocMarkdown(source: string): string {
  let processed = source

  // Strip the "[← back to index] · prev · next →" line that every
  // page carries; the sidebar replaces it on the web.
  processed = processed.replace(/^> \[← back to index\][^\n]*\n+/m, "")

  // Rewrite local "./NN-name.md" + "./NN-name.md#anchor" links.
  processed = processed.replace(
    /\]\(\.\/(\d{2}-[a-z0-9-]+)\.md(#[a-zA-Z0-9-]+)?\)/g,
    (_match, filename: string, anchor: string | undefined) => {
      const slug = fileToSlug(`${filename}.md`)
      if (!slug) return `](./${filename}.md${anchor ?? ""})`
      return `](/docs/${slug}${anchor ?? ""})`
    },
  )

  // Same rewrite for "./README.md" → "/docs"
  processed = processed.replace(/\]\(\.\/README\.md\)/g, "](/docs)")

  return processed
}
