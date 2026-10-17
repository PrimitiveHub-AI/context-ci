import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  BookOpen,
  ShieldCheck,
  FileSearch,
  Lock,
  Layers,
  Terminal,
} from "lucide-react"

import { CheckShowcase } from "@/components/landing/check-showcase"
import { CommandPill } from "@/components/landing/command-pill"
import { EvaluationLink } from "@/components/primitives/evaluation-link"
import { loadLatestEvaluation, summarize } from "@/lib/evaluation"

/**
 * Hero — restructured for the "between PrimitiveHub / skills.sh /
 * coolify.io" brief. The previous hero pushed everything down the
 * page (status pill → headline → subhead → command → CTAs →
 * 6-step pipeline → before/after → footnote) and read as a series
 * of small centered text blocks against a wide container. This
 * version puts the product on screen above the fold.
 *
 * Layout:
 *  - Desktop (lg+): 50/50 split. Text + commands + CTAs on the
 *    left; <CheckShowcase> mock on the right showing what /check
 *    actually does — three real CCI findings (CCI-005, CCI-001,
 *    CCI-009) on a real-looking sample paste.
 *  - Mobile: stacks. Text first, then the showcase.
 *
 * The 6-step pipeline grid and the before/after panels from the
 * previous version are retired here. The pipeline was abstract
 * (Phase 1 artefact). The threat/control story lives in
 * ThreatVerifiedSection now where it belongs.
 *
 * The hero's measurement claim is still wrapped in <EvaluationLink>
 * — credibility-sweep discipline preserved.
 */

// The three firewall motions (ADR-0047), each linked to its surface.
// Replaces the former 6-verb lifecycle strip. Copy is truth-pass accurate:
// block-at-load is fail-closed in CI/CLI and advisory in MCP (v0.1).
const firewallMotions = [
  {
    icon: FileSearch,
    beat: "Scan",
    href: "/check",
    one: "Paste anything → a Context CI Top 10 verdict.",
  },
  {
    icon: ShieldCheck,
    beat: "Author-safe",
    href: "/forge",
    one: "Lint against the spec as you write, in Forge.",
  },
  {
    icon: Lock,
    beat: "Block-at-load",
    href: "/docs",
    one: "Fail-closed in CI & the CLI; advisory in MCP.",
  },
]

export function Hero() {
  const summary = summarize(loadLatestEvaluation())

  return (
    <section className="relative overflow-hidden">
      {/* Layered backdrop — grid + radial glow + base gradient */}
      <div className="bg-grid absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.78_0.14_195/0.10)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,oklch(0.78_0.14_195/0.05)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/30 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 lg:px-6 lg:pt-24 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left column — text + commands + CTAs */}
          <div className="lg:col-span-7 flex flex-col">
            {/* Status pill, measured live */}
            <div className="mb-7 inline-flex self-start items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-3.5 py-1.5">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-mono text-primary/85 tracking-wide">
                <EvaluationLink>
                  {summary.totalDetectors}/{summary.totalDetectors} detectors implemented · in-sample macro-F1 {summary.macroF1InSample.toFixed(3)} · Py ↔ TS parity gated
                </EvaluationLink>
              </span>
            </div>

            {/* Headline — doctrine § Category statement, left-aligned */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05] text-balance">
              The{" "}
              <span className="text-primary glow-text-cyan">Context Firewall</span>{" "}
              for AI agents.
            </h1>

            {/* Subhead — names the artifacts + temporal frame + shipping surfaces */}
            <p className="mt-5 max-w-xl text-[15px] text-muted-foreground leading-relaxed text-pretty">
              We inspect the agent-context artifacts we discover —{" "}
              <code className="font-mono text-foreground/85">AGENTS.md</code>,{" "}
              <code className="font-mono text-foreground/85">SKILL.md</code>,{" "}
              <code className="font-mono text-foreground/85">.cursor/rules</code>,{" "}
              <code className="font-mono text-foreground/85">mcp.json</code> —
              against the Context CI Top 10,{" "}
              <span className="text-foreground/90">before you ship them to an agent</span>.{" "}
              Three motions, one firewall:{" "}
              <span className="text-foreground/90">scan</span> at /check,{" "}
              <span className="text-foreground/90">author-safe</span> in /Forge,{" "}
              <span className="text-foreground/90">block-at-load</span> in CI and the CLI
              (advisory in MCP today) — open-source, end to end.
            </p>

            {/* Dual commands — phub audit (active) + phub scan (passive) */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl">
              <CommandPill
                label="Active sweep"
                command="npx @primitivehub/phub audit"
              />
              <CommandPill
                label="On a known file"
                command="phub scan AGENTS.md"
              />
            </div>

            {/* CTAs — AV-family funnel order */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-11 px-5 shadow-lg shadow-primary/15"
                asChild
              >
                <Link href="/check">
                  <Terminal className="size-4" />
                  Paste anything → /check
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 h-11 px-5 border-border/60"
                asChild
              >
                <Link href="/top-10">
                  <Layers className="size-4" />
                  Read the Top 10
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="gap-2 text-muted-foreground h-11"
                asChild
              >
                <Link href="/paper">
                  <BookOpen className="size-4" />
                  Read the paper
                </Link>
              </Button>
            </div>

            {/* Firewall motions — scan · author-safe · block-at-load
                (ADR-0047), each a link to its surface. */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
              {firewallMotions.map((motion, i) => {
                const Icon = motion.icon
                return (
                  <Link
                    key={motion.beat}
                    href={motion.href}
                    className="group rounded-lg border border-border/50 bg-foreground/[0.02] px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-primary/50 tabular-nums">
                        0{i + 1}
                      </span>
                      <Icon className="size-3.5 text-primary/70" />
                      <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/90">
                        {motion.beat}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {motion.one}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right column — /check showcase mock */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <CheckShowcase />
          </div>
        </div>
      </div>
    </section>
  )
}
