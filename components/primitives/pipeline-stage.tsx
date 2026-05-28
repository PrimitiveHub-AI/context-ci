import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react"

interface PipelineStageProps {
  name: string
  status: "passed" | "warning" | "failed"
  score: number
  duration: string
  log: string
  reviewer: string
  index: number
}

export function PipelineStage({ name, status, score, duration, log, reviewer, index }: PipelineStageProps) {
  const Icon = status === "passed" ? CheckCircle2 : status === "warning" ? AlertTriangle : XCircle
  const statusColor =
    status === "passed" ? "text-success" : status === "warning" ? "text-amber" : "text-destructive"
  const borderColor =
    status === "passed" ? "border-success/10" : status === "warning" ? "border-amber/15" : "border-destructive/15"
  const bgColor =
    status === "passed" ? "bg-success/[0.03]" : status === "warning" ? "bg-amber/[0.04]" : "bg-destructive/[0.04]"
  const linePrefix = status === "passed" ? "PASS" : status === "warning" ? "WARN" : "FAIL"

  return (
    <div className={cn("rounded-lg border p-4", borderColor, bgColor)}>
      <div className="flex items-start gap-3">
        {/* Index + status icon column */}
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-mono font-medium text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Icon className={cn("size-4", statusColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-foreground">{name}</h4>
              {reviewer && (
                <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono text-primary">
                  {reviewer}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-2.5" />
                {duration}
              </span>
              <span className={cn("text-xs font-mono font-semibold", statusColor)}>
                {score}
              </span>
            </div>
          </div>
          <div className="mt-1.5 rounded-md bg-background/50 px-2.5 py-1.5">
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              <span className={cn("font-semibold", statusColor)}>[{linePrefix}]</span>{" "}
              {log.replace(/^\[(passed|warning|failed|PASS|WARN|FAIL|release|RELEASE)\]\s*/i, "")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
