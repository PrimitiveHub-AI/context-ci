import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Terminal, BookOpen, Copy, ShieldCheck, GitBranch, Fingerprint, BarChart3, Users, Boxes } from "lucide-react"

const credibilityPillars = [
  { icon: GitBranch, label: "Versioned" },
  { icon: Fingerprint, label: "Attested" },
  { icon: Users, label: "Human-Reviewed" },
  { icon: ShieldCheck, label: "Safety Scanned" },
  { icon: BarChart3, label: "Benchmark Tested" },
  { icon: Boxes, label: "Agent Compatible" },
]

const pipelineSteps = [
  { step: "01", label: "Raw Markdown", detail: "Unvalidated context files authored by domain experts" },
  { step: "02", label: "Schema Validation", detail: "Frontmatter checks, structure lint, format compliance" },
  { step: "03", label: "Safety + Quality Scans", detail: "Injection detection, contradiction scan, token efficiency" },
  { step: "04", label: "Expert Review", detail: "Human reviewer with domain credentials and reputation score" },
  { step: "05", label: "Attested Trusted Primitive", detail: "SHA-256 content digest, Ed25519 signing planned (Sigstore), versioned, scored, immutably published" },
  { step: "06", label: "Better Agent Output", detail: "+42% specificity, +38% originality, +46% compliance" },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_195/0.06)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-24 lg:px-6 lg:pt-32 lg:pb-32">
        <div className="flex flex-col items-center text-center">
          {/* Status pill */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-3.5 py-1.5">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-mono text-primary/80 tracking-wide">
              Trusted cognition infrastructure for AI agents
            </span>
          </div>

          {/* Headline */}
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] text-balance">
            Stop prompting harder.{" "}
            <br className="hidden sm:block" />
            <span className="text-primary glow-text-cyan">Load better cognition.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] text-muted-foreground leading-relaxed text-pretty">
            Expert-authored Markdown cognition modules that teach AI agents
            how to think, design, code, review, secure, and reason -- with
            measurable precision. Validated, versioned, attested, and installable.
          </p>

          {/* Quick install */}
          <div className="mt-8 flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs font-mono text-primary/50 select-none">$</span>
            <code className="text-xs font-mono text-muted-foreground">
              phub install strict-code-review@2.1.0
            </code>
            <button className="ml-2 text-muted-foreground hover:text-primary transition-colors" aria-label="Copy command">
              <Copy className="size-3" />
            </button>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10" asChild>
              <Link href="/registry">
                Explore Trusted Primitives
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="gap-2 h-10 border-border/60" asChild>
              <Link href="/validation">
                <Terminal className="size-4" />
                Run Context CI
              </Link>
            </Button>
            <Button variant="ghost" size="lg" className="gap-2 text-muted-foreground h-10" asChild>
              <Link href="/paper">
                <BookOpen className="size-4" />
                Read the Paper
              </Link>
            </Button>
          </div>

          {/* Credibility strip */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
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

        {/* 6-Stage Pipeline flow */}
        <div className="mt-20 mx-auto max-w-5xl">
          <p className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-primary/60 mb-5">
            From raw markdown to trusted cognition
          </p>
          <div className="grid grid-cols-2 gap-px md:grid-cols-3 lg:grid-cols-6 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            {pipelineSteps.map((s) => (
              <div key={s.step} className="flex flex-col items-center bg-card p-4 text-center">
                <span className="text-[9px] font-mono uppercase tracking-widest text-primary/50 mb-2">{s.step}</span>
                <p className="text-[11px] font-semibold text-foreground leading-tight">{s.label}</p>
                <p className="mt-1.5 text-[9px] text-muted-foreground leading-relaxed">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Before / After */}
        <div className="mt-10 mx-auto max-w-3xl grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-1.5 rounded-full bg-destructive" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">Without Primitives</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generic UI patterns. Vague architecture. Default code review. No measurable criteria.
              Hallucinated expertise. Bloated context windows. Unreliable agent output.
            </p>
          </div>
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-success/80">With Trusted Primitives</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Opinionated design logic. Strict senior-level review. Secure architecture.
              Measurable output quality. Validated reasoning. Token-efficient cognition.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
