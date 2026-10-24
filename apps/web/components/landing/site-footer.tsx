import Link from "next/link"
import { Hexagon, ArrowUpRight } from "lucide-react"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"
import { GITHUB_REPO_URL } from "@/lib/site"

/**
 * Homepage footer. Curated in-app routes a first-time visitor needs to
 * validate the category (check, forge, paper, top-10, specs, decisions,
 * docs, security). The proof artifacts live on the website, not the
 * public repo (a subset without docs/bench/paper), so every link resolves
 * in-app — only "Source on GitHub" (the repo root) is external.
 */

const GH_REPO = GITHUB_REPO_URL

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
        { label: "Skill IDE — author & validate", href: "/skill-ide" },
        { label: "Docs (phub CLI, Action, MCP)", href: "/docs" },
        { label: "Context CI", href: "/validation", soon: true },
        { label: "Registry", href: "/registry", soon: true },
        { label: "Status", href: "/status", soon: true },
      ],
    },
    {
      heading: "Engine",
      links: [
        { label: `Evaluation & corpus · ${measuredAt}`, href: "/paper" },
        { label: "Detectors T1–T10", href: "/specs/context-ci-top-10-v0.1" },
      ],
    },
    {
      heading: "Standards",
      links: [
        { label: "Context CI Top 10 v0.1", href: "/top-10" },
        { label: "Specs (Trust Contract, CBOM)", href: "/specs" },
        { label: "Decisions (ADRs)", href: "/decisions" },
      ],
    },
    {
      heading: "Project",
      links: [
        { label: "Paper (arXiv preprint v0.1)", href: "/paper" },
        { label: "Security & disclosure", href: "/security" },
        { label: "Contributors", href: "/contributors", soon: true },
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
                        className="group inline-flex items-start gap-1 rounded-sm text-[12px] leading-snug text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span>{link.label}</span>
                        <ArrowUpRight className="size-2.5 mt-0.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1.5 rounded-sm text-[12px] leading-snug text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span>{link.label}</span>
                        {link.soon && (
                          <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
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
