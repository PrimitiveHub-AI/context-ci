import Link from "next/link"

import { DocsNav } from "./docs-nav"
import { DOC_PAGES } from "@/lib/docs"

export default function DocsIndexPage() {
  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <DocsNav />
      </aside>

      <main className="min-w-0">
        <header className="mb-10 space-y-3">
          <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            PrimitiveHub v0.1
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Documentation
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Source-of-truth user docs for the v0.1 surface — phub CLI,
            Context Policy, lockfile, GitHub Action, MCP server, verify
            library. Every example was smoke-tested against the live
            monorepo before publication.
          </p>
        </header>

        <ol className="grid gap-6 sm:grid-cols-2">
          {DOC_PAGES.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/docs/${page.slug}`}
                className="group block h-full rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {String(page.order).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    Read →
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {page.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {page.description}
                </p>
              </Link>
            </li>
          ))}
        </ol>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          <Link
            href="/specs"
            className="group block rounded-lg border border-border bg-card/50 p-6 transition-all hover:border-primary"
          >
            <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Canonical
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              Specifications →
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Trust Contract v0.1, Context CI Top 10 v0.1, Context Policy
              Language v0.1, the Primitive Spec, the Threat Model. Citable,
              versioned, paper-referenced.
            </p>
          </Link>
          <Link
            href="/decisions"
            className="group block rounded-lg border border-border bg-card/50 p-6 transition-all hover:border-primary"
          >
            <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Architecture
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              Decisions →
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every load-bearing architectural choice with context,
              alternatives, and consequences. 40+ ADRs covering the v0.1
              surface.
            </p>
          </Link>
        </section>
      </main>
    </>
  )
}
