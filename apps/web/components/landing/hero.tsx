import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  BookOpen,
  Copy,
  ShieldCheck,
  FileSearch,
  Fingerprint,
  Lock,
  Eye,
  Repeat,
  Layers,
  Terminal,
} from "lucide-react"

import { CheckShowcase } from "@/components/landing/check-showcase"
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

const credibilityPillars = [
  { icon: FileSearch, label: "Discovered" },
  { icon: ShieldCheck, label: "Verified" },
  { icon: Fingerprint, label: "Attested" },
  { icon: Lock, label: "Gated" },
  { icon: Eye, label: "Logged" },
  { icon: Repeat, label: "Reproducible" },
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
                  {summary.totalDetectors}/{summary.totalDetectors} Top 10 detectors · macro F1 = {summary.macroF1InSample.toFixed(3)} · Py ↔ TS parity gated
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
              We verify every byte of context an AI agent consumes —{" "}
              <code className="font-mono text-foreground/85">AGENTS.md</code>,{" "}
              <code className="font-mono text-foreground/85">SKILL.md</code>,{" "}
              <code className="font-mono text-foreground/85">.cursor/rules</code>,{" "}
              <code className="font-mono text-foreground/85">mcp.json</code> —
              against the Context CI Top 10,{" "}
              <span className="text-foreground/90">before the agent reads it</span>.
              Open-source kernel, CLI, GitHub Action, MCP runtime gate.
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

            {/* Credibility strip — AV-family lifecycle verbs */}
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {credibilityPillars.map((pillar) => {
                const Icon = pillar.icon
                return (
                  <div key={pillar.label} className="flex items-center gap-1.5">
                    <Icon className="size-3 text-primary/60" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {pillar.label}
                    </span>
                  </div>
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

function CommandPill({ label, command }: { label: string; command: string }) {
  return (
    <div className="group rounded-lg border border-border/60 bg-secondary/30 backdrop-blur-sm px-3 py-2.5 hover:border-primary/40 hover:bg-secondary/50 transition-colors">
      <p className="text-[9px] font-mono uppercase tracking-widest text-primary/70 mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-primary/50 select-none">$</span>
        <code className="flex-1 text-[12px] font-mono text-foreground/90 truncate">
          {command}
        </code>
        <button
          className="text-muted-foreground/60 hover:text-primary transition-colors"
          aria-label={`Copy: ${command}`}
        >
          <Copy className="size-3" />
        </button>
      </div>
    </div>
  )
}
