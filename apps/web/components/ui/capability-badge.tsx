import { cn } from "@/lib/utils"

/**
 * CapabilityBadge — the one primitive for a feature's shipping state.
 *
 * Four states, applied consistently across marketing, docs, nav, and
 * product UI so a visitor always knows what they can do *today* vs what
 * is coming (UI/UX audit 2026-10-24, "explicit capability states"):
 *
 *   available   — live and usable right now
 *   preview     — usable but incomplete / may change
 *   planned     — scoped, not yet shipped (the old PlannedBadge)
 *   unavailable — deliberately off (e.g. flag-gated dormant surface)
 *
 * House style: mono, uppercase, tracked, dot + label. Factual and quiet
 * — no hype, no countdown (brand-voice).
 */
export type Capability = "available" | "preview" | "planned" | "unavailable"

const STYLES: Record<Capability, { label: string; wrap: string; dot: string }> = {
  available: {
    label: "Available",
    wrap: "border-success/25 bg-success/[0.06] text-success/90",
    dot: "bg-success/70",
  },
  preview: {
    label: "Preview",
    wrap: "border-amber/25 bg-amber/[0.06] text-amber/90",
    dot: "bg-amber/70",
  },
  planned: {
    label: "Planned",
    wrap: "border-primary/20 bg-primary/[0.04] text-primary/80",
    dot: "bg-primary/60",
  },
  unavailable: {
    label: "Unavailable",
    wrap: "border-border/50 bg-card/40 text-muted-foreground/70",
    dot: "bg-muted-foreground/50",
  },
}

export function CapabilityBadge({
  state,
  label,
  className,
}: {
  state: Capability
  /** Override the default state label (e.g. "Planned · v0.2"). */
  label?: string
  className?: string
}) {
  const s = STYLES[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[10px] font-mono uppercase tracking-widest",
        s.wrap,
        className,
      )}
    >
      <span className={cn("size-1 rounded-full", s.dot)} />
      {label ?? s.label}
    </span>
  )
}
