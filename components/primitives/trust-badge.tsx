import { Badge } from "@/components/ui/badge"
import type { TrustStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ShieldCheck, Clock, FlaskConical, Archive } from "lucide-react"

const statusConfig: Record<TrustStatus, { icon: React.ElementType; className: string }> = {
  Trusted: { icon: ShieldCheck, className: "border-success/30 bg-success/10 text-success" },
  "In Review": { icon: Clock, className: "border-amber/30 bg-amber/10 text-amber" },
  Experimental: { icon: FlaskConical, className: "border-violet/30 bg-violet/10 text-violet" },
  Deprecated: { icon: Archive, className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground" },
}

export function TrustBadge({ status }: { status: TrustStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={cn("gap-1 font-mono text-[11px]", config.className)}>
      <Icon className="size-3" />
      {status}
    </Badge>
  )
}
