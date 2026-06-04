import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { findDocsRoot } from "../markdown/discovery"

export type AdrStatus = "Accepted" | "Proposed" | "Superseded" | "Deprecated" | "Unknown"

export interface AdrPage {
  /** "0019-doctrine-versioning-policy" — the URL slug */
  slug: string
  /** "0019" */
  number: string
  /** "Doctrine versioning policy" — extracted from H1 */
  title: string
  /** "0019-doctrine-versioning-policy.md" */
  file: string
  status: AdrStatus
  /** YYYY-MM-DD if parseable */
  date: string | null
}

const ADR_FILENAME_RE = /^(\d{4})-([a-z0-9-]+)\.md$/i

function parseStatus(raw: string): AdrStatus {
  if (raw.startsWith("Accepted")) return "Accepted"
  if (raw.startsWith("Proposed")) return "Proposed"
  if (raw.startsWith("Superseded")) return "Superseded"
  if (raw.startsWith("Deprecated")) return "Deprecated"
  return "Unknown"
}

/**
 * Scan docs/decisions/ at module load time. Each ADR's metadata is
 * extracted from its first 20 lines (H1 + Status + Date). The
 * resulting array is sorted by ADR number descending (newest first)
 * to match the index page's reading order.
 *
 * README.md is excluded — it's the in-repo index, not an ADR.
 */
function discoverAdrPages(): readonly AdrPage[] {
  const decisionsDir = join(findDocsRoot(), "decisions")
  const entries = readdirSync(decisionsDir)
  const pages: AdrPage[] = []

  for (const entry of entries) {
    const match = ADR_FILENAME_RE.exec(entry)
    if (!match) continue
    const [_, number, restOfSlug] = match
    const file = entry
    const slug = `${number}-${restOfSlug}`
    const source = readFileSync(join(decisionsDir, file), "utf8")
    const firstLines = source.split("\n").slice(0, 20)

    // Title: first H1, dropping any "ADR-NNNN:" prefix
    let title = restOfSlug.replace(/-/g, " ")
    for (const line of firstLines) {
      const h1 = /^#\s+(.+)$/.exec(line)
      if (h1) {
        title = h1[1].replace(/^ADR-\d{4}:\s*/, "").trim()
        break
      }
    }

    // Status:
    let status: AdrStatus = "Unknown"
    for (const line of firstLines) {
      const m = /^\*\*Status:\*\*\s*(.+)$/.exec(line)
      if (m) {
        status = parseStatus(m[1].trim())
        break
      }
    }

    // Date:
    let date: string | null = null
    for (const line of firstLines) {
      const m = /^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(line)
      if (m) {
        date = m[1]
        break
      }
    }

    pages.push({ slug, number, title, file, status, date })
  }

  // Newest first by ADR number.
  pages.sort((a, b) => (a.number > b.number ? -1 : a.number < b.number ? 1 : 0))
  return pages
}

export const ADR_PAGES: readonly AdrPage[] = discoverAdrPages()

export function getAdrPage(slug: string): AdrPage | undefined {
  return ADR_PAGES.find((p) => p.slug === slug)
}
