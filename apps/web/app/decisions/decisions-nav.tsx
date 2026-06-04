import Link from "next/link"

import { ADR_PAGES, type AdrStatus } from "@/lib/decisions"
import { cn } from "@/lib/utils"

interface DecisionsNavProps {
  currentSlug?: string
}

const STATUS_TONE: Record<AdrStatus, string> = {
  Accepted: "text-emerald-400",
  Proposed: "text-amber-400",
  Superseded: "text-muted-foreground line-through",
  Deprecated: "text-muted-foreground line-through",
  Unknown: "text-muted-foreground",
}

export function DecisionsNav({ currentSlug }: DecisionsNavProps) {
  return (
    <nav aria-label="Decisions" className="space-y-1">
      <Link
        href="/decisions"
        className={cn(
          "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
          currentSlug === undefined
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        Index
      </Link>
      <div className="my-2 border-t border-border" />
      <ol className="space-y-0.5">
        {ADR_PAGES.map((adr) => {
          const isActive = adr.slug === currentSlug
          return (
            <li key={adr.slug}>
              <Link
                href={`/decisions/${adr.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-start gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="font-mono tabular-nums opacity-60">{adr.number}</span>
                <span className="flex-1 leading-snug">{adr.title}</span>
                {adr.status !== "Accepted" && adr.status !== "Unknown" && (
                  <span className={cn("text-[10px] uppercase", STATUS_TONE[adr.status])}>
                    {adr.status.slice(0, 4)}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
