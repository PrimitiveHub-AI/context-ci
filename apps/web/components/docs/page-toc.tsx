/**
 * "On this page" TOC sidebar.
 *
 * Renders a flat list of h2 + h3 anchors extracted from the
 * underlying markdown source. h3s are indented under their parent
 * h2 visually but the list is flat structurally — simpler than a
 * nested tree and matches the way docs corpus headings actually
 * read.
 *
 * Server-rendered (no client JS for static rendering). Sticky
 * positioning is CSS-only; no scrollspy in v0.1. Scrollspy + a
 * mobile-friendly collapsing variant land in a future PR.
 */

import { type TocEntry } from "@/lib/markdown/toc"

interface PageTocProps {
  entries: readonly TocEntry[]
}

export function PageToc({ entries }: PageTocProps) {
  if (entries.length === 0) return null
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={entry.depth === 3 ? "pl-3" : undefined}
          >
            <a
              href={`#${entry.id}`}
              className={
                entry.depth === 2
                  ? "block py-0.5 text-foreground/80 transition-colors hover:text-primary"
                  : "block py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
