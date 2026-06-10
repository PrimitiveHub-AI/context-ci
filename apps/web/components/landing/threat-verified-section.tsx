import { ShieldAlert, ShieldCheck } from "lucide-react"

/**
 * Threat → Verified — the single threat-story moment
 * (homepage-elite-bar.md §2).
 *
 * Merges the old Hero before/after split + WhySection into ONE
 * definitive section, so the trust story is told exactly once: the 4
 * sharpest attack shapes (doctrine § "The named enemy") against the 4
 * controls that answer them (Operating Laws 1-4). No metrics here — the
 * canonical macro-F1 lives in the Hero status pill.
 */

const threats = [
  {
    name: "Prompt injection inside Markdown",
    detail: "Hidden imperative overrides the agent dutifully follows.",
  },
  {
    name: "Hidden Unicode steganography",
    detail: "Tag-character payloads the eye can't see but the LLM tokenizes.",
  },
  {
    name: "Unsafe shell + npx patterns",
    detail: "curl-piped installers in “setup” steps — Codecov 2021 redux.",
  },
  {
    name: "Credential exfiltration via prose",
    detail: "Instructions to read .env / ~/.ssh / AWS keys into outputs.",
  },
]

const controls = [
  {
    name: "Validated",
    detail: "Every byte scanned against the Context CI Top 10 — injection, steganography, shell, exfil.",
  },
  {
    name: "Attested",
    detail: "SHA-256 content digest + in-toto Statement, signed via Sigstore keyless OIDC.",
  },
  {
    name: "Reviewed",
    detail: "Domain experts with bound OIDC identities. Public uploads enter review, never auto-trusted.",
  },
  {
    name: "Gated",
    detail: "Policy-gated install. Refused at the gate — and logged to Rekor — if it doesn't verify.",
  },
]

export function ThreatVerifiedSection() {
  return (
    <section id="threat" className="border-y border-border/40 bg-secondary/[0.15] py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            The attack surface
          </p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Agent context is an unguarded supply-chain surface.
          </h2>
          <p className="mt-5 text-sm text-muted-foreground leading-[1.75] max-w-2xl mx-auto">
            AI agents — Claude Code, Cursor, Codex, Copilot — load Markdown
            skills, rule files, and instruction packages straight into their
            reasoning context, with your shell, your credentials, your tool
            surface. SLSA, in-toto, and Sigstore verify the{" "}
            <span className="text-foreground/80">code dependencies</span> and
            their build provenance; they do not judge the semantic instructions
            an agent reads as context. That is the gap PrimitiveHub closes.
          </p>
          <p className="mt-4 max-w-2xl mx-auto rounded-md border border-primary/15 bg-primary/[0.04] px-4 py-2 text-[12px] text-primary/90 leading-relaxed">
            Fast unverified agent-skill installation is the new{" "}
            <code className="font-mono text-foreground/90">curl | bash</code>.
          </p>
        </div>

        {/* Threat vs control — the story, told once. 4 against 4. */}
        <div className="mt-14 mx-auto max-w-5xl grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-7 items-center justify-center rounded-md bg-destructive/[0.08]">
                <ShieldAlert className="size-3.5 text-destructive/80" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">
                Raw agent context
              </p>
            </div>
            <ul className="space-y-3.5">
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

          <div className="bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-7 items-center justify-center rounded-md bg-success/[0.08]">
                <ShieldCheck className="size-3.5 text-success/80" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-success/80">
                Verified agent context
              </p>
            </div>
            <ul className="space-y-3.5">
              {controls.map((c) => (
                <li key={c.name} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-success/60" />
                  <div>
                    <p className="text-xs font-medium text-foreground/90">{c.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                      {c.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Thesis — the money line, stated flat (no decorative quotes). */}
        <div className="mt-10 mx-auto max-w-3xl rounded-xl border border-primary/20 bg-primary/[0.04] p-6 text-center">
          <p className="text-[15px] font-medium text-foreground/95 leading-relaxed text-balance">
            PrimitiveHub treats agent context as{" "}
            <span className="text-primary">supply-chain material</span>, not
            disposable prompt text.
          </p>
        </div>
      </div>
    </section>
  )
}
