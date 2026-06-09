import Link from "next/link"
import { FileCheck2, ShieldAlert, BookKey, ArrowUpRight } from "lucide-react"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"

/**
 * Trust Runtime three-pillar section.
 *
 * Names the architecture the project ships against: Trust Contract
 * (verification wire format), Context CI Top 10 (threat taxonomy),
 * CBOM (inventory artifact). Each card links to its canonical spec
 * page under /specs; Top 10 also points at the post-Round-7 corpus
 * map.
 *
 * The version labels and the measured-headline caption read from the
 * latest committed `bench/baseline/*-ts.json` via `lib/evaluation.ts`
 * — same artifact `docs/evaluation.md` is generated from, same
 * artifact the scanner-bench CI gate enforces. No drift possible.
 */

const GH_BASE = "https://github.com/DevXYZx/primitivehub/blob/main"

interface Pillar {
  icon: typeof FileCheck2
  name: string
  tagline: string
  description: string
  specSlug: string
  /** Optional secondary link (e.g. operational index for the spec). */
  secondary?: { label: string; href: string }
}

function PILLARS(): readonly Pillar[] {
  return [
    {
      icon: FileCheck2,
      name: "Trust Contract",
      tagline: "The wire format.",
      description:
        "Subject + content + attestation, signed end-to-end. Conformance-suite enforced. The verification contract every consumer agrees on.",
      specSlug: "trust-contract-v0.1",
    },
    {
      icon: ShieldAlert,
      name: "Context CI Top 10",
      tagline: "The threat taxonomy.",
      description:
        "Ten categories — CCI-001 through CCI-010 — with stable IDs, severity ranges, and a mechanical detector roster shipping in both Python and TypeScript.",
      specSlug: "context-ci-top-10-v0.1",
      secondary: {
        label: "Corpus-mapped taxonomy",
        href: `${GH_BASE}/docs/top10-corpus-map.md`,
      },
    },
    {
      icon: BookKey,
      name: "CBOM",
      tagline: "The inventory artifact.",
      description:
        "Context Bill of Materials. A reproducible, content-addressed enumeration of every agent-context artifact, with SPDX 2.3 and CycloneDX 1.5 projections.",
      specSlug: "cbom-v0.1",
    },
  ]
}

export function TrustRuntimeSection() {
  const summary = summarize(loadLatestEvaluation())
  const pillars = PILLARS()

  // Per-pillar version label — read live from the baseline (no drift).
  // The macro-F1 metric is stated ONCE on the page, in the Hero pill;
  // it is deliberately not restated here (homepage-elite-bar.md).
  const versionLabel = (slug: string): string =>
    slug === "context-ci-top-10-v0.1" ? `v${summary.top10Version}` : "v0.1"

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
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <div
                key={pillar.name}
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

                {pillar.secondary && (
                  <a
                    href={pillar.secondary.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground transition-colors hover:text-primary"
                  >
                    {pillar.secondary.label}
                    <ArrowUpRight className="size-3" />
                  </a>
                )}

                <div className="mt-auto pt-6">
                  <Link
                    href={`/specs/${pillar.specSlug}`}
                    className="flex items-center justify-between border-t border-border/40 pt-4 text-xs"
                  >
                    <span className="font-mono text-muted-foreground/80">
                      {versionLabel(pillar.specSlug)}
                    </span>
                    <span className="flex items-center gap-1 text-primary opacity-80 transition-opacity group-hover:opacity-100">
                      Read spec
                      <ArrowUpRight className="size-3" />
                    </span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* One proof path, not a ledger wall. The macro-F1 number lives
            in the Hero pill; here we point to the scoreboard that holds
            it — and the corpus/FP/FN ledgers live one hop further in. */}
        <p className="mt-10 text-center text-[11px] font-mono text-muted-foreground/70">
          Versioned public specs · Python ↔ TypeScript conformance ·
          byte-identical reproducibility ·{" "}
          <a
            href={`${GH_BASE}/docs/evaluation.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary/90 hover:text-primary"
          >
            see the scoreboard <ArrowUpRight className="size-2.5" />
          </a>
        </p>
      </div>
    </section>
  )
}
