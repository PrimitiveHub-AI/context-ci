import { ShieldAlert, ShieldCheck } from "lucide-react"

const threats = [
  {
    name: "Prompt injection inside Markdown",
    detail: "Hidden imperative override instructions the agent dutifully follows",
  },
  {
    name: "Hidden Unicode steganography",
    detail: "Tag-character payloads the eye can't see but the LLM tokenizes",
  },
  {
    name: "Unsafe shell + npx patterns",
    detail: "curl-piped installers in 'setup' instructions — Codecov 2021 redux",
  },
  {
    name: "Credential exfiltration via prose",
    detail: "Instructions to read .env / ~/.ssh / AWS credentials into outputs",
  },
  {
    name: "Typosquatted authors + fake expertise",
    detail: "Lookalike names, fabricated citations, invented standards-compliance",
  },
  {
    name: "Context bloat + behavioral drift",
    detail: "Oversized cognition that hijacks token budget across unrelated tasks",
  },
]

const responses = [
  {
    name: "Validated",
    detail: "Schema, structure, safety, copyright, contradiction, token-efficiency, benchmark, human review — 10 stages.",
  },
  {
    name: "Versioned",
    detail: "Semver 2.0. Immutable content-addressed releases. Past versions never disappear.",
  },
  {
    name: "Attested",
    detail: "in-toto Statement carrying validation provenance, signed via Sigstore keyless OIDC.",
  },
  {
    name: "Scored",
    detail: "Quality / Safety / Efficiency / Impact — four orthogonal trust dimensions, formulas open-source.",
  },
  {
    name: "Reviewed",
    detail: "Domain experts with bound OIDC identities. Public uploads enter review, never auto-trusted.",
  },
  {
    name: "Distributed",
    detail: "Content-addressed object storage. Verifiable end-to-end. Public + private registries.",
  },
]

export function WhySection() {
  return (
    <section id="why" className="border-y border-border/40 bg-secondary/[0.15] py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            The Problem · The Response
          </p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Why PrimitiveHub exists
          </h2>
          <p className="mt-5 text-sm text-muted-foreground leading-[1.75] max-w-2xl mx-auto">
            AI agents — Claude Code, Cursor, Codex, Copilot, and the growing
            ecosystem of MCP-compatible tools — load Markdown skills, rule files,
            and instruction packages directly into their reasoning context. These
            artifacts run with the full trust of the developer who invoked the
            agent: their shell, their credentials, their tool surface.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-[1.75] max-w-2xl mx-auto">
            Existing supply-chain security — SLSA, in-toto, Sigstore, npm
            provenance — covers <span className="text-foreground/80">code dependencies</span>.
            It does not cover the cognition the agent loads.
            <span className="text-foreground/80"> Agent context is a new supply-chain attack surface,</span>{" "}
            and nobody had built the trust layer for it.
          </p>
        </div>

        {/* Threat vs. response — two-column comparison */}
        <div className="mt-14 mx-auto max-w-6xl grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          {/* Threats */}
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-7 items-center justify-center rounded-md bg-destructive/[0.08]">
                <ShieldAlert className="size-3.5 text-destructive/80" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">
                What can hide in raw agent context
              </p>
            </div>
            <ul className="space-y-3">
              {threats.map((t) => (
                <li key={t.name} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive/60" />
                  <div>
                    <p className="text-xs font-medium text-foreground/90">{t.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                      {t.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Responses */}
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-7 items-center justify-center rounded-md bg-success/[0.08]">
                <ShieldCheck className="size-3.5 text-success/80" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-success/80">
                What PrimitiveHub does about it
              </p>
            </div>
            <ul className="space-y-3">
              {responses.map((r) => (
                <li key={r.name} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-success/60" />
                  <div>
                    <p className="text-xs font-medium text-foreground/90">{r.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                      {r.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Key sentence */}
        <div className="mt-10 mx-auto max-w-3xl">
          <div className="relative rounded-xl border border-primary/20 bg-primary/[0.04] p-6 text-center">
            <span
              aria-hidden
              className="absolute left-6 top-3 text-3xl font-serif text-primary/30 select-none"
            >
              &ldquo;
            </span>
            <p className="px-6 text-[15px] font-medium text-foreground/95 leading-relaxed text-balance">
              PrimitiveHub treats agent context as{" "}
              <span className="text-primary">supply-chain material</span>,
              not disposable prompt text.
            </p>
            <span
              aria-hidden
              className="absolute right-6 bottom-3 text-3xl font-serif text-primary/30 select-none"
            >
              &rdquo;
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
