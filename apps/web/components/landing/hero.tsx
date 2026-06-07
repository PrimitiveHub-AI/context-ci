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

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"

/**
 * Hero.
 *
 * Doctrine-coherent: leads with `docs/doctrine.md` § "Category
 * statement" verbatim — "PrimitiveHub is the Context Firewall for
 * AI agents." Names the artifacts § "The named enemy" calls out
 * (AGENTS.md, SKILL.md, .cursor/rules, mcp.json). Foregrounds the
 * active surface (`phub audit`, ADR-0025) as the lead command and
 * the AV-family funnel (Check → Top 10 → Paper) as the CTAs.
 *
 * Status-pill copy is read live from the evaluation loader so the
 * sentence the first-time visitor reads is the same measured number
 * the corpus regression gate just enforced.
 */

// Credibility strip verbs — AV-family lifecycle, not registry features.
// Each maps to a shipped surface so the strip is a claim, not a promise:
//   Discovered  ← `phub audit` walks the tree (ADR-0025)
//   Verified    ← `@primitivehub/verify` kernel (ADR-0020)
//   Attested    ← Sigstore keyless OIDC (ADR-0011, Phase 4)
//   Gated       ← MCP runtime gate + policy.yaml (ADR-0029)
//   Logged      ← Rekor transparency log
//   Reproducible ← bench/scripts/gate.sh (ADR-0023 parity invariant)
const credibilityPillars = [
  { icon: FileSearch, label: "Discovered" },
  { icon: ShieldCheck, label: "Verified" },
  { icon: Fingerprint, label: "Attested" },
  { icon: Lock, label: "Gated" },
  { icon: Eye, label: "Logged" },
  { icon: Repeat, label: "Reproducible" },
]

const pipelineSteps = [
  { step: "01", label: "Raw Markdown", detail: "Unvalidated context files authored by domain experts" },
  { step: "02", label: "Schema Validation", detail: "Frontmatter checks, structure lint, format compliance" },
  { step: "03", label: "Safety + Quality Scans", detail: "Injection detection, contradiction scan, token efficiency" },
  { step: "04", label: "Expert Review", detail: "Human reviewer with domain credentials and reputation score" },
  { step: "05", label: "Attested Trusted Primitive", detail: "SHA-256 content digest, Sigstore keyless OIDC (Fulcio cert + Rekor entry), versioned, immutably published" },
  { step: "06", label: "Verified Context Load", detail: "Loaded into the agent only after digest match + Rekor inclusion + Top 10 verdict resolve" },
]

export function Hero() {
  const summary = summarize(loadLatestEvaluation())
  const totalSamples = summary.inSampleSamples + summary.holdoutSamples

  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_195/0.06)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-24 lg:px-6 lg:pt-32 lg:pb-32">
        <div className="flex flex-col items-center text-center">
          {/* Status pill — measured live from bench/baseline so the
              very first sentence on the site is paper-grade truth. */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-3.5 py-1.5">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-mono text-primary/80 tracking-wide">
              {summary.totalDetectors}/{summary.totalDetectors} Top 10 detectors measured · macro F1 = {summary.macroF1InSample.toFixed(3)} · Py ↔ TS parity gated
            </span>
          </div>

          {/* Headline — doctrine § Category statement verbatim. */}
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] text-balance">
            The{" "}
            <span className="text-primary glow-text-cyan">Context Firewall</span>
            <br className="hidden sm:block" />{" "}
            for AI agents.
          </h1>

          {/* Subhead — names the artifacts § "The named enemy" calls
              out + the temporal frame ("before … reads it") + the
              shipping surfaces. */}
          <p className="mt-6 max-w-2xl text-[15px] text-muted-foreground leading-relaxed text-pretty">
            We verify every byte of context an AI agent consumes —{" "}
            <code className="font-mono text-foreground/80">AGENTS.md</code>,{" "}
            <code className="font-mono text-foreground/80">SKILL.md</code>,{" "}
            <code className="font-mono text-foreground/80">.cursor/rules</code>,{" "}
            <code className="font-mono text-foreground/80">mcp.json</code> —
            against the Context CI Top 10,{" "}
            <span className="text-foreground/80">before the agent reads it</span>.
            Open-source verifier kernel, CLI, GitHub Action, and MCP runtime gate.
          </p>

          {/* Quick command — lead with the active-posture surface
              (`phub audit`, the ADR-0025 Samurai Cut), not a
              registry install. */}
          <div className="mt-8 flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs font-mono text-primary/50 select-none">$</span>
            <code className="text-xs font-mono text-muted-foreground">
              npx @primitivehub/phub audit
            </code>
            <button className="ml-2 text-muted-foreground hover:text-primary transition-colors" aria-label="Copy command">
              <Copy className="size-3" />
            </button>
          </div>

          {/* CTAs — ordered by the AV-family funnel: first touch
              (Check) → research (Top 10) → academic (Paper). */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10" asChild>
              <Link href="/check">
                <Terminal className="size-4" />
                Paste anything → /check
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="gap-2 h-10 border-border/60" asChild>
              <Link href="/top-10">
                <Layers className="size-4" />
                Read the Top 10
              </Link>
            </Button>
            <Button variant="ghost" size="lg" className="gap-2 text-muted-foreground h-10" asChild>
              <Link href="/paper">
                <BookOpen className="size-4" />
                Read the paper
              </Link>
            </Button>
          </div>

          {/* Credibility strip — AV-family lifecycle verbs (see
              comment on `credibilityPillars` for the surface
              mapping). */}
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
            From raw markdown to verified context load
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

        {/* Before / After — reframed from registry features to the
            named-enemy attack shapes. Left names what hides in raw
            agent context (doctrine § "The named enemy"); right
            names what the firewall does about it (doctrine §
            "Operating Laws" 1-4). */}
        <div className="mt-10 mx-auto max-w-4xl grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-1.5 rounded-full bg-destructive" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">Raw agent context</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Random Markdown loaded straight into the agent. Prompt
              injection hidden in a skill file. <code className="font-mono text-foreground/70">npx ... | bash</code> in
              setup instructions. A <code className="font-mono text-foreground/70">.cursorrules</code> copy-pasted
              from a Twitter thread. No digest. No attestation. No gate.
            </p>
          </div>
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-success/80">Verified agent context</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Every byte scanned against the Context CI Top 10. SHA-256
              content digest. Sigstore keyless OIDC attestation. Policy-gated
              install. Rekor transparency log. Refused at the gate if it
              doesn&rsquo;t verify.
            </p>
          </div>
        </div>

        {/* Measurement footnote — anchors the pill+caption claim in
            the reproducibility surface so a curious reader can verify
            the headline in one click. */}
        <p className="mt-6 text-center text-[10px] font-mono text-muted-foreground/70">
          Measured {summary.measuredAt} against{" "}
          <span className="text-foreground/80">{totalSamples} labeled samples</span>{" "}
          ({summary.inSampleSamples} in-sample + {summary.holdoutSamples} holdout) ·{" "}
          reproduce with{" "}
          <code className="text-foreground/80">bench/scripts/gate.sh</code>
        </p>
      </div>
    </section>
  )
}
