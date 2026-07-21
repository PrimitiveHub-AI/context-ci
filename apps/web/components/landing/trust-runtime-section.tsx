import Link from "next/link"
import {
  FileCheck2,
  ShieldAlert,
  BookKey,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react"

import { AVParallelMap } from "@/components/landing/av-parallel-map"
import { loadLatestEvaluation, summarize } from "@/lib/evaluation"
import { docRoute } from "@/lib/site"

/**
 * Trust Runtime three-pillar section — visual upgrade.
 *
 * The pre-upgrade layout was three identical flat cards in a
 * gap-px grid; visually monotonous. The story (three pillars, one
 * trust runtime) and the doctrine references are unchanged; the
 * register changes.
 *
 * Each pillar now carries its own accent color so the eye can
 * distinguish them at a glance:
 *   Pillar 01 Trust Contract  -> primary (cyan)    — the wire format
 *   Pillar 02 Top 10          -> amber             — the threat taxonomy
 *   Pillar 03 CBOM            -> success (green)   — the inventory
 *
 * Each card lifts with a gradient border + shadow; the icon gets a
 * larger per-accent tile; the spec link is more prominent. The
 * AV-parallel sub-block gets a small framed presentation so it
 * reads as the recognition primer it is, not a stray bullet list.
 */


type Accent = "primary" | "amber" | "success"

interface Pillar {
  icon: LucideIcon
  accent: Accent
  name: string
  tagline: string
  description: string
  specSlug: string
  /** Optional secondary link (e.g. operational index for the spec). */
  secondary?: { label: string; href: string }
}

const PILLARS: ReadonlyArray<Pillar> = [
  {
    icon: FileCheck2,
    accent: "primary",
    name: "Trust Contract",
    tagline: "The wire format.",
    description:
      "Subject + content + attestation, signed end-to-end. Conformance-suite enforced. The verification contract every consumer agrees on.",
    specSlug: "trust-contract-v0.1",
  },
  {
    icon: ShieldAlert,
    accent: "amber",
    name: "Context CI Top 10",
    tagline: "The threat taxonomy.",
    description:
      "Ten categories — CCI-001 through CCI-010 — with stable IDs, severity ranges, and a mechanical detector roster shipping in both Python and TypeScript.",
    specSlug: "context-ci-top-10-v0.1",
    secondary: {
      label: "Corpus-mapped taxonomy",
      href: docRoute("docs/top10-corpus-map.md"),
    },
  },
  {
    icon: BookKey,
    accent: "success",
    name: "CBOM",
    tagline: "The inventory artifact.",
    description:
      "Context Bill of Materials. A reproducible, content-addressed enumeration of every agent-context artifact, with SPDX 2.3 and CycloneDX 1.5 projections.",
    specSlug: "cbom-v0.1",
  },
]

const accentBorderGradient: Record<Accent, string> = {
  primary: "from-primary/30 via-primary/10 to-transparent",
  amber: "from-amber/30 via-amber/10 to-transparent",
  success: "from-success/30 via-success/10 to-transparent",
}

const accentIconBg: Record<Accent, string> = {
  primary: "bg-primary/[0.12] border-primary/30 text-primary",
  amber: "bg-amber/[0.12] border-amber/30 text-amber",
  success: "bg-success/[0.12] border-success/30 text-success",
}

const accentTagline: Record<Accent, string> = {
  primary: "text-primary/85",
  amber: "text-amber/90",
  success: "text-success/90",
}

const accentLinkText: Record<Accent, string> = {
  primary: "text-primary/90 group-hover:text-primary",
  amber: "text-amber group-hover:text-amber/90",
  success: "text-success/90 group-hover:text-success",
}

export function TrustRuntimeSection() {
  const summary = summarize(loadLatestEvaluation())

  const versionLabel = (slug: string): string =>
    slug === "context-ci-top-10-v0.1" ? `v${summary.top10Version}` : "v0.1"

  return (
    <section className="relative border-y border-border/40 overflow-hidden">
      {/* Layered backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_195/0.05)_0%,transparent_55%)]"
      />
      <div className="bg-grid absolute inset-0 opacity-[0.10]" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-6 lg:py-24">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            The Trust Runtime
          </p>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl text-balance">
            Three pillars defending the agent-context supply chain.
          </h2>
          <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            PrimitiveHub is the Context Firewall for AI agents — not a
            prompt registry, not a marketplace. Every defense the project
            ships fits into one of three pillars, each a versioned public
            spec with its own conformance suite and ratchet discipline.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {PILLARS.map((pillar, i) => (
            <PillarCard key={pillar.name} pillar={pillar} index={i} versionLabel={versionLabel(pillar.specSlug)} />
          ))}
        </div>

        {/* AV-parallel primer (compact). The component handles its own
            visual treatment; we just give it the breathing room and a
            small section label so it reads as the recognition primer
            it is. */}
        <div className="mt-14">
          <p className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Recognition primer
          </p>
          <AVParallelMap variant="compact" />
        </div>

        {/* Footer caption — one proof path. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1">
            <span className="size-1 rounded-full bg-primary/70" />
            Versioned public specs
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1">
            <span className="size-1 rounded-full bg-amber/70" />
            Python ↔ TypeScript conformance
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1">
            <span className="size-1 rounded-full bg-success/70" />
            Byte-identical reproducibility
          </span>
          <a
            href={docRoute("docs/evaluation.md")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary/90 hover:text-primary"
          >
            see the scoreboard <ArrowUpRight className="size-2.5" />
          </a>
        </div>
      </div>
    </section>
  )
}

function PillarCard({
  pillar,
  index,
  versionLabel,
}: {
  pillar: Pillar
  index: number
  versionLabel: string
}) {
  const Icon = pillar.icon
  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-br ${accentBorderGradient[pillar.accent]} p-px shadow-2xl shadow-black/30 transition-transform hover:-translate-y-1`}
    >
      <div className="h-full rounded-[15px] bg-background/85 backdrop-blur-sm p-6 flex flex-col">
        {/* Header — icon + pillar number */}
        <div className="flex items-center justify-between mb-5">
          <div
            className={`flex size-11 items-center justify-center rounded-lg border ${accentIconBg[pillar.accent]}`}
          >
            <Icon className="size-5" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Pillar {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Title + tagline */}
        <h3 className="text-xl font-semibold text-foreground">{pillar.name}</h3>
        <p className={`mt-1 text-xs font-mono ${accentTagline[pillar.accent]}`}>
          {pillar.tagline}
        </p>

        {/* Description */}
        <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed flex-1">
          {pillar.description}
        </p>

        {/* Secondary link if any */}
        {pillar.secondary && (
          <a
            href={pillar.secondary.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground transition-colors hover:text-foreground"
          >
            {pillar.secondary.label}
            <ArrowUpRight className="size-3" />
          </a>
        )}

        {/* Spec link footer */}
        <Link
          href={`/specs/${pillar.specSlug}`}
          className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-xs"
        >
          <span className="font-mono text-muted-foreground/80">
            {versionLabel}
          </span>
          <span
            className={`flex items-center gap-1 transition-colors ${accentLinkText[pillar.accent]}`}
          >
            Read spec
            <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Link>
      </div>
    </div>
  )
}
