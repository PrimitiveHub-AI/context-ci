import Link from "next/link"
import { FileCheck2, ShieldAlert, BookKey, ArrowUpRight } from "lucide-react"

/**
 * Trust Runtime three-pillar section.
 *
 * Names the architecture that the project ships against: Trust
 * Contract (verification wire format), Context CI Top 10 (threat
 * taxonomy), CBOM (inventory artifact). Each card links to its
 * canonical spec page under /specs.
 *
 * This is the **operational identity** of the project — the same
 * three pillars named in docs/doctrine.md, docs/execution-plan.md,
 * and the paper. The homepage gives that architecture a visible
 * home so a first-time visitor learns the structure without
 * reading the doctrine.
 */

interface Pillar {
  icon: typeof FileCheck2
  name: string
  tagline: string
  description: string
  specSlug: string
  versionLabel: string
}

const PILLARS: readonly Pillar[] = [
  {
    icon: FileCheck2,
    name: "Trust Contract",
    tagline: "The wire format.",
    description:
      "Subject + content + attestation, signed end-to-end. Conformance-suite enforced. The verification contract every consumer agrees on.",
    specSlug: "trust-contract-v0.1",
    versionLabel: "v0.1",
  },
  {
    icon: ShieldAlert,
    name: "Context CI Top 10",
    tagline: "The threat taxonomy.",
    description:
      "Ten categories — CCI-001 through CCI-010 — with stable IDs, severity ranges, and a mechanical detector roster shipping in both Python and TypeScript.",
    specSlug: "context-ci-top-10-v0.1",
    versionLabel: "v0.1 · 10 / 10 shipped",
  },
  {
    icon: BookKey,
    name: "CBOM",
    tagline: "The inventory artifact.",
    description:
      "Context Bill of Materials. A reproducible, content-addressed enumeration of every agent-context artifact, with SPDX 2.3 and CycloneDX 1.5 projections.",
    specSlug: "cbom-v0.1",
    versionLabel: "v0.1",
  },
] as const

export function TrustRuntimeSection() {
  return (
    <section className="border-y border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            The Trust Runtime
          </p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Three pillars defending the agent-context supply chain.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            PrimitiveHub is the Context Firewall for AI agents — not a
            prompt registry, not a marketplace. Every defense the project
            ships fits into one of three pillars, each a versioned public
            spec with its own conformance suite and ratchet discipline.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px md:grid-cols-3 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <Link
                key={pillar.name}
                href={`/specs/${pillar.specSlug}`}
                className="group relative flex flex-col bg-card p-6 transition-colors hover:bg-card/80"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/[0.07] text-primary">
                    <Icon className="size-4" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pillar {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-lg font-semibold text-foreground">
                    {pillar.name}
                  </h3>
                  <p className="mt-1 text-xs font-mono text-primary/70">
                    {pillar.tagline}
                  </p>
                </div>

                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {pillar.description}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4 text-xs">
                  <span className="font-mono text-muted-foreground/80">
                    {pillar.versionLabel}
                  </span>
                  <span className="flex items-center gap-1 text-primary opacity-80 transition-opacity group-hover:opacity-100">
                    Read spec
                    <ArrowUpRight className="size-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[11px] font-mono text-muted-foreground/70">
          All three pillars ship as versioned public specs · conformance
          suites in both Python &amp; TypeScript · byte-identical
          reproducibility
        </p>
      </div>
    </section>
  )
}
