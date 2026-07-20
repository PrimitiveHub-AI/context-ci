import Link from "next/link"
import { Hexagon, ArrowUpRight } from "lucide-react"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"

/**
 * Homepage footer. Surfaces the four canonical post-Round-7 artifacts
 * the audit identified as unreachable: docs/evaluation.md,
 * docs/top10-corpus-map.md, paper/, and SECURITY.md — plus the
 * internal routes a first-time visitor needs to validate the
 * category (top-10, specs, decisions, docs).
 *
 * Pre-launch the four artifacts resolve to GitHub blobs; on launch
 * day the same labels can switch to /docs/<slug> routes without
 * changing the surface footprint.
 */

const GH_REPO = "https://github.com/DevXYZx/primitivehub"
const GH_BLOB = `${GH_REPO}/blob/main`
const GH_TREE = `${GH_REPO}/tree/main`

type Column = {
  heading: string
  links: ReadonlyArray<{
    label: string
    href: string
    external?: boolean
    soon?: boolean
  }>
}

function buildColumns(measuredAt: string): readonly Column[] {
  return [
    {
      heading: "Surfaces",
      links: [
        { label: "/check — paste-and-verdict", href: "/check" },
        { label: "Primitive Forge — author & validate", href: "/forge" },
        { label: "Docs (phub CLI, Action, MCP)", href: "/docs" },
        { label: "Context CI", href: "/validation", soon: true },
        { label: "Registry", href: "/registry", soon: true },
        { label: "Status", href: "/status", soon: true },
      ],
    },
    {
      heading: "Engine",
      links: [
        {
          label: `Evaluation scoreboard · ${measuredAt}`,
          href: `${GH_BLOB}/docs/evaluation.md`,
          external: true,
        },
        {
          label: "Top 10 corpus map",
          href: `${GH_BLOB}/docs/top10-corpus-map.md`,
          external: true,
        },
        {
          label: "Adversarial corpus v0.2",
          href: `${GH_BLOB}/docs/corpus-v0.1.md`,
          external: true,
        },
        {
          label: "False-positive ledger",
          href: `${GH_BLOB}/docs/false-positive-resolution.md`,
          external: true,
        },
        {
          label: "False-negative ledger",
          href: `${GH_BLOB}/docs/false-negative-resolution.md`,
          external: true,
        },
      ],
    },
    {
      heading: "Standards",
      links: [
        { label: "Context CI Top 10 v0.1", href: "/top-10" },
        { label: "Specs (Trust Contract, CBOM)", href: "/specs" },
        { label: "Decisions (ADRs)", href: "/decisions" },
        {
          label: "OWASP LLM Top 10 crosswalk",
          href: `${GH_BLOB}/docs/owasp-llm-top10-crosswalk.md`,
          external: true,
        },
      ],
    },
    {
      heading: "Project",
      links: [
        { label: "Paper (arXiv preprint v0.1)", href: "/paper" },
        {
          label: "Paper source on GitHub",
          href: `${GH_TREE}/paper`,
          external: true,
        },
        {
          label: "SECURITY.md — report a finding",
          href: `${GH_BLOB}/SECURITY.md`,
          external: true,
        },
        { label: "Security & bug bounty", href: "/security" },
        { label: "Contributors", href: "/contributors" },
        { label: "Source on GitHub", href: GH_REPO, external: true },
      ],
    },
  ]
}

export function SiteFooter() {
  const summary = summarize(loadLatestEvaluation())
  const columns = buildColumns(summary.measuredAt)

  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {columns.map((col) => (
            <div key={col.heading} className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/80 mb-3">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1 text-[12px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>{link.label}</span>
                        <ArrowUpRight className="size-2.5 mt-0.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>{link.label}</span>
                        {link.soon && (
                          <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground/60">
                            soon
                          </span>
                        )}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Hexagon className="size-3.5 text-primary/70" />
            <span>PrimitiveHub, 2026 — the Context Firewall for AI agents.</span>
          </div>
          {/* CyberOrca Labs attribution hidden for now (owner request 2026-07-20).
              Restore this block when ready; the LICENSE still credits CyberOrca Labs. */}
        </div>
      </div>
    </footer>
  )
}
