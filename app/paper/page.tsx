import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, BookOpen, Quote, CheckCircle2, ExternalLink } from "lucide-react"

const contributions = [
  "Formal specification of the AI Context Primitive format",
  "Registry architecture for trusted cognition supply chains",
  "Multi-dimensional trust scoring model (Quality, Safety, Efficiency, Impact)",
  "10-stage validation pipeline (Context CI) with automated and human review",
  "Composition framework for primitive bundling and token budget management",
  "Benchmarking methodology demonstrating measurable agent output improvement",
  "Prototype implementation with real-world evaluation across 6 AI agents",
]

export default function PaperPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            Technical Paper
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl text-balance max-w-3xl">
            Toward a Trusted Cognition Supply Chain for AI Agents
          </h1>
          <p className="mt-3 text-xs text-muted-foreground font-mono">
            PrimitiveHub Labs &middot; May 2026 &middot; Technical Report
          </p>
          <div className="mt-5 flex gap-2">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-8">
              <Download className="size-3" />
              Download PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 border-border/60">
              <Quote className="size-3" />
              Cite This Work
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6 space-y-12">
        {/* Abstract */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            <BookOpen className="size-3.5 text-primary/70" />
            Abstract
          </h2>
          <Card className="border-border/40 bg-card p-6">
            <p className="text-sm text-muted-foreground leading-[1.7]">
              Current AI-agent ecosystems provide tools, APIs, and execution environments but lack
              a standardized mechanism for supplying expert-level reasoning, domain knowledge, and
              behavioral guidelines. We propose <strong className="text-foreground/80">AI Context Primitives</strong>: modular, validated,
              versioned Markdown cognition files that can be loaded into any compatible AI agent
              to improve output quality, reduce hallucination, and enforce domain-specific
              standards. We present PrimitiveHub, a registry architecture with a multi-stage
              validation pipeline (Context CI), trust scoring model, and composition framework.
              Our benchmarks demonstrate measurable improvements in specificity (+42%), design
              originality (+38%), anti-pattern reduction (+51%), and instruction compliance (+46%)
              when agents are augmented with validated primitives.
            </p>
          </Card>
        </section>

        {/* Research Gap */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            1. Research Gap
          </h2>
          <p className="text-sm text-muted-foreground leading-[1.7]">
            Current AI-agent ecosystems focus heavily on tools, prompts, and execution environments.
            However, they lack a <strong className="text-foreground/80">trusted, validated, composable registry</strong> for expert-authored
            cognition files that guide agent reasoning and domain behavior. Developers feed agents
            random prompts, scattered documentation, half-baked rules, and unverified Markdown files.
            This creates hallucination, weak reasoning, bloated context windows, unsafe behavior,
            inconsistent coding standards, poor design judgment, and synthetic expertise that
            lacks real-world grounding. The result is unreliable agent output that cannot be
            trusted in production environments.
          </p>
        </section>

        {/* Proposed Model */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            2. Proposed Model
          </h2>
          <p className="text-sm text-muted-foreground leading-[1.7] mb-5">
            We propose a three-layer architecture for trusted AI cognition:
          </p>
          <div className="grid grid-cols-1 gap-px sm:grid-cols-3 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            {[
              {
                title: "Primitive Layer",
                step: "01",
                desc: "Individual Markdown cognition files with structured YAML frontmatter, decision rules, anti-patterns, and agent behavior instructions.",
              },
              {
                title: "Validation Layer",
                step: "02",
                desc: "10-stage pipeline: schema check, structure lint, safety scan, copyright check, token efficiency, contradiction detection, benchmarking, and human review.",
              },
              {
                title: "Registry Layer",
                step: "03",
                desc: "Searchable, versioned, attested catalog with multi-dimensional trust scoring, compatibility metadata, and multi-agent export.",
              },
            ].map((layer) => (
              <div key={layer.title} className="bg-card p-5">
                <span className="text-[9px] font-mono uppercase tracking-widest text-primary/60 mb-2 block">{layer.step}</span>
                <h3 className="text-sm font-semibold text-foreground mb-2">{layer.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{layer.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Primitive Specification */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            3. Primitive Specification
          </h2>
          <p className="text-sm text-muted-foreground leading-[1.7] mb-5">
            An AI Context Primitive is a structured Markdown file with required YAML frontmatter
            and standardized content sections:
          </p>
          <Card className="border-border/40 bg-card p-0 overflow-hidden">
            <div className="border-b border-border/40 bg-secondary/20 px-4 py-1.5">
              <span className="text-[11px] font-mono text-muted-foreground">primitive-spec.yaml</span>
            </div>
            <pre className="p-4 text-[11px] font-mono text-muted-foreground leading-[1.7] overflow-x-auto">
{`required_frontmatter:
  - name: string          # unique slug identifier
  - version: semver       # semantic version (e.g., 1.2.0)
  - type: enum            # design | engineering | security | research | ...
  - domain: string        # human-readable domain label
  - author: string        # author or organization name
  - license: spdx         # SPDX license identifier
  - tokens: integer       # actual token count
  - token_budget: integer # maximum allowed tokens
  - risk_level: enum      # low | medium | high
  - content_digest: sha256-hex   # content-addressed identifier
  - signature: ed25519           # planned via Sigstore — null until Phase 3
  - attestation: cci-v1          # Context CI attestation record id
  - compatible_agents: list[string]
  - use_when: list[string]
  - do_not_use_when: list[string]

required_sections:
  - Purpose                    # what this primitive teaches
  - Core Principles            # foundational rules with examples
  - Decision Rules             # IF/THEN logic with thresholds
  - Anti-Patterns              # what to avoid + alternatives
  - Review Checklist           # verification steps
  - Agent Behavior Instructions # runtime behavior spec

recommended_sections:
  - Expected Output Format     # field-level format expectations
  - Examples                   # real-world demonstrations
  - References                 # sources and citations
  - Changelog                  # version history`}
            </pre>
          </Card>
        </section>

        {/* Trust Model */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            4. Trust and Validation Model
          </h2>
          <p className="text-sm text-muted-foreground leading-[1.7] mb-5">
            Trust is established through a 10-stage validation pipeline (Context CI) and measured
            across four orthogonal dimensions:
          </p>
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            {[
              { metric: "Quality", score: "94", desc: "Content completeness, clarity, actionability, and structural integrity" },
              { metric: "Safety", score: "99", desc: "Absence of injection vectors, unsafe instructions, PII leaks, and encoded payloads" },
              { metric: "Efficiency", score: "87", desc: "Token utilization rate, information density, and redundancy minimization" },
              { metric: "Impact", score: "91", desc: "Measured agent output improvement across benchmark test suite" },
            ].map((m) => (
              <div key={m.metric} className="bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-primary">{m.metric}</h4>
                  <span className="text-sm font-mono font-bold text-foreground/80">{m.score}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contributions */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            5. Key Contributions
          </h2>
          <Card className="border-border/40 bg-card p-5">
            <ul className="space-y-2.5">
              {contributions.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-success/70 mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Case Study */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            6. Case Study: Mobile Design Primitive
          </h2>
          <p className="text-sm text-muted-foreground leading-[1.7] mb-5">
            We evaluated the <code className="text-[11px] font-mono text-foreground/70 bg-secondary/50 px-1 py-0.5 rounded">elite-mobile-design.md</code> primitive
            (v1.0.0, 4,200 tokens) across 5 AI agents using the prompt: &quot;Design a premium profile screen for an emotional social app.&quot;
          </p>
          <div className="grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            <div className="bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-1.5 rounded-full bg-destructive" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">
                  Control (No Primitive)
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI agent generates generic social profile with avatar, bio, followers count,
                and standard post grid. No emotional design consideration. Default interaction
                patterns. No measurable differentiation from templates.
              </p>
            </div>
            <div className="bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-1.5 rounded-full bg-success" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-success/80">
                  Treatment (With Primitive)
                </span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                AI agent generates ritual identity with emotional hierarchy, private aura
                signature, saved moments, intentional interaction model, and non-addictive UX.
                12/14 decision rules applied. Confidence: 0.91.
              </p>
            </div>
          </div>

          {/* Benchmark results */}
          <div className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-4 rounded-xl border border-border/40 overflow-hidden bg-border/40">
            {[
              { label: "Specificity", value: "+42%" },
              { label: "Originality", value: "+38%" },
              { label: "Anti-Pattern", value: "-51%" },
              { label: "Compliance", value: "+46%" },
            ].map((m) => (
              <div key={m.label} className="bg-card p-4 text-center">
                <p className="text-lg font-bold font-mono text-success tabular-nums">{m.value}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Citation */}
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Cite This Work
          </h2>
          <Card className="border-border/40 bg-card p-0 overflow-hidden">
            <div className="border-b border-border/40 bg-secondary/20 px-4 py-1.5">
              <span className="text-[11px] font-mono text-muted-foreground">bibtex</span>
            </div>
            <pre className="p-4 text-[11px] font-mono text-muted-foreground leading-[1.7] overflow-x-auto">
{`@article{primitivehub2026,
  title   = {Toward a Trusted Cognition Supply Chain for AI Agents},
  author  = {PrimitiveHub Labs},
  year    = {2026},
  journal = {PrimitiveHub Technical Report},
  url     = {https://primitivehub.dev/paper},
  note    = {Introduces AI Context Primitives and the Context CI pipeline}
}`}
            </pre>
          </Card>
        </section>

        <div className="flex justify-center pt-4 pb-8">
          <Badge variant="outline" className="border-border/40 text-muted-foreground text-[10px] font-mono">
            PrimitiveHub Labs Technical Report &middot; May 2026
          </Badge>
        </div>
      </div>
    </main>
  )
}
