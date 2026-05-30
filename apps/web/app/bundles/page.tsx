"use client"

import { AlertCircle } from "lucide-react"
import { BundleCard } from "@/components/primitives/bundle-card"
import { useBundles } from "@/lib/api/queries"
import { bundles as mockBundles } from "@/lib/data/bundles"
import type { Bundle } from "@/lib/types"

export default function BundlesPage() {
  // Same mock-fallback-on-error pattern as /registry: API is the source of
  // truth when reachable; mocks keep CI / preview environments rendering.
  const query = useBundles()
  const bundles: Bundle[] = query.data ?? (query.isError ? mockBundles : [])

  const totalBundles = bundles.length
  const totalPrimitives = bundles.reduce((sum, b) => sum + b.primitives.length, 0)
  const totalTokens = bundles.reduce((sum, b) => sum + b.totalTokens, 0)

  return (
    <main className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
            Composable Bundles
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Primitive Bundles</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
            Curated compositions of trusted primitives for specific engineering roles and use
            cases. Install a complete cognition stack for your AI agent with a single command.
            Token budgets calculated automatically.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <span className="font-mono text-foreground/70">{totalBundles}</span> bundles
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-mono text-foreground/70">{totalPrimitives}</span> primitives total
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-mono text-foreground/70">{totalTokens.toLocaleString()}</span> tokens combined
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {query.isLoading && (
          <div className="mb-3 text-[11px] font-mono text-muted-foreground">
            loading from registry…
          </div>
        )}
        {query.isError && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-amber">
            <AlertCircle className="size-3" />
            api unreachable — showing cached/demo data
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.slug} bundle={bundle} />
          ))}
        </div>
      </div>
    </main>
  )
}
