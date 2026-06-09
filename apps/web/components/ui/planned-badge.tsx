import { cn } from "@/lib/utils"

/**
 * PlannedBadge — the one chip for a deferred-but-coming feature.
 *
 * Reuses the CLIRoadmap "planned for v1" house style: mono, uppercase,
 * tracked, primary-tinted. Factual and quiet — no hype, no countdown
 * (brand-voice). Sits next to a disabled CTA or a deferred nav item.
 */
export function PlannedBadge({
  label = "Planned",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.04] px-2.5 py-0.5",
        "text-[10px] font-mono uppercase tracking-widest text-primary/80",
        className,
      )}
    >
      <span className="size-1 rounded-full bg-primary/60" />
      {label}
    </span>
  )
}
