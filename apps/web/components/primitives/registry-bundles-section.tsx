"use client"

import Link from "next/link"
import { AlertCircle, Package2, ArrowRight } from "lucide-react"

import { BundleCard } from "@/components/primitives/bundle-card"
import { useBundles } from "@/lib/api/queries"
import { bundles as mockBundles } from "@/lib/data/bundles"
import type { Bundle } from "@/lib/types"

/**
 * Bundles section on the Registry page.
 *
 * Per ADR-0040 §2 (one surface per funnel stage), a curated-list page
 * is not its own AV-family slot — it's a discovery aid inside the
 * registry stage. We absorbed the standalone /bundles surface here
 * to honor the anti-bloat contract; the /bundles route now redirects
 * to /registry#bundles.
 */
export function RegistryBundlesSection() {
  const query = useBundles()
  const data: Bundle[] = query.data ?? (query.isError ? mockBundles : [])

  // While the first fetch is in flight and we have no bundles yet,
  // collapse the section entirely — the Registry's primitives grid
  // below is the headline content; we don't want a loading slug
  // pushing it down on first paint.
  if (query.isLoading && data.length === 0) return null

  return (
    <section
      id="bundles"
      className="mb-10 scroll-mt-20 rounded-xl border border-border/40 bg-card/30 p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/[0.07] text-primary">
            <Package2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Bundles
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
              Curated compositions of trusted primitives for a specific
              role. Install a complete cognition stack with{" "}
              <code className="font-mono text-foreground/80">phub install --bundle &lt;slug&gt;</code>.
            </p>
          </div>
        </div>
        <Link
          href="#primitives"
          className="hidden shrink-0 items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          Skip to primitives
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {query.isError && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-amber">
          <AlertCircle className="size-3" />
          api unreachable — showing cached/demo bundles
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.map((bundle) => (
          <BundleCard key={bundle.slug} bundle={bundle} />
        ))}
      </div>
    </section>
  )
}
