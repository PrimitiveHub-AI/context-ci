import Link from "next/link"
import type { Metadata } from "next"
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react"

import { DemoDataBadge } from "@/components/primitives/demo-data-badge"
import { Sparkline } from "@/components/status/sparkline"
import {
  loadStatusSnapshot,
  serviceStateLabel,
  uptimeWindow,
  type Incident,
  type Service,
  type ServiceState,
} from "@/lib/status"
import { isEnabled } from "@/lib/flags"
import { ComingSoonPanel } from "@/components/ui/coming-soon"

/**
 * /status — public status page (schema staged for Gate G-G).
 *
 * Pre-launch the data is sample (clearly disclaimed via
 * <DemoDataBadge>) and the page inherits the layout-level noindex
 * block. The shape of the page is launch-day final — when the live
 * status backend lands, only `lib/status.ts` changes; the UI here
 * stays the same.
 *
 * The visual idiom is the iconic 90-day vertical-bar chart per
 * service (statuspage.io / atlassian / upptime). Each cell = one
 * calendar day. Hover shows that day's uptime; cell color reflects
 * the worst severity reached during the window.
 */

export const metadata: Metadata = {
  title: "Status — PrimitiveHub",
  description:
    "Operational status for every PrimitiveHub surface — /check, Trust Bundle lookup, Registry, Forge, MCP runtime gate, scanner-bench gate, and the public Sigstore dependency.",
}

function StateIcon({ state, className }: { state: ServiceState; className?: string }) {
  switch (state) {
    case "operational":
      return <CheckCircle2 className={className} aria-hidden />
    case "degraded":
      return <AlertTriangle className={className} aria-hidden />
    case "partial-outage":
    case "major-outage":
      return <AlertOctagon className={className} aria-hidden />
  }
}

function stateColor(state: ServiceState): string {
  switch (state) {
    case "operational":
      return "text-success/90"
    case "degraded":
      return "text-amber/90"
    case "partial-outage":
    case "major-outage":
      return "text-destructive/90"
  }
}

function cellColor(state: ServiceState): string {
  switch (state) {
    case "operational":
      return "bg-success/70"
    case "degraded":
      return "bg-amber/80"
    case "partial-outage":
      return "bg-destructive/70"
    case "major-outage":
      return "bg-destructive"
  }
}

function stateTone(state: ServiceState): "success" | "amber" | "destructive" {
  switch (state) {
    case "operational":
      return "success"
    case "degraded":
      return "amber"
    case "partial-outage":
    case "major-outage":
      return "destructive"
  }
}

function ServiceRow({ service }: { service: Service }) {
  const u24 = uptimeWindow(service.history, 1)
  const u7 = uptimeWindow(service.history, 7)
  const u30 = uptimeWindow(service.history, 30)
  return (
    <div className="border-b border-border/40 px-5 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StateIcon state={service.currentState} className={`size-3.5 ${stateColor(service.currentState)}`} />
            <h3 className="text-sm font-semibold text-foreground truncate">{service.name}</h3>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                service.currentState === "operational"
                  ? "bg-success/[0.08] border border-success/25 text-success/90"
                  : "bg-amber/[0.08] border border-amber/25 text-amber/90"
              }`}
            >
              {serviceStateLabel(service.currentState)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
            {service.description}
          </p>
        </div>
        <div className="hidden md:flex gap-4 shrink-0 text-right">
          {[
            { label: "24h", value: u24 },
            { label: "7d", value: u7 },
            { label: "30d", value: u30 },
          ].map((w) => (
            <div key={w.label}>
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/80">
                {w.label}
              </p>
              <p
                className={`text-[13px] font-mono tabular-nums ${
                  w.value < 99.9 ? "text-amber" : "text-foreground/85"
                }`}
              >
                {w.value.toFixed(3)}%
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-border/30 bg-background/40 p-1.5">
        <Sparkline history={service.history} tone={stateTone(service.currentState)} height={42} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
        <span>90 days ago</span>
        <span>today</span>
      </div>
    </div>
  )
}

function severityColor(s: Incident["currentStatus"]): string {
  switch (s) {
    case "investigating":
      return "text-amber/90 border-amber/30 bg-amber/[0.06]"
    case "identified":
      return "text-amber/90 border-amber/30 bg-amber/[0.06]"
    case "monitoring":
      return "text-primary/90 border-primary/30 bg-primary/[0.06]"
    case "resolved":
      return "text-success/90 border-success/30 bg-success/[0.06]"
  }
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${severityColor(incident.currentStatus)}`}
            >
              {incident.currentStatus}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {incident.id}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{incident.title}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Started <time dateTime={incident.startedAt}>{incident.startedAt}</time>
            {incident.resolvedAt && (
              <>
                {" "}· resolved <time dateTime={incident.resolvedAt}>{incident.resolvedAt}</time>
              </>
            )}
            {" "}· affected: <span className="font-mono">{incident.affectedServices.join(", ")}</span>
          </p>
        </div>
      </div>
      <ol className="divide-y divide-border/40">
        {incident.updates.map((u) => (
          <li key={u.at} className="px-5 py-3 flex items-start gap-3">
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${severityColor(u.status)}`}
            >
              {u.status}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-foreground/90 leading-relaxed">{u.note}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                <time dateTime={u.at}>{u.at}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function StatusPage() {
  if (!isEnabled("status")) {
    return (
      <ComingSoonPanel
        icon={Clock}
        label="Planned · live backend"
        title="Status page"
        description="Live uptime and incident history for every PrimitiveHub surface. Goes live when the status backend does."
      />
    )
  }
  const snap = loadStatusSnapshot()
  const operational = snap.overall === "operational"
  const activeIncidents = snap.incidents.filter((i) => i.currentStatus !== "resolved")

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 lg:px-6">
      {/* Active incident banner — only renders if any incident is
          unresolved. Pre-launch sample data has 0 active; banner
          stays hidden today. */}
      {activeIncidents.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber/40 bg-gradient-to-br from-amber/[0.12] via-amber/[0.06] to-transparent p-5 shadow-2xl shadow-amber/10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-amber/[0.18] border border-amber/40 text-amber shrink-0">
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber/90 mb-1">
                {activeIncidents.length} active incident{activeIncidents.length === 1 ? "" : "s"}
              </p>
              <h2 className="text-base font-semibold text-foreground">
                {activeIncidents[0].title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Affected: <span className="font-mono">{activeIncidents[0].affectedServices.join(", ")}</span>
                {" · "}
                <Link href="#incidents" className="text-amber/90 hover:text-amber inline-flex items-center gap-0.5">
                  Read updates <ChevronDown className="size-2.5" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header — overall state + last-checked + sample disclosure */}
      <header className="mb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
              System status
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              {operational ? "All systems operational." : "Investigating an incident."}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Every shipped PrimitiveHub surface — and the public Sigstore
              dependency the verifier kernel rides — gets one row below.
              90-day history per service; 24h / 7d / 30d uptime computed
              from the same series.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Clock className="size-3 text-muted-foreground" />
            <p className="text-[11px] font-mono text-muted-foreground tabular-nums">
              last checked{" "}
              <time dateTime={snap.checkedAt}>{snap.checkedAt}</time>
            </p>
          </div>
        </div>

        {snap.isSample && (
          <div className="mt-5 flex items-center gap-2 rounded-md border border-amber/20 bg-amber/[0.04] px-3 py-2">
            <DemoDataBadge label="schema staged" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Status data is sample. The live backend lands with Gate G-G;
              this page&rsquo;s shape is launch-final, only the data source
              changes.
            </p>
          </div>
        )}
      </header>

      {/* Services */}
      <section className="rounded-xl border border-border/40 bg-card overflow-hidden">
        <div className="border-b border-border/40 bg-secondary/20 px-5 py-2.5 flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Services
          </h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            {snap.services.length} surfaces · 90-day history
          </p>
        </div>
        {snap.services.map((s) => (
          <ServiceRow key={s.slug} service={s} />
        ))}
      </section>

      {/* Incidents */}
      <section id="incidents" className="scroll-mt-20 mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Recent incidents
          </h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            append-only · oldest update first
          </p>
        </div>
        {snap.incidents.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
            No incidents in the rolling window.
          </div>
        ) : (
          <div className="space-y-3">
            {snap.incidents.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </section>

      {/* Subscribe / source */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-card/50 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            How this page is computed
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each row reports a single shipped surface; the Sigstore row
            tracks the one external dependency the verifier kernel cannot
            internalise. Uptime windows are arithmetic means of the
            per-day sample; nothing is smoothed.
          </p>
          <Link
            href="/docs/trust-contract"
            className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-primary/90 hover:text-primary"
          >
            What does the verifier do when Sigstore is down?
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Report a verification problem
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If a primitive that should verify is failing, or one that
            should fail is verifying, file a False Positive / False
            Negative report directly from <Link href="/check" className="text-primary/90 hover:text-primary">/check</Link>. Verification issues do not need
            to wait for an incident on this page.
          </p>
          <a
            href="https://github.com/DevXYZx/primitivehub/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-primary/90 hover:text-primary"
          >
            Read SECURITY.md
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </section>
    </main>
  )
}
