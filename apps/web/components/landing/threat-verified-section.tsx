import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Code2,
  Terminal,
  KeyRound,
  FileCheck2,
  Fingerprint,
  Users,
  Lock,
  type LucideIcon,
} from "lucide-react"

/**
 * Threat → Verified — the single threat-story moment.
 *
 * Visual register upgrade per the maintainer's "between PrimitiveHub
 * / skills.sh / coolify.io" brief. The pre-upgrade layout was two
 * flat <Card>s with bulleted lists — visually monotonous, read as
 * "AI generated columns." The story is the same; the depth carries
 * it now.
 *
 * Structure:
 *   - Header (h2 + lead + curl|bash accent quote-pill)
 *   - 2-col split with a visible arrow between columns mapping
 *     threats (left, destructive accent) -> controls (right,
 *     success accent). Each side is a gradient-bordered card with
 *     per-row icons + intent colors.
 *   - Thesis quote-card with depth: open-quote glyph, larger type,
 *     accent border + shadow.
 *
 * Doctrine preserved: 4 threats from § "The named enemy" matched
 * against 4 controls from Operating Laws 1-4. No metrics here -
 * canonical macro-F1 lives in the Hero status pill.
 */

interface ThreatRow {
  icon: LucideIcon
  name: string
  detail: string
}

interface ControlRow {
  icon: LucideIcon
  name: string
  detail: string
}

const THREATS: ReadonlyArray<ThreatRow> = [
  {
    icon: Zap,
    name: "Prompt injection inside Markdown",
    detail: "Hidden imperative overrides the agent dutifully follows.",
  },
  {
    icon: Code2,
    name: "Hidden Unicode steganography",
    detail: "Tag-character payloads the eye can't see but the LLM tokenizes.",
  },
  {
    icon: Terminal,
    name: "Unsafe shell + npx patterns",
    detail: "curl-piped installers in “setup” steps — Codecov 2021 redux.",
  },
  {
    icon: KeyRound,
    name: "Credential exfiltration via prose",
    detail: "Instructions to read .env / ~/.ssh / AWS keys into outputs.",
  },
]

const CONTROLS: ReadonlyArray<ControlRow> = [
  {
    icon: FileCheck2,
    name: "Validated",
    detail: "Every byte scanned against the Context CI Top 10 — injection, steganography, shell, exfil.",
  },
  {
    icon: Fingerprint,
    name: "Attested",
    detail: "SHA-256 content digest + in-toto Statement, signed via Sigstore keyless OIDC.",
  },
  {
    icon: Users,
    name: "Reviewed",
    detail: "Domain experts with bound OIDC identities. Public uploads enter review, never auto-trusted.",
  },
  {
    icon: Lock,
    name: "Gated",
    detail: "Policy-gated install. Refused at the gate — and logged to Rekor — if it doesn't verify.",
  },
]

export function ThreatVerifiedSection() {
  return (
    <section
      id="threat"
      className="relative border-y border-border/40 overflow-hidden"
    >
      {/* Layered backdrop — destructive accent on the left, success
          accent on the right, visually telegraphing the threat → verified
          arc. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,oklch(0.62_0.20_25/0.06)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,oklch(0.72_0.16_155/0.06)_0%,transparent_55%)]"
      />
      <div className="bg-grid absolute inset-0 opacity-[0.12]" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-6 lg:py-24">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            The attack surface
          </p>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl text-balance">
            Agent context is an unguarded supply-chain surface.
          </h2>
          <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            AI agents — Claude Code, Cursor, Codex, Copilot — load Markdown
            skills, rule files, and instruction packages straight into their
            reasoning context, with your shell, your credentials, your tool
            surface. SLSA, in-toto, and Sigstore verify the{" "}
            <span className="text-foreground/85">code dependencies</span> and
            their build provenance; they do not judge the semantic
            instructions an agent reads as context. That is the gap
            PrimitiveHub closes.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-4 py-1.5 text-[12.5px] text-primary/95 leading-relaxed">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Fast unverified agent-skill installation is the new{" "}
            <code className="font-mono text-foreground/95">curl | bash</code>.
          </div>
        </div>

        {/* Threat vs control — split with mapping arrow */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch max-w-6xl mx-auto">
          {/* Threats card */}
          <ThreatCard threats={THREATS} />

          {/* Mapping arrow — visible on md+ only */}
          <div className="hidden md:flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 rotate-90 lg:rotate-0">
                Top 10
              </span>
              <div className="h-px w-12 bg-gradient-to-r from-destructive/40 via-primary/40 to-success/40" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                →
              </span>
              <div className="h-px w-12 bg-gradient-to-r from-destructive/40 via-primary/40 to-success/40" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 rotate-90 lg:rotate-0">
                Trust Bundle
              </span>
            </div>
          </div>

          {/* Controls card */}
          <ControlsCard controls={CONTROLS} />
        </div>

        {/* Thesis — quote-card with depth */}
        <div className="mt-12 mx-auto max-w-3xl">
          <div className="relative rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent p-px shadow-2xl shadow-black/40">
            <div className="rounded-[15px] bg-background/85 backdrop-blur-md p-7 text-center">
              <span
                aria-hidden
                className="block text-5xl font-serif text-primary/30 leading-none mb-2"
              >
                &ldquo;
              </span>
              <p className="text-lg font-medium text-foreground/95 leading-relaxed text-balance">
                PrimitiveHub treats agent context as{" "}
                <span className="text-primary glow-text-cyan">supply-chain material</span>,
                not disposable prompt text.
              </p>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                Operational mission · docs/doctrine.md
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ThreatCard({ threats }: { threats: ReadonlyArray<ThreatRow> }) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-destructive/25 via-destructive/8 to-transparent p-px shadow-2xl shadow-black/30">
      <div className="h-full rounded-[15px] bg-background/85 backdrop-blur-sm p-6 flex flex-col">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-destructive/[0.12] border border-destructive/30 text-destructive">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-destructive/95">
              Raw agent context
            </p>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wide">
              What hides in the bytes
            </p>
          </div>
        </div>
        <ul className="space-y-3 flex-1">
          {threats.map((t) => {
            const Icon = t.icon
            return (
              <li
                key={t.name}
                className="group flex items-start gap-3 rounded-lg border border-destructive/15 bg-destructive/[0.03] p-3 transition-colors hover:border-destructive/25 hover:bg-destructive/[0.05]"
              >
                <div className="shrink-0 flex size-7 items-center justify-center rounded-md bg-destructive/[0.10] text-destructive/90">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground/95">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                    {t.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ControlsCard({ controls }: { controls: ReadonlyArray<ControlRow> }) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-success/25 via-success/8 to-transparent p-px shadow-2xl shadow-black/30">
      <div className="h-full rounded-[15px] bg-background/85 backdrop-blur-sm p-6 flex flex-col">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-success/[0.12] border border-success/30 text-success">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-success/95">
              Verified agent context
            </p>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wide">
              What the kernel enforces
            </p>
          </div>
        </div>
        <ul className="space-y-3 flex-1">
          {controls.map((c) => {
            const Icon = c.icon
            return (
              <li
                key={c.name}
                className="group flex items-start gap-3 rounded-lg border border-success/15 bg-success/[0.03] p-3 transition-colors hover:border-success/25 hover:bg-success/[0.05]"
              >
                <div className="shrink-0 flex size-7 items-center justify-center rounded-md bg-success/[0.10] text-success/90">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground/95">{c.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                    {c.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
