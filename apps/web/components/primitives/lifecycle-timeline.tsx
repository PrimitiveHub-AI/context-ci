import { FileEdit, Upload, ShieldCheck, UserCheck, Award, Archive } from "lucide-react"
import { cn } from "@/lib/utils"

export type LifecycleStage =
  | "Draft"
  | "Submitted"
  | "Context CI"
  | "Human Review"
  | "Trusted Release"
  | "Deprecated"

const STAGES: Array<{
  name: LifecycleStage
  icon: React.ElementType
  description: string
}> = [
  {
    name: "Draft",
    icon: FileEdit,
    description: "Authored in the Workbench. Local-only. Never visible to the registry.",
  },
  {
    name: "Submitted",
    icon: Upload,
    description: "Pushed to the registry intake. Author identity bound via OIDC.",
  },
  {
    name: "Context CI",
    icon: ShieldCheck,
    description: "10-stage automated pipeline: schema, safety, contradiction, token, benchmark.",
  },
  {
    name: "Human Review",
    icon: UserCheck,
    description: "Domain expert reviewer with verified credentials and bound identity.",
  },
  {
    name: "Trusted Release",
    icon: Award,
    description: "Attested via in-toto + Sigstore. Immutable content digest. Installable.",
  },
  {
    name: "Deprecated",
    icon: Archive,
    description: "Superseded or withdrawn. Old versions remain content-addressable.",
  },
]

interface LifecycleTimelineProps {
  /** Highlight a specific stage (used on primitive-detail pages). */
  currentStage?: LifecycleStage
  /** Compact horizontal-only variant for tight contexts. */
  compact?: boolean
  className?: string
}

export function LifecycleTimeline({
  currentStage,
  compact = false,
  className,
}: LifecycleTimelineProps) {
  return (
    <div className={cn("w-full", className)}>
      {!compact && (
        <div className="mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
            Primitive Lifecycle
          </p>
          <h3 className="text-base font-semibold text-foreground">
            From Draft to Trusted Release
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Every primitive moves through a defined lifecycle. Each stage is a
            documented attestation step; nothing reaches the registry without a
            passing Context CI run and a positive human review.
          </p>
        </div>
      )}

      <ol className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6 rounded-xl border border-border/40 overflow-hidden bg-border/40">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon
          const isCurrent = currentStage === stage.name
          const isPast =
            currentStage !== undefined &&
            STAGES.findIndex((s) => s.name === currentStage) > i
          return (
            <li
              key={stage.name}
              className={cn(
                "relative flex flex-col items-center bg-card p-4 text-center transition-colors",
                isCurrent && "bg-primary/[0.06]",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full mb-2 transition-colors",
                  isCurrent
                    ? "bg-primary/15 ring-2 ring-primary/40"
                    : isPast
                      ? "bg-success/[0.08]"
                      : "bg-secondary/40",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    isCurrent
                      ? "text-primary"
                      : isPast
                        ? "text-success/80"
                        : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              </span>
              <span
                className={cn(
                  "text-[9px] font-mono uppercase tracking-widest mb-1",
                  isCurrent ? "text-primary/80" : "text-primary/50",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p
                className={cn(
                  "text-[11px] font-semibold leading-tight",
                  isCurrent ? "text-foreground" : "text-foreground/85",
                )}
              >
                {stage.name}
              </p>
              {!compact && (
                <p className="mt-1.5 text-[9px] text-muted-foreground leading-relaxed">
                  {stage.description}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
