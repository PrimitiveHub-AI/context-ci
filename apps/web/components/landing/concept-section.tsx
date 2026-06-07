import { Card } from "@/components/ui/card"
import {
  Code2,
  Palette,
  ShieldAlert,
  BookOpen,
  Network,
  Gauge,
  Bot,
  Globe,
} from "lucide-react"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"

const categories = [
  { name: "Software Engineering", icon: Code2, desc: "Code review, clean code, testing patterns", count: 3 },
  { name: "Product Design", icon: Palette, desc: "Mobile UX, retention, category creation", count: 3 },
  { name: "Cybersecurity", icon: ShieldAlert, desc: "Threat modeling, secure review, zero-trust", count: 2 },
  { name: "Research & Writing", icon: BookOpen, desc: "IEEE papers, lit reviews, methodology", count: 1 },
  { name: "Architecture", icon: Network, desc: "System design, databases, service boundaries", count: 3 },
  { name: "Performance", icon: Gauge, desc: "React optimization, profiling, bundle analysis", count: 1 },
  { name: "Agent Behavior", icon: Bot, desc: "Anti-hallucination, reasoning, calibration", count: 1 },
  { name: "Domain Expertise", icon: Globe, desc: "Industry-specific knowledge modules", count: 0 },
]

export function ConceptSection() {
  const summary = summarize(loadLatestEvaluation())
  const totalSamples = summary.inSampleSamples + summary.holdoutSamples
  const engineStats = [
    {
      stat: `${summary.totalDetectors}/${summary.totalDetectors}`,
      label: "Top 10 Detectors",
    },
    {
      stat: totalSamples.toLocaleString(),
      label: "Labeled Corpus Samples",
    },
    {
      stat: summary.macroF1InSample.toFixed(3),
      label: `Macro F1 · corpus v${summary.corpusVersion}`,
    },
    { stat: "Py = TS", label: "Cross-language Parity" },
  ]
  return (
    <section className="border-y border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            Core Concept
          </p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            AI Context Primitives
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Modular Markdown cognition modules containing principles, decision rules,
            checklists, anti-patterns, and output guidance. Not prompts.
            Not templates. Infrastructure-grade context -- validated, versioned,
            attested, scored, and installable into any compatible AI agent.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <div
                key={cat.name}
                className="flex items-start gap-3 bg-card p-4 transition-colors hover:bg-card/80"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/[0.07] text-primary">
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-medium text-foreground truncate">{cat.name}</h3>
                    {cat.count > 0 && (
                      <span className="text-[9px] font-mono text-muted-foreground shrink-0">{cat.count}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{cat.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Engine stats — read from bench/baseline (latest TS JSON) so
            the same artifact docs/evaluation.md is generated from
            anchors what the homepage shows. No drift possible: CI
            fails if either source moves without the other. */}
        <div className="mt-16 mx-auto max-w-3xl">
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            {engineStats.map((item) => (
              <div key={item.label} className="bg-card px-4 py-5 text-center">
                <p className="text-2xl font-bold font-mono text-primary tabular-nums">{item.stat}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] font-mono text-muted-foreground/70">
            Measured {summary.measuredAt} · {summary.inSampleSamples} in-sample + {summary.holdoutSamples} holdout · reproduce with{" "}
            <code className="text-foreground/80">bench/scripts/gate.sh</code>
          </p>
        </div>
      </div>
    </section>
  )
}
