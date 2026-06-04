import Link from "next/link"

import { DecisionsNav } from "./decisions-nav"
import { ADR_PAGES, type AdrStatus } from "@/lib/decisions"
import { cn } from "@/lib/utils"

const STATUS_BADGE: Record<AdrStatus, string> = {
  Accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-700/40",
  Proposed: "bg-amber-500/15 text-amber-300 border-amber-700/40",
  Superseded: "bg-muted text-muted-foreground border-border",
  Deprecated: "bg-muted text-muted-foreground border-border",
  Unknown: "bg-muted text-muted-foreground border-border",
}

export default function DecisionsIndexPage() {
  const accepted = ADR_PAGES.filter((p) => p.status === "Accepted")
  const other = ADR_PAGES.filter((p) => p.status !== "Accepted")

  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <DecisionsNav />
      </aside>

      <main className="min-w-0">
        <header className="mb-10 space-y-3">
          <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Architecture Decision Records
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Decisions
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Every load-bearing architectural choice with enough context that
            future-me — or any new engineer — can understand WHY the system
            looks the way it does without re-deriving the analysis. Newest
            first.
          </p>
        </header>

        <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{ADR_PAGES.length}</span>
          <span>records ·</span>
          <span className="font-mono tabular-nums text-emerald-400">{accepted.length}</span>
          <span>accepted</span>
          {other.length > 0 && (
            <>
              <span>·</span>
              <span className="font-mono tabular-nums">{other.length}</span>
              <span>other</span>
            </>
          )}
        </div>

        <ol className="space-y-2">
          {ADR_PAGES.map((adr) => (
            <li key={adr.slug}>
              <Link
                href={`/decisions/${adr.slug}`}
                className="group flex items-baseline gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10"
              >
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {adr.number}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {adr.title}
                  </h2>
                  {adr.date && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {adr.date}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
                    STATUS_BADGE[adr.status],
                  )}
                >
                  {adr.status}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  )
}
