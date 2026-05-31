"use client"

/**
 * AttestationBadge — surfaces Sigstore signing status for a primitive
 * version. Subtle pill in the title row + optional verify-Rekor link.
 *
 * Design call (matches the rest of the PrimitiveHub design language):
 * trust is whispered, not shouted. A signed primitive shows a small
 * shield-check pill with the backend name; clicking opens the Rekor
 * entry in a new tab. No hero banner — Tufte-style restraint. If the
 * cryptography is real, it doesn't need to be loud.
 *
 * Four states:
 *   - signed   → shield-check icon + "Verified · <backend>" + verify link
 *   - pending  → spinner shimmer + "Signing…" (polled via useAttestation)
 *   - failed   → warning icon + truncated failure_reason + hover for full
 *   - unsigned → muted "No attestation" — for legacy primitives without
 *                an attestation row at all (HTTP 404 from /attestation)
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so screen readers announce
 *     status changes when polling transitions pending → signed/failed
 *   - icon-only buttons have aria-label
 *   - failure reason truncated visually but full in title attribute
 */

import { ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAttestation } from "@/lib/api/queries"
import { cn } from "@/lib/utils"

export interface AttestationBadgeProps {
  slug: string
  semver: string
  /** Compact mode for inline use (e.g. in a card header). Defaults false. */
  compact?: boolean
}

export function AttestationBadge({
  slug,
  semver,
  compact = false,
}: AttestationBadgeProps) {
  const { data, error, isLoading } = useAttestation(slug, semver)

  // ── Initial load (no data yet, no error) — render placeholder ────────
  if (isLoading && !data) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-muted-foreground/20 bg-muted/30 font-mono text-[11px] text-muted-foreground"
        role="status"
        aria-label="Loading attestation status"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/40" />
        Loading…
      </Badge>
    )
  }

  // ── 404 = no attestation row exists for this version ────────────────
  if (error) {
    const is404 =
      error instanceof Error && /\b404\b/.test(error.message)
    if (is404) {
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-muted-foreground/20 bg-muted/30 font-mono text-[11px] text-muted-foreground"
          role="status"
          aria-label="This version was not signed by Sigstore"
        >
          <ShieldQuestion className="size-3" aria-hidden="true" />
          No attestation
        </Badge>
      )
    }
    // Other errors — show a neutral state, don't fail the whole page.
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-muted-foreground/20 bg-muted/30 font-mono text-[11px] text-muted-foreground"
        role="status"
      >
        <ShieldQuestion className="size-3" aria-hidden="true" />
        Status unavailable
      </Badge>
    )
  }

  if (!data) return null // should not reach — TS narrowing safety

  // ── pending / signing ────────────────────────────────────────────────
  if (data.status === "pending" || data.status === "signing") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber/30 bg-amber/10 font-mono text-[11px] text-amber"
        role="status"
        aria-live="polite"
        aria-label="Sigstore signature in progress"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-amber" />
        Signing…
      </Badge>
    )
  }

  // ── failed ──────────────────────────────────────────────────────────
  if (data.status === "failed") {
    const reason = data.failureReason ?? "Sign failed (no detail)"
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 border-destructive/40 bg-destructive/10 font-mono text-[11px] text-destructive",
                "cursor-help",
              )}
              role="status"
              aria-label={`Sigstore signing failed: ${reason}`}
            >
              <ShieldAlert className="size-3" aria-hidden="true" />
              Sign failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs font-mono text-xs">
            <p className="mb-1 font-semibold text-foreground">
              Signing failed (attempt {data.attempts})
            </p>
            <p className="text-muted-foreground">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // ── signed ──────────────────────────────────────────────────────────
  const backend = data.backendName ?? "sigstore"
  const verifyUrl = data.verifyUrl
  const logIndex = data.rekorLogIndex
  const signedDate = data.signedAt
    ? new Date(data.signedAt).toISOString().slice(0, 10)
    : null

  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="status"
      aria-label={`Verified by Sigstore (${backend}), signed ${signedDate ?? "recently"}`}
    >
      <Badge
        variant="outline"
        className="gap-1.5 border-success/30 bg-success/10 font-mono text-[11px] text-success"
      >
        <ShieldCheck className="size-3" aria-hidden="true" />
        {compact ? "Verified" : `Verified · ${backend}`}
      </Badge>
      {verifyUrl && logIndex !== null && !compact && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Open Rekor entry ${logIndex} in a new tab`}
              >
                <span>#{logIndex}</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">
              Verify on Rekor (log index {logIndex})
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  )
}
