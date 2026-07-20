"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PrimitiveCard } from "@/components/primitives/primitive-card"
import { PrimitiveTable } from "@/components/primitives/primitive-table"
import { RegistryBundlesSection } from "@/components/primitives/registry-bundles-section"
import { DemoDataBadge } from "@/components/primitives/demo-data-badge"
import { isEnabled } from "@/lib/flags"
import { ComingSoonPanel } from "@/components/ui/coming-soon"
import { usePrimitives } from "@/lib/api/queries"
import { primitives as mockPrimitives } from "@/lib/data/primitives"
import { categories } from "@/lib/data/categories"
import { agents } from "@/lib/data/agents"
import type { Category, CompatibleAgent, Primitive, TrustStatus } from "@/lib/types"
import { LayoutGrid, List, Search, SlidersHorizontal, X, Package, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const trustStatuses: TrustStatus[] = ["Trusted", "In Review", "Experimental", "Deprecated"]

type ViewMode = "cards" | "table"
const VIEW_STORAGE_KEY = "primitivehub:registry-view"

export default function RegistryPage() {
  if (!isEnabled("registry")) {
    return (
      <ComingSoonPanel
        icon={Package}
        label="Planned · with publishing"
        title="Primitive Registry"
        description="Browse, install, and verify trusted context primitives. The registry ships with publishing — the verifier, /check, and the Context CI Top 10 are live now."
        backHref="/check"
        backLabel="Go to /check"
      />
    )
  }
  return <RegistryBrowser />
}

function RegistryBrowser() {
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<CompatibleAgent | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<TrustStatus | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState<ViewMode>("cards")

  // Load persisted view preference after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
      if (stored === "cards" || stored === "table") setView(stored)
    } catch {
      // ignore (private-mode, etc.)
    }
  }, [])

  function setAndPersistView(next: ViewMode) {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  // Real API call. Loading + error states are rendered below the filters
  // panel so the UI shell + filters stay interactive during a refetch.
  // Falls back to the curated mock list when the API is unreachable —
  // useful in CI / preview environments without a running backend.
  // Remove the fallback once the API is the only source of truth (Step 5).
  const primitivesQuery = usePrimitives({ pageSize: 100 })
  const sourcePrimitives: Primitive[] =
    primitivesQuery.data?.items ?? (primitivesQuery.isError ? mockPrimitives : [])

  const filtered = useMemo(() => {
    return sourcePrimitives.filter((p) => {
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.fileName.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = !selectedCategory || p.category === selectedCategory
      const matchesAgent = !selectedAgent || p.compatibleAgents.includes(selectedAgent)
      const matchesStatus = !selectedStatus || p.status === selectedStatus
      return matchesQuery && matchesCategory && matchesAgent && matchesStatus
    })
  }, [sourcePrimitives, query, selectedCategory, selectedAgent, selectedStatus])

  const hasFilters = selectedCategory || selectedAgent || selectedStatus
  const totalTokens = filtered.reduce((sum, p) => sum + p.tokens, 0)
  const avgQuality = filtered.length
    ? Math.round(filtered.reduce((sum, p) => sum + p.qualityScore, 0) / filtered.length)
    : 0

  return (
    <main className="min-h-screen">
      <div className="relative border-b border-border/40 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.78_0.14_195/0.07)_0%,transparent_55%)]"
        />
        <div className="bg-grid absolute inset-0 opacity-[0.10]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 lg:px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            Trusted Registry
          </p>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl tracking-tight">
            Every primitive carries a digest, an attestation, and a chain.
          </h1>
          <p className="mt-4 text-[15px] text-muted-foreground max-w-2xl leading-relaxed">
            Browse expert-authored AI Context Primitives. Each entry passes
            Context CI, semver-versioned, content-addressed by SHA-256
            digest, scored across four quality dimensions, and signed
            with Sigstore keyless OIDC (Fulcio cert + Rekor entry).
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/[0.06] px-3 py-1 text-success/90">
              <span className="size-1 rounded-full bg-success/80" />
              digest pinned
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1 text-primary/90">
              <span className="size-1 rounded-full bg-primary/80" />
              attested
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/[0.06] px-3 py-1 text-amber/90">
              <span className="size-1 rounded-full bg-amber/80" />
              policy-gated
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1 text-muted-foreground">
              Sigstore keyless OIDC
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {/* Bundles — folded in from the retired /bundles route per
            ADR-0040 §2 (one surface per funnel stage). Renders above
            the primitive search so curated stacks are the first thing
            a visitor sees; the search anchors at #primitives below. */}
        {isEnabled("bundles") && <RegistryBundlesSection />}

        {/* Search bar + view toggle */}
        <div id="primitives" className="scroll-mt-20 flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, category, or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-card border-border/60 h-9 text-sm"
            />
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0 h-9 border-border/60"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="size-3" />
            Filters
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground shrink-0 h-9"
              onClick={() => {
                setSelectedCategory(null)
                setSelectedAgent(null)
                setSelectedStatus(null)
              }}
            >
              <X className="size-3" />
              Clear
            </Button>
          )}

          {/* View toggle */}
          <div
            role="radiogroup"
            aria-label="View mode"
            className="flex items-center gap-0 rounded-md border border-border/60 bg-card h-9 p-0.5 shrink-0"
          >
            <button
              type="button"
              role="radio"
              aria-checked={view === "cards"}
              onClick={() => setAndPersistView("cards")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 h-full rounded-sm text-[11px] font-mono transition-colors",
                view === "cards"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3" />
              Cards
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === "table"}
              onClick={() => setAndPersistView("table")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 h-full rounded-sm text-[11px] font-mono transition-colors",
                view === "table"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3" />
              Table
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-6 space-y-4 rounded-xl border border-border/40 bg-card p-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    className={
                      selectedCategory === cat
                        ? "cursor-pointer bg-primary text-primary-foreground"
                        : "cursor-pointer border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    }
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                Compatible Agent
              </p>
              <div className="flex flex-wrap gap-1.5">
                {agents.map((agent) => (
                  <Badge
                    key={agent}
                    variant={selectedAgent === agent ? "default" : "outline"}
                    className={
                      selectedAgent === agent
                        ? "cursor-pointer bg-primary text-primary-foreground font-mono"
                        : "cursor-pointer border-border/60 text-muted-foreground font-mono hover:text-foreground hover:border-border"
                    }
                    onClick={() => setSelectedAgent(selectedAgent === agent ? null : agent)}
                  >
                    {agent}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                Trust Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {trustStatuses.map((status) => (
                  <Badge
                    key={status}
                    variant={selectedStatus === status ? "default" : "outline"}
                    className={
                      selectedStatus === status
                        ? "cursor-pointer bg-primary text-primary-foreground"
                        : "cursor-pointer border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    }
                    onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API status row — loading / error indicators tie back to the
            TanStack Query state; only visible while the request is in
            flight or has failed. */}
        {primitivesQuery.isLoading && (
          <div className="mb-3 text-[11px] font-mono text-muted-foreground">
            loading from registry…
          </div>
        )}
        {primitivesQuery.isError && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-amber">
            <AlertCircle className="size-3" />
            api unreachable — showing cached/demo data
          </div>
        )}

        {/* Result stats */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground/70 tabular-nums">{filtered.length}</span>{" "}
            primitive{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>
              <span className="font-mono text-foreground/70 tabular-nums">{totalTokens.toLocaleString()}</span> total tokens
            </span>
            <span className="inline-flex items-center gap-1.5">
              avg quality <span className="font-mono text-success tabular-nums">{avgQuality}</span>
              <DemoDataBadge label="demo scores" />
            </span>
          </div>
        </div>

        {/* View — Cards or Table */}
        {filtered.length > 0 && view === "cards" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((primitive) => (
              <PrimitiveCard key={primitive.slug} primitive={primitive} />
            ))}
          </div>
        )}

        {filtered.length > 0 && view === "table" && (
          <PrimitiveTable primitives={filtered} />
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary mb-4">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-foreground mb-1">No primitives match your search</p>
            <p className="text-xs text-muted-foreground mb-4">Try adjusting your filters or search terms.</p>
            <Button
              variant="outline"
              size="sm"
              className="text-primary border-primary/20"
              onClick={() => {
                setQuery("")
                setSelectedCategory(null)
                setSelectedAgent(null)
                setSelectedStatus(null)
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
