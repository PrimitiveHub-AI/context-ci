import {
  Search,
  Shield,
  GitBranch,
  BarChart3,
  Package,
  FileCheck,
} from "lucide-react"

const features = [
  {
    icon: Search,
    title: "Searchable Registry",
    description: "Find primitives by category, compatibility, trust status, token budget, and quality score. Faceted search for infrastructure-grade discovery.",
  },
  {
    icon: Shield,
    title: "Context CI Pipeline",
    description: "10-stage validation: schema check, safety scan, contradiction detection, benchmark testing, and human review before trusted release.",
  },
  {
    icon: GitBranch,
    title: "Semver & Provenance",
    description: "Full semantic versioning. SHA-256 content digest per release. Sigstore keyless OIDC (Fulcio cert + Rekor entry). Provenance chain: author → validation → review → release.",
  },
  {
    icon: BarChart3,
    title: "Benchmarked Impact",
    description: "Before/after comparisons across 4 dimensions: specificity, originality, anti-pattern reduction, and instruction compliance.",
  },
  {
    icon: Package,
    title: "Composable Bundles",
    description: "Curated packs for specific roles. Install a complete cognition stack with one command. Token budget calculated automatically.",
  },
  {
    icon: FileCheck,
    title: "Multi-Agent Export",
    description: "One-click export for Claude Code, Cursor Rules, Codex AGENTS.md, v0, and Windsurf. Format-aware conversion per agent.",
  },
]

export function FeaturesSection() {
  return (
    <section className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            Cognition Infrastructure
          </p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Built for trust, not sharing
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            PrimitiveHub is not a prompt marketplace. It is infrastructure for how AI agents
            inherit expert-level reasoning, domain knowledge, and behavioral guidelines --
            with the same trust guarantees as an attested software package.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="bg-card p-6 transition-colors hover:bg-card/80"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/[0.07] text-primary mb-4">
                  <Icon className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
