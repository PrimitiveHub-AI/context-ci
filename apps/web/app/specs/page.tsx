import Link from "next/link"

import { SpecsNav } from "./specs-nav"
import { SPEC_PAGES } from "@/lib/specs"

export default function SpecsIndexPage() {
  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SpecsNav />
      </aside>

      <main className="min-w-0">
        <header className="mb-10 space-y-3">
          <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Canonical Specifications
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Specs
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The artifacts the paper references. Stability matters; updates
            ratchet a version and preserve the prior edition for citation.
          </p>
        </header>

        <ol className="grid gap-6">
          {SPEC_PAGES.map((spec) => (
            <li key={spec.slug}>
              <Link
                href={`/specs/${spec.slug}`}
                className="group block rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs tabular-nums uppercase tracking-wider text-muted-foreground">
                    v{spec.version}
                  </span>
                  <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    Read →
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {spec.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {spec.description}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  )
}
