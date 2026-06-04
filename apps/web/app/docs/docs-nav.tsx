import Link from "next/link"

import { cn } from "@/lib/utils"

import { DOC_PAGES } from "@/lib/docs"

interface DocsNavProps {
  currentSlug?: string
}

export function DocsNav({ currentSlug }: DocsNavProps) {
  return (
    <nav aria-label="Documentation" className="space-y-1">
      <Link
        href="/docs"
        className={cn(
          "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
          currentSlug === undefined
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        Overview
      </Link>
      <div className="my-2 border-t border-border" />
      <ol className="space-y-0.5">
        {DOC_PAGES.map((page) => {
          const isActive = page.slug === currentSlug
          return (
            <li key={page.slug}>
              <Link
                href={`/docs/${page.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-baseline gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="font-mono text-xs tabular-nums opacity-60">
                  {String(page.order).padStart(2, "0")}
                </span>
                <span>{page.title}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
