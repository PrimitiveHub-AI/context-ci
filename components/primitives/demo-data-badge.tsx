import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface DemoDataBadgeProps {
  label?: string
  className?: string
  title?: string
}

export function DemoDataBadge({
  label = "demo data",
  className,
  title = "Prototype seed values. Not measured against live agents. Replaced with real benchmark output once Context CI v1 ships.",
}: DemoDataBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-amber/25 bg-amber/[0.06] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber/85",
        className,
      )}
      title={title}
      aria-label={`${label} — ${title}`}
    >
      <Info className="size-2.5" aria-hidden />
      {label}
    </span>
  )
}
