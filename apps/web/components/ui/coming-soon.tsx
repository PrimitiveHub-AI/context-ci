import Link from "next/link"
import { Clock, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PlannedBadge } from "@/components/ui/planned-badge"

/**
 * ComingSoonPanel — the deliberate state for a deferred surface.
 *
 * One pattern, reused for every postponed route. icon + Planned chip +
 * title + one-line "what it'll do" + a single way back. No countdowns,
 * no email capture, no "stay tuned" (brand-voice + no-fake-numbers). A
 * postponed surface should read as a considered decision, not an outage.
 */
export function ComingSoonPanel({
  title,
  description,
  label = "Planned",
  icon: Icon = Clock,
  backHref = "/",
  backLabel = "Back to home",
}: {
  title: string
  description: string
  label?: string
  icon?: LucideIcon
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <Empty className="max-w-md border-border/40">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-primary/[0.06] text-primary">
            <Icon className="size-6" />
          </EmptyMedia>
          <PlannedBadge label={label} />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" className="border-border/60" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
