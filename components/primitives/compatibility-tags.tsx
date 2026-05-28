import { Badge } from "@/components/ui/badge"
import type { CompatibleAgent } from "@/lib/types"

export function CompatibilityTags({ agents }: { agents: CompatibleAgent[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {agents.map((agent) => (
        <Badge
          key={agent}
          variant="outline"
          className="border-border bg-secondary/50 text-muted-foreground text-[10px] font-mono px-1.5 py-0"
        >
          {agent}
        </Badge>
      ))}
    </div>
  )
}
