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

        <section className="mt-16 rounded-lg border border-border bg-card/50 p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Authoritative references
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These pages are end-user docs. The wire-format specs, ADRs,
            and conformance suites live under{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
              docs/
            </code>{" "}
            in the repo:
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>
              <span className="font-mono text-xs">docs/trust-contract-v0.1.md</span> —
              wire format
            </li>
            <li>
              <span className="font-mono text-xs">docs/context-ci-top-10-v0.1.md</span> —
              threat taxonomy
            </li>
            <li>
              <span className="font-mono text-xs">docs/context-policy-v0.1.md</span> —
              policy spec
            </li>
            <li>
              <span className="font-mono text-xs">docs/decisions/*.md</span> —
              architecture decisions
            </li>
          </ul>
        </section>
      </main>
    </>
  )
}
