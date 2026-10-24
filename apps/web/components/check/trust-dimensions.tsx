import {
  FileSearch,
  Fingerprint,
  UserCheck,
  GitBranch,
  Gavel,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import type { CheckResponse } from "@/lib/check/types"

/**
 * TrustDimensions — the five separated trust properties of a /check result.
 *
 * UI/UX audit (2026-10-24): "stop treating a trust score as the whole
 * verdict." A file can be free of malicious patterns and still come from an
 * unverified publisher; a publisher can be signed and still ship dangerous
 * instructions. Those are DIFFERENT properties — so we show each one with an
 * explicit state and never let a clean content scan imply a verified publisher.
 *
 * The honest mapping for v0.1 /check (static inspection, no crypto):
 *   Content risk       — ASSESSED      (this is what /check does)
 *   Integrity          — RECORDED / N/A (did we pin the bytes we scanned?)
 *   Publisher identity — NOT VERIFIED  (no signature checked; Sigstore = v0.2)
 *   Provenance         — NOT VERIFIED  (no attestation / Rekor chain checked)
 *   Policy approval    — ASSESSED      (the Context CI policy verdict)
 *
 * "Not verified" means we did NOT check it — never a pass or a fail.
 */

type DimState = "assessed" | "recorded" | "not-verified" | "not-applicable"

const STATE_STYLE: Record<DimState, { label: string; chip: string; dot: string }> = {
  assessed: {
    label: "Assessed",
    chip: "border-primary/25 bg-primary/[0.06] text-primary/90",
    dot: "bg-primary/70",
  },
  recorded: {
    label: "Recorded",
    chip: "border-success/25 bg-success/[0.06] text-success/90",
    dot: "bg-success/70",
  },
  "not-verified": {
    label: "Not verified",
    chip: "border-amber/25 bg-amber/[0.06] text-amber/90",
    dot: "bg-amber/70",
  },
  "not-applicable": {
    label: "N/A",
    chip: "border-border/50 bg-card/40 text-muted-foreground/70",
    dot: "bg-muted-foreground/40",
  },
}

interface Dim {
  icon: LucideIcon
  name: string
  state: DimState
  detail: string
}

function truncate(s: string): string {
  return s.length > 28 ? `${s.slice(0, 28)}…` : s
}

function deriveDimensions(result: CheckResponse): Dim[] {
  const s = result.summary
  const t = result.target
  const n = s.detectorsTriggered

  const contentRisk: Dim = {
    icon: FileSearch,
    name: "Content risk",
    state: "assessed",
    detail:
      n === 0
        ? "No findings under the Context CI Top 10."
        : `${n} finding${n === 1 ? "" : "s"} across ${s.detectorsRun} detectors (${s.verdictBand}).`,
  }

  let integrity: Dim
  if (t.kind === "npm-package") {
    const pin = t.integrity || t.shasum
    integrity = pin
      ? { icon: Fingerprint, name: "Integrity", state: "recorded", detail: `Bytes pinned by registry digest (${truncate(pin)}).` }
      : { icon: Fingerprint, name: "Integrity", state: "not-applicable", detail: "No digest published by the registry for this version." }
  } else if (t.kind === "github-repo") {
    integrity = t.commitSha
      ? { icon: Fingerprint, name: "Integrity", state: "recorded", detail: `Scanned at immutable commit ${t.commitSha.slice(0, 12)}.` }
      : { icon: Fingerprint, name: "Integrity", state: "not-applicable", detail: "Mutable ref — no immutable commit SHA was recorded." }
  } else {
    integrity = { icon: Fingerprint, name: "Integrity", state: "not-applicable", detail: "Pasted or fetched content — no pinned reference to check against." }
  }

  const publisher: Dim = {
    icon: UserCheck,
    name: "Publisher identity",
    state: "not-verified",
    detail: "/check does not verify a signer. Sigstore identity verification lands in v0.2.",
  }

  const provenance: Dim = {
    icon: GitBranch,
    name: "Provenance",
    state: "not-verified",
    detail: "No attestation or Rekor transparency-log chain was checked.",
  }

  const policy: Dim = {
    icon: Gavel,
    name: "Policy approval",
    state: "assessed",
    detail: s.passed
      ? "Passes the default Context CI policy (no fail-severity findings)."
      : `${s.failCount} fail-severity finding${s.failCount === 1 ? "" : "s"} breach the default policy.`,
  }

  return [contentRisk, integrity, publisher, provenance, policy]
}

export function TrustDimensions({ result }: { result: CheckResponse }) {
  const dims = deriveDimensions(result)
  return (
    <Card className="border-border/40 bg-card p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">
        Trust dimensions
      </h3>
      <p className="text-[11px] leading-relaxed text-muted-foreground mb-3">
        <span className="text-foreground/90">/check inspects content.</span> It does
        not establish who published it, or that it was signed — those are separate
        properties. Each is shown honestly below; a clean scan is not a verified publisher.
      </p>
      <ul className="space-y-1.5">
        {dims.map((d) => {
          const Icon = d.icon
          const st = STATE_STYLE[d.state]
          return (
            <li
              key={d.name}
              className="flex items-start gap-3 rounded-md border border-border/40 bg-secondary/10 px-3 py-2"
            >
              <Icon className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-foreground">{d.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-mono uppercase tracking-wider ${st.chip}`}
                  >
                    <span className={`size-1 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {d.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
