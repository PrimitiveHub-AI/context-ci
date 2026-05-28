import { cn } from "@/lib/utils"

interface ScoreBadgeProps {
  label: string
  score: number
  className?: string
}

export function ScoreBadge({ label, score, className }: ScoreBadgeProps) {
  const color =
    score >= 95
      ? "text-success"
      : score >= 90
        ? "text-primary"
        : score >= 80
          ? "text-amber"
          : "text-destructive"

  const bgColor =
    score >= 95
      ? "bg-success/[0.06]"
      : score >= 90
        ? "bg-primary/[0.06]"
        : score >= 80
          ? "bg-amber/[0.06]"
          : "bg-destructive/[0.06]"

  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-md px-3 py-2", bgColor, className)}>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
      <span className={cn("text-xl font-bold font-mono tabular-nums", color)}>{score}</span>
    </div>
  )
}
