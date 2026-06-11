"use client"

import { useState } from "react"
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/**
 * ForgeSidePanel — consolidated tabbed panel.
 *
 * Pre-this-PR the Forge right column carried four vertically-stacked
 * cards (Trust Readiness + Sections + Lint Output + Target Agents).
 * Reading as four sparse boxes was the "AI-kiddy" pattern the
 * maintainer named.
 *
 * Trust Readiness stays at the top of the column (it is the
 * verdict — the question the author asks first). The other three
 * collapse into this tabbed panel: Sections / Lint / Agents. One
 * card, three views. Editor gets the visual breathing room back.
 */

type TabId = "sections" | "lint" | "agents"

interface SectionRow {
  name: string
  present: boolean
  required: boolean
}

interface LintFinding {
  code: string
  message: string
  severity: "error" | "warning" | "info"
  line?: number
}

interface ForgeSidePanelProps {
  sections: ReadonlyArray<SectionRow>
  findings: ReadonlyArray<LintFinding>
  agents: ReadonlyArray<string>
}

const TABS: ReadonlyArray<{
  id: TabId
  label: string
  icon: LucideIcon
}> = [
  { id: "sections", label: "Sections", icon: CheckCircle2 },
  { id: "lint", label: "Lint", icon: AlertTriangle },
  { id: "agents", label: "Agents", icon: Info },
]

export function ForgeSidePanel({
  sections,
  findings,
  agents,
}: ForgeSidePanelProps) {
  const [tab, setTab] = useState<TabId>("sections")

  const counts: Record<TabId, number> = {
    sections: sections.filter((s) => !s.present && s.required).length,
    lint: findings.length,
    agents: agents.length,
  }

  return (
    <Card id="forge-lint-output" className="scroll-mt-24 border-border/40 bg-card overflow-hidden">
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Authoring inspector"
        className="grid grid-cols-3 border-b border-border/40 bg-secondary/20"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          const count = counts[t.id]
          const showBadge = t.id === "lint" ? findings.length > 0 : false
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                "relative flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "text-primary bg-card"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-card/60",
              ].join(" ")}
            >
              <Icon className="size-3" />
              <span>{t.label}</span>
              {showBadge && (
                <span
                  className={[
                    "ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[9px] font-mono tabular-nums",
                    findings.some((f) => f.severity === "error")
                      ? "bg-destructive/15 text-destructive/90"
                      : "bg-amber/15 text-amber/90",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-8 bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-[280px]">
        {tab === "sections" && <SectionsPanel sections={sections} />}
        {tab === "lint" && <LintPanel findings={findings} />}
        {tab === "agents" && <AgentsPanel agents={agents} />}
      </div>
    </Card>
  )
}

function SectionsPanel({ sections }: { sections: ReadonlyArray<SectionRow> }) {
  const required = sections.filter((s) => s.required)
  const optional = sections.filter((s) => !s.required)
  const requiredPresent = required.filter((s) => s.present).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
        <span className="text-muted-foreground/80">Required</span>
        <span
          className={
            requiredPresent === required.length
              ? "text-success/90 tabular-nums"
              : "text-amber font-semibold tabular-nums"
          }
        >
          {requiredPresent}/{required.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {required.map((s) => (
          <SectionRowItem key={s.name} section={s} />
        ))}
      </ul>
      {optional.length > 0 && (
        <>
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider pt-2 border-t border-border/40">
            <span className="text-muted-foreground/80">Optional</span>
            <span className="text-muted-foreground tabular-nums">
              {optional.filter((s) => s.present).length}/{optional.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {optional.map((s) => (
              <SectionRowItem key={s.name} section={s} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function SectionRowItem({ section }: { section: SectionRow }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {section.present ? (
          <CheckCircle2 className="size-3 shrink-0 text-success/70" />
        ) : section.required ? (
          <AlertTriangle className="size-3 shrink-0 text-destructive/70" />
        ) : (
          <Info className="size-3 shrink-0 text-muted-foreground/70" />
        )}
        <span
          className={`text-[11px] truncate ${
            section.present
              ? "text-muted-foreground"
              : section.required
                ? "text-destructive/85"
                : "text-muted-foreground/70"
          }`}
        >
          {section.name}
        </span>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
        {section.present ? "present" : section.required ? "missing" : "absent"}
      </span>
    </li>
  )
}

function LintPanel({ findings }: { findings: ReadonlyArray<LintFinding> }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-success/20 bg-success/[0.04] px-3 py-6 text-center">
        <CheckCircle2 className="inline size-4 text-success/80 mr-1.5 mb-0.5" />
        <span className="text-[12px] text-foreground/85">
          No findings — conforms to Spec v0.1.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {findings.map((finding, i) => (
        <div
          key={`${finding.code}-${i}`}
          className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] ${
            finding.severity === "error"
              ? "bg-destructive/[0.05] border border-destructive/20"
              : finding.severity === "warning"
                ? "bg-amber/[0.05] border border-amber/20"
                : "bg-primary/[0.04] border border-primary/15"
          }`}
        >
          {finding.severity === "error" ? (
            <XCircle className="size-3 shrink-0 text-destructive mt-0.5" />
          ) : finding.severity === "warning" ? (
            <AlertTriangle className="size-3 shrink-0 text-amber mt-0.5" />
          ) : (
            <Info className="size-3 shrink-0 text-primary mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-foreground/90 leading-relaxed">{finding.message}</p>
            <p className="mt-1 flex items-center gap-2 text-[9px] font-mono text-muted-foreground/70">
              <span>{finding.code}</span>
              {finding.line !== undefined && (
                <>
                  <span className="text-border">·</span>
                  <span>L{finding.line}</span>
                </>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function AgentsPanel({ agents }: { agents: ReadonlyArray<string> }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {agents.map((agent) => (
          <Badge
            key={agent}
            variant="outline"
            className="text-[10px] font-mono border-border/40 text-foreground/80 bg-card/80"
          >
            {agent}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        Declared in{" "}
        <code className="font-mono text-foreground/80">compatible_agents</code>{" "}
        frontmatter. These chips reflect the source of truth — they
        are not filters and have no click behaviour.
      </p>
    </div>
  )
}
