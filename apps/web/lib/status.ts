/**
 * Status page data model.
 *
 * Schema staged for the public status surface (Gate G-G). Pre-launch
 * the data is sample — clearly disclaimed in the UI via the
 * existing `<DemoDataBadge>` primitive. Post-launch this module
 * either reads from a backend status API or gets replaced by a
 * Vercel/upptime/cron-driven snapshot. The shape stays the same.
 *
 * Design notes:
 *  - One row per shipped surface. The set matches the public funnel
 *    so a visitor scanning the page sees the same surfaces they hit
 *    on the homepage (Check → Top 10 → Context CI → Forge → Registry).
 *  - 90 daily samples per service. Vertical bar chart of 90 cells is
 *    the iconic status-page visual (cf. statuspage.io / atlassian /
 *    upptime). Each cell is one calendar day.
 *  - Three uptime windows (24h / 7d / 30d) are derived from the same
 *    90-day array — no separate measurement source.
 *  - Incidents are append-only with severity + status; closed
 *    incidents stay in the timeline so a visitor can audit history.
 */

export type ServiceState = "operational" | "degraded" | "partial-outage" | "major-outage"

export type IncidentSeverity = "investigating" | "identified" | "monitoring" | "resolved"

export interface DaySample {
  /** ISO-8601 date for this 24-hour window (UTC). */
  readonly date: string
  /** Percentage uptime over the window, in [0,100]. */
  readonly uptime: number
  /** Highest severity reached during the window, for cell color. */
  readonly state: ServiceState
}

export interface Service {
  readonly slug: string
  readonly name: string
  /** One-line description of what this service exposes. */
  readonly description: string
  /** Current state — drives the row's status pill. */
  readonly currentState: ServiceState
  /** 90-day sample series, oldest first. */
  readonly history: ReadonlyArray<DaySample>
}

export interface IncidentUpdate {
  readonly at: string
  readonly status: IncidentSeverity
  readonly note: string
}

export interface Incident {
  readonly id: string
  readonly title: string
  readonly startedAt: string
  readonly resolvedAt?: string
  readonly affectedServices: ReadonlyArray<string>
  readonly currentStatus: IncidentSeverity
  /** Update timeline, oldest first. */
  readonly updates: ReadonlyArray<IncidentUpdate>
}

export interface StatusSnapshot {
  /** ISO-8601 timestamp the page was rendered against. */
  readonly checkedAt: string
  /** Roll-up across all services. operational = all green. */
  readonly overall: ServiceState
  readonly services: ReadonlyArray<Service>
  readonly incidents: ReadonlyArray<Incident>
  /**
   * Marks the snapshot as sample data. The UI renders a
   * <DemoDataBadge> when true. Flip to false when the live status
   * backend lands.
   */
  readonly isSample: boolean
}

// Deterministic 90-day history generator — produces visually-correct
// sample data for the schema-staged surface. Most days operational;
// scattered light degradation; one historical 24h incident on day-32
// from end. Keeps the sample honest (status pages should not pretend
// 100% uptime; the visual signal in this row is exactly the kind of
// disclosed dip a viewer wants to see).
function sample90(seed: number, baseUptime: number, dipDay?: number): DaySample[] {
  const out: DaySample[] = []
  // Use a fixed base date so every render produces the same series
  // (otherwise SSR + client would disagree and the cells would
  // flicker). Fixed = "2026-06-10" minus 89 days.
  const base = new Date(Date.UTC(2026, 2, 13)) // 2026-03-13
  for (let i = 0; i < 90; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    const isDip = dipDay !== undefined && i === 90 - 1 - dipDay
    // Tiny deterministic jitter from the seed + index
    const jitter = ((seed * 17 + i * 31) % 100) / 10000
    const uptime = isDip ? 96.4 : Math.min(100, baseUptime - jitter)
    const state: ServiceState = isDip
      ? "degraded"
      : uptime < 99.5
        ? "degraded"
        : "operational"
    out.push({
      date: d.toISOString().slice(0, 10),
      uptime: Number(uptime.toFixed(3)),
      state,
    })
  }
  return out
}

const SAMPLE_SERVICES: ReadonlyArray<Service> = [
  {
    slug: "check-api",
    name: "/check paste-and-verdict API",
    description: "Public auto-detect input scanner — the AV cloud-lookup surface.",
    currentState: "operational",
    history: sample90(7, 99.97, 32),
  },
  {
    slug: "trust-api",
    name: "Trust Bundle lookup",
    description: "Public anonymous trust lookup by digest or slug+semver.",
    currentState: "operational",
    history: sample90(11, 99.99),
  },
  {
    slug: "registry-www",
    name: "Registry web UI",
    description: "Browsing and searching trusted primitives.",
    currentState: "operational",
    history: sample90(13, 99.95),
  },
  {
    slug: "forge",
    name: "Skill IDE",
    description: "Authoring surface with live Spec v0.1 lint + Trust Readiness panel.",
    currentState: "operational",
    history: sample90(17, 99.93),
  },
  {
    slug: "mcp-server",
    name: "MCP runtime gate",
    description: "verify_before_load for MCP-speaking agent runtimes.",
    currentState: "operational",
    history: sample90(19, 99.92),
  },
  {
    slug: "scanner-bench",
    name: "Scanner-bench regression gate",
    description: "ADR-0023 byte-identical Py↔TS parity, ADR-0037 floor enforcement.",
    currentState: "operational",
    history: sample90(23, 99.99),
  },
  {
    slug: "sigstore",
    name: "Sigstore dependency (external)",
    description: "Fulcio cert issuance + Rekor transparency log inclusion.",
    currentState: "operational",
    history: sample90(29, 99.91, 18),
  },
] as const

const SAMPLE_INCIDENTS: ReadonlyArray<Incident> = [
  {
    id: "INC-2026-005",
    title: "Sigstore Rekor inclusion delays — verification retries succeeded",
    startedAt: "2026-05-23T14:08:00Z",
    resolvedAt: "2026-05-23T15:42:00Z",
    affectedServices: ["sigstore"],
    currentStatus: "resolved",
    updates: [
      {
        at: "2026-05-23T14:08:00Z",
        status: "investigating",
        note: "Observed elevated Rekor inclusion-proof latency from public Sigstore. New attestations queued but not refused; verifier kernel retries with backoff.",
      },
      {
        at: "2026-05-23T14:36:00Z",
        status: "identified",
        note: "Upstream Sigstore incident confirmed via status.sigstore.dev. Our cache of recent trust roots covers in-flight verifications; no consumer-visible refusal.",
      },
      {
        at: "2026-05-23T15:19:00Z",
        status: "monitoring",
        note: "Upstream resolved; latency back to baseline. Watching the backlog drain.",
      },
      {
        at: "2026-05-23T15:42:00Z",
        status: "resolved",
        note: "No primitive failed verification during the window. Closing.",
      },
    ],
  },
] as const

/**
 * The single source of truth the page renders against. Replace with
 * a backend fetch when the live status pipeline lands.
 */
export function loadStatusSnapshot(): StatusSnapshot {
  return {
    checkedAt: "2026-06-10T00:00:00Z",
    overall: "operational",
    services: SAMPLE_SERVICES,
    incidents: SAMPLE_INCIDENTS,
    isSample: true,
  }
}

/** Window helpers — used by the row component to render the three uptime cells. */
export function uptimeWindow(history: ReadonlyArray<DaySample>, days: number): number {
  const slice = history.slice(-Math.min(days, history.length))
  if (slice.length === 0) return 100
  const sum = slice.reduce((acc, d) => acc + d.uptime, 0)
  return Number((sum / slice.length).toFixed(3))
}

export function serviceStateLabel(s: ServiceState): string {
  switch (s) {
    case "operational":
      return "Operational"
    case "degraded":
      return "Degraded performance"
    case "partial-outage":
      return "Partial outage"
    case "major-outage":
      return "Major outage"
  }
}
