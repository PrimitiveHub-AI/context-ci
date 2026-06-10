import { cn } from "@/lib/utils"

/**
 * TerminalFrame — macOS-style window chrome around terminal output.
 *
 * Visual register chosen deliberately for the "between PrimitiveHub
 * and Coolify" brief: a dark glassy frame with subtle cyan gradient
 * border that reads as real product, not a Markdown code-block. The
 * three traffic-light dots are non-functional (this isn't a real
 * terminal), but they make the surface read as a captured artefact
 * the way Stripe / Linear / Coolify product shots do.
 *
 * Usage:
 *   <TerminalFrame title="phub audit" tone="cyan">
 *     <TerminalLine>$ phub audit</TerminalLine>
 *     <TerminalLine intent="muted">▸ walking process.cwd()...</TerminalLine>
 *   </TerminalFrame>
 *
 * Density is intentional — the frame is the surface, the children are
 * the content. Avoid wrapping non-terminal content in this; use
 * <Card> for that.
 */

type Tone = "cyan" | "amber" | "neutral"

const toneGradient: Record<Tone, string> = {
  cyan: "from-primary/30 via-primary/10 to-transparent",
  amber: "from-amber/30 via-amber/10 to-transparent",
  neutral: "from-foreground/15 via-foreground/5 to-transparent",
}

const toneAccent: Record<Tone, string> = {
  cyan: "text-primary/70",
  amber: "text-amber/80",
  neutral: "text-foreground/60",
}

export function TerminalFrame({
  title,
  tone = "cyan",
  className,
  children,
}: {
  title: string
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl bg-gradient-to-br p-px shadow-2xl shadow-black/40",
        toneGradient[tone],
        className,
      )}
    >
      <div className="rounded-[11px] overflow-hidden bg-[#0a0e14] border border-border/30">
        {/* Title bar with traffic-light dots */}
        <div className="flex items-center gap-2 border-b border-border/30 bg-gradient-to-b from-foreground/[0.04] to-transparent px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className={cn("flex-1 text-center text-[11px] font-mono tracking-wide", toneAccent[tone])}>
            {title}
          </div>
          <div className="w-10" /> {/* spacer to balance the dots */}
        </div>
        <div className="bg-[#0a0e14] font-mono text-[12px] leading-[1.7] text-foreground/85">
          {children}
        </div>
      </div>
    </div>
  )
}

type Intent = "default" | "muted" | "pass" | "warn" | "fail" | "prompt" | "accent"

const intentColor: Record<Intent, string> = {
  default: "text-foreground/85",
  muted: "text-muted-foreground/70",
  pass: "text-success/90",
  warn: "text-amber/90",
  fail: "text-destructive/90",
  prompt: "text-primary/70",
  accent: "text-primary",
}

/**
 * TerminalLine — single line with optional intent color.
 * Intents map to verdict semantics: pass (green), warn (amber), fail
 * (red), prompt (cyan $), accent (cyan highlight), muted (subdued).
 */
export function TerminalLine({
  intent = "default",
  className,
  children,
}: {
  intent?: Intent
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "whitespace-pre overflow-x-auto px-4",
        intentColor[intent],
        className,
      )}
    >
      {children}
    </div>
  )
}

/** TerminalBlock — vertical-padded group of TerminalLines. */
export function TerminalBlock({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("py-3", className)}>{children}</div>
}
