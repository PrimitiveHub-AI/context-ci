import Link from "next/link"

import { SPEC_PAGES } from "@/lib/specs"
import { cn } from "@/lib/utils"

interface SpecsNavProps {
  currentSlug?: string
}

export function SpecsNav({ currentSlug }: SpecsNavProps) {
  return (
    <nav aria-label="Specs" className="space-y-1">
      <Link
        href="/specs"
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
        {SPEC_PAGES.map((spec) => {
          const isActive = spec.slug === currentSlug
          return (
            <li key={spec.slug}>
              <Link
                href={`/specs/${spec.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-baseline gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="font-mono text-xs tabular-nums opacity-60">
                  v{spec.version}
                </span>
                <span className="leading-snug">{spec.title}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
