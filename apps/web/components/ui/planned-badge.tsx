import { CapabilityBadge } from "@/components/ui/capability-badge"

/**
 * PlannedBadge — thin alias over <CapabilityBadge state="planned" />.
 *
 * Kept for the many existing call sites; the canonical primitive is now
 * CapabilityBadge (available / preview / planned / unavailable), so the
 * "Planned" house style has one source of truth.
 */
export function PlannedBadge({
  label = "Planned",
  className,
}: {
  label?: string
  className?: string
}) {
  return <CapabilityBadge state="planned" label={label} className={className} />
}
