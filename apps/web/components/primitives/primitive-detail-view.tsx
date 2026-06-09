"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AttestationBadge } from "@/components/primitives/attestation-badge"
import { TrustBadge } from "@/components/primitives/trust-badge"
import { ScoreBadge } from "@/components/primitives/score-badge"
import { CompatibilityTags } from "@/components/primitives/compatibility-tags"
import { PipelineStage } from "@/components/primitives/pipeline-stage"
import { DemoDataBadge } from "@/components/primitives/demo-data-badge"
import { PlannedBadge } from "@/components/ui/planned-badge"
import { isEnabled } from "@/lib/flags"
import { usePrimitive } from "@/lib/api/queries"
import type { Primitive, PipelineStage as PipelineStageType } from "@/lib/types"
import {
  Copy,
  Download,
  FileText,
  Calendar,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Shield,
  Hash,
  Fingerprint,
} from "lucide-react"

const TABS = ["Overview", "Markdown", "Validation", "Benchmark", "Versions", "Reviews", "Provenance", "License"] as const
type TabName = (typeof TABS)[number]

interface PrimitiveDetailViewProps {
  primitive: Primitive
  pipelineStages: PipelineStageType[]
  /**
   * The real domain-specific markdown for this primitive, read at build time
   * from `content/primitives/<slug>.md`. `null` when no file exists yet —
   * the Markdown tab falls back to a generic template with a visible
   * "template fallback" badge.
   */
  markdownContent?: string | null
}

export function PrimitiveDetailView({
  primitive: initialPrimitive,
  pipelineStages,
  markdownContent,
}: PrimitiveDetailViewProps) {
  // Hydrate from the API after mount. Until the query resolves (or if it
  // errors), the build-time prop is the source of truth — keeps SSG + SEO
  // intact and the page renders without flicker. If the API returns fresh
  // data the live value replaces the prop transparently.
  const liveQuery = usePrimitive(initialPrimitive.slug)
  const primitive = liveQuery.data ?? initialPrimitive
  const liveDataState: "loading" | "live" | "stale" =
    liveQuery.isLoading
      ? "loading"
      : liveQuery.isError
        ? "stale"
        : "live"

  const [activeTab, setActiveTab] = useState<TabName>("Overview")
  const [copied, setCopied] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const tokenPercent = Math.round((primitive.tokens / primitive.tokenBudget) * 100)
  const hasRealMarkdown = typeof markdownContent === "string" && markdownContent.length > 0

  function handleCopy() {
    navigator.clipboard.writeText(primitive.installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyMarkdown() {
    if (!hasRealMarkdown) return
    try {
      await navigator.clipboard.writeText(markdownContent!)
      setCopiedMd(true)
      setTimeout(() => setCopiedMd(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="size-5 text-primary/70" />
                <h1 className="text-xl font-bold text-foreground sm:text-2xl font-mono">
                  {primitive.fileName}
                </h1>
                <TrustBadge status={primitive.status} />
                {/* Sigstore signing status (Phase 4 PR #5). Polls while
                    the worker is in-flight; reads from the live API. */}
                <AttestationBadge slug={primitive.slug} semver={primitive.version} />
                {/* Live-data signal — a quiet 1ch indicator. Hidden when
                    the API is reachable (live === default expectation);
                    visible only when degraded so it reads as a problem
                    badge, not chrome. */}
                {liveDataState === "stale" && (
                  <span
                    className="font-mono text-[10px] text-amber/80"
                    title="API unreachable — showing build-time snapshot"
                  >
                    snapshot
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{primitive.description}</p>

              {/* Meta */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="text-foreground/70">{primitive.author}</span>
                <span className="text-border">|</span>
                <span className="font-mono text-foreground/70">v{primitive.version}</span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {primitive.lastUpdated}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Scale className="size-3" />
                  {primitive.license}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Download className="size-3" />
                  {primitive.downloads.toLocaleString()} installs
                  <DemoDataBadge className="ml-1" />
                </span>
              </div>

              {/* Content Digest */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Fingerprint className="size-3 text-primary/50" />
                <span className="font-mono">
                  <span className="text-muted-foreground/60 mr-1">digest</span>
                  {primitive.contentDigest}
                </span>
              </div>

              {/* Compatibility */}
              <div className="mt-3">
                <CompatibilityTags agents={primitive.compatibleAgents} />
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {/* Install command */}
              <div className="flex items-center gap-1.5 rounded-md bg-secondary/40 border border-border/50 px-3 py-2">
                <span className="text-[10px] font-mono text-primary/60 select-none">$</span>
                <code className="text-[11px] font-mono text-muted-foreground">
                  {primitive.installCommand}
                </code>
                <button
                  onClick={handleCopy}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Copy install command"
                >
                  <Copy className="size-3" />
                </button>
                {copied && (
                  <span className="text-[9px] font-mono text-success">copied</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 flex-1">
                  <Copy className="size-3.5" />
                  Copy Markdown
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 border-border/60">
                  <Download className="size-3.5" />
                  .md
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="grid grid-cols-4 gap-3 flex-1">
              <ScoreBadge label="Quality" score={primitive.qualityScore} />
              <ScoreBadge label="Safety" score={primitive.safetyScore} />
              <ScoreBadge label="Efficiency" score={primitive.contextEfficiency} />
              <ScoreBadge label="Impact" score={primitive.agentImpact} />
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Token Budget</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {primitive.tokens.toLocaleString()}/{primitive.tokenBudget.toLocaleString()}
                </span>
              </div>
              <div className="token-bar w-32 h-1.5">
                <div
                  className={`token-bar-fill h-full ${
                    tokenPercent > 90 ? "bg-amber" : "bg-primary/50"
                  }`}
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <DemoDataBadge label="demo scores" />
            <span className="text-muted-foreground/70">
              prototype values — replaced by real Context CI output in v1
            </span>
          </p>
        </div>
      </div>

      {/* Export row */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Export as agent context</span>
            {isEnabled("multiAgentExport") ? (
              ["Claude Code", "Cursor Rules", "Codex / AGENTS.md", "v0", "Windsurf"].map(
                (target) => (
                  <Button
                    key={target}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-[11px] font-mono h-7 border-border/60"
                  >
                    <ArrowUpRight className="size-2.5" />
                    {target}
                  </Button>
                )
              )
            ) : (
              <PlannedBadge label="Planned · one-click export" />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex gap-0 overflow-x-auto" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`relative shrink-0 px-4 py-3 text-[13px] transition-colors ${
                  activeTab === tab
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-1/2 h-px w-6 -translate-x-1/2 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Purpose</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This primitive teaches an AI agent how to reason about {primitive.name.toLowerCase()}.
                  It provides structured decision rules, anti-patterns, and review checklists that
                  enforce expert-level output quality across all supported agents.
                </p>
              </Card>
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Core Principles</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Enforce measurable criteria over vague quality statements",
                    "Provide explicit decision rules with clear IF/THEN thresholds",
                    "Include anti-patterns with concrete examples and alternatives",
                    "Guide agent behavior with output format expectations",
                    "Declare confidence levels for each generated section",
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-3.5 shrink-0 text-success/70 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Anti-Patterns</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Using vague instructions like "make it world-class" without measurable criteria',
                    "Overloading a single primitive with too many cross-domain concerns",
                    "Missing expected agent behavior section or output format guidance",
                    "Including examples without explaining why they demonstrate the principle",
                  ].map((a) => (
                    <li key={a} className="flex items-start gap-2.5">
                      <AlertTriangle className="size-3.5 shrink-0 text-amber/70 mt-0.5" />
                      {a}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-success/70" />
                  Use When
                </h3>
                <ul className="space-y-2">
                  {primitive.useWhen.map((uw) => (
                    <li key={uw} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-success/50" />
                      {uw}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-destructive/70" />
                  Do Not Use When
                </h3>
                <ul className="space-y-2">
                  {primitive.doNotUseWhen.map((dnuw) => (
                    <li key={dnuw} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-destructive/50" />
                      {dnuw}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="border-border/40 bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary/70" />
                  Context Risk
                </h3>
                <Badge
                  variant="outline"
                  className={`font-mono text-[11px] ${
                    primitive.riskLevel === "low"
                      ? "border-success/20 text-success"
                      : primitive.riskLevel === "medium"
                        ? "border-amber/20 text-amber"
                        : "border-destructive/20 text-destructive"
                  }`}
                >
                  {primitive.riskLevel.charAt(0).toUpperCase() + primitive.riskLevel.slice(1)} Risk
                </Badge>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {primitive.riskLevel === "low"
                    ? "Safe for production use. No side-effects on agent behavior outside intended domain."
                    : primitive.riskLevel === "medium"
                      ? "May influence agent behavior in adjacent domains. Review scope before loading."
                      : "Significant behavioral changes. Test thoroughly before production deployment."}
                </p>
              </Card>
              {primitive.reviewerBadge && (
                <Card className="border-border/40 bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Hash className="size-3.5 text-primary/70" />
                    Reviewer
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {primitive.reviewerBadge.charAt(0)}
                    </div>
                    <span className="text-xs text-foreground/80">{primitive.reviewerBadge}</span>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === "Markdown" && (
          <Card className="border-border/40 bg-card p-0 overflow-hidden">
            <div className="border-b border-border/40 bg-secondary/20 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{primitive.fileName}</span>
                {hasRealMarkdown ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-success/25 bg-success/[0.06] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-success/85">
                    <span className="size-1 rounded-full bg-success/80" />
                    live content
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-amber/25 bg-amber/[0.06] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber/85">
                    <span className="size-1 rounded-full bg-amber/80" />
                    template fallback
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {hasRealMarkdown
                    ? `${markdownContent!.length.toLocaleString()} chars`
                    : `${primitive.tokens.toLocaleString()} tokens`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-6 px-2"
                  onClick={handleCopyMarkdown}
                  disabled={!hasRealMarkdown}
                >
                  <Copy className="size-3" />
                  {copiedMd ? "copied" : "Copy"}
                </Button>
              </div>
            </div>
            <pre className="p-5 text-[11px] font-mono text-muted-foreground leading-[1.7] overflow-x-auto whitespace-pre-wrap">
{hasRealMarkdown ? markdownContent : `---
name: ${primitive.slug}
version: ${primitive.version}
type: ${primitive.category.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}
domain: ${primitive.category.toLowerCase()}
author: ${primitive.author}
license: ${primitive.license}
tokens: ${primitive.tokens}
token_budget: ${primitive.tokenBudget}
content_digest: ${primitive.contentDigest}
signature: null  # ed25519 planned (Sigstore)
attestation: cci-v1
risk_level: ${primitive.riskLevel}
compatible_agents:
${primitive.compatibleAgents.map((a) => `  - ${a.toLowerCase().replace(/ /g, "-")}`).join("\n")}
use_when:
${primitive.useWhen.map((u) => `  - "${u}"`).join("\n")}
do_not_use_when:
${primitive.doNotUseWhen.map((d) => `  - "${d}"`).join("\n")}
---

# ${primitive.name} Primitive

## Purpose
This primitive teaches an AI agent how to reason about ${primitive.name.toLowerCase()}.
It provides structured decision rules, anti-patterns, and review checklists
that enforce expert-level output quality.

## Core Principles
- Enforce measurable criteria over vague quality statements
- Provide explicit decision rules with clear thresholds
- Include anti-patterns with concrete examples
- Guide agent behavior with output format expectations
- Declare confidence levels for each generated section

## Decision Rules
- IF the output lacks specific criteria THEN reject and request measurable standards
- IF anti-patterns are detected THEN flag with explanation and provide alternative
- IF output format deviates from expectations THEN guide to correct structure
- IF confidence is below 0.7 THEN declare uncertainty and request additional context
- IF token budget would be exceeded THEN prioritize highest-impact rules

## Anti-Patterns
- Using vague instructions without measurable criteria
- Overloading a single context with too many concerns
- Missing expected behavior specifications
- Including examples without explaining the underlying principle

## Review Checklist
- [ ] All principles have concrete, testable examples
- [ ] Decision rules have clear IF/THEN structure with thresholds
- [ ] Anti-patterns include alternatives, not just warnings
- [ ] Output format is specified with field-level expectations
- [ ] Token budget is within limits (current: ${primitive.tokens}/${primitive.tokenBudget})
- [ ] Risk level is accurately assessed and documented
- [ ] Content digest matches and Context CI attestation verified

## Agent Behavior Instructions
When this primitive is loaded, the agent should:
1. Apply all decision rules before generating output
2. Check output against anti-patterns list
3. Verify output format matches expectations
4. Report confidence level for each section
5. Respect token budget constraints
6. Log which rules were applied and which were skipped`}
            </pre>
            {!hasRealMarkdown && (
              <div className="border-t border-border/40 bg-secondary/10 px-4 py-2 flex items-center gap-2">
                <DemoDataBadge label="template content" />
                <span className="text-[10px] text-muted-foreground/70">
                  placeholder structure — domain-specific content lands in the next iteration
                </span>
              </div>
            )}
          </Card>
        )}

        {activeTab === "Validation" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DemoDataBadge label="demo run" />
              <span className="text-[10px] text-muted-foreground/70">
                illustrative pipeline output — real Context CI runs replace this when v1 ships
              </span>
            </div>
            {pipelineStages.map((stage, i) => (
              <PipelineStage key={stage.name} {...stage} index={i} />
            ))}
          </div>
        )}

        {activeTab === "Benchmark" && (
          <div className="space-y-6">
            <Card className="border-border/40 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Test Prompt</h3>
              <div className="rounded-md bg-secondary/30 border border-border/40 px-3 py-2.5">
                <p className="text-sm text-muted-foreground font-mono">
                  &quot;Design a premium profile screen for an emotional social app.&quot;
                </p>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-px md:grid-cols-2 rounded-xl border border-border/40 overflow-hidden bg-border/40">
              <div className="bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-destructive/80">
                    Without Primitive
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generic social profile with avatar, bio, followers count, and post grid.
                  Standard layout with no emotional consideration or unique interaction patterns.
                  No measurable quality criteria applied.
                </p>
              </div>
              <div className="bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-1.5 rounded-full bg-success" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-success/80">
                    With Primitive Loaded
                  </span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Ritual identity with emotional hierarchy, private aura signature, saved moments,
                  intentional interaction model, and non-addictive UX. Measurable engagement metrics
                  with consent-first data sharing. Decision rules applied: 12/14.
                </p>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <DemoDataBadge label="demo benchmark" />
                <span className="text-[10px] text-muted-foreground/70">
                  illustrative deltas, not measured against live agents
                </span>
              </div>
              {/* Demo-only — the badge above declares it, and the
                  visual weight here is intentionally muted so the
                  cells read as "illustrative methodology" not
                  "measured results." Loud success-green numbers
                  were a Principle 7 trap: the badge was present but
                  the claim's visual weight overwhelmed it. Tuned to
                  match what the disclaimer actually allows. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Specificity", value: "+42%", desc: "Measurable criteria in output" },
                  { label: "Design Originality", value: "+38%", desc: "Unique patterns generated" },
                  { label: "Anti-Pattern Reduction", value: "+51%", desc: "Known bad patterns avoided" },
                  { label: "Instruction Compliance", value: "+46%", desc: "Rules followed correctly" },
                ].map((metric) => (
                  <Card
                    key={metric.label}
                    className="border-border/40 bg-card p-4 text-center"
                    title="Demo data — not measured against live agents"
                  >
                    <p className="text-base font-mono text-muted-foreground tabular-nums">{metric.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-foreground/70 font-medium">
                      {metric.label}
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{metric.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Versions" && (
          <div className="space-y-3">
            {[
              { version: primitive.version, date: primitive.lastUpdated, note: "Current stable release. All 10 validation stages passed. Attested and published.", sig: primitive.contentDigest },
              { version: "0.9.0", date: "2026-04-01", note: "Beta release. Structure improvements, token optimization, and additional decision rules.", sig: "sha256:prev9c2d1e9b..." },
              { version: "0.5.0", date: "2026-03-01", note: "Initial draft. Schema validation passed. Pending human review and benchmark testing.", sig: "sha256:prev5a3f8c2d..." },
            ].map((v) => (
              <Card key={v.version} className="border-border/40 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-foreground">
                      v{v.version}
                    </span>
                    <span className="text-xs text-muted-foreground">{v.date}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{v.sig}</span>
                  </div>
                  {v.version === primitive.version && (
                    <Badge className="bg-success/[0.08] text-success border-success/20 text-[10px] font-mono">
                      latest
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{v.note}</p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "Reviews" && (
          <div className="space-y-3">
            {[
              { reviewer: "Marcus Webb", role: "Security Reviewer", badge: "security", date: "2026-05-18", comment: "All security checks pass. No prompt injection vectors detected. No encoded payloads. Approved for trusted release.", rating: "Approved" },
              { reviewer: "Sarah Chen", role: "Maintainer", badge: "maintainer", date: "2026-05-16", comment: "Strong primitive with clear decision rules. Suggested minor improvements to anti-pattern section and output format guidance. Changes incorporated in v1.2.0.", rating: "Approved" },
            ].map((review) => (
              <Card key={review.reviewer} className="border-border/40 bg-card p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {review.reviewer.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">{review.reviewer}</span>
                      <span className="ml-2 rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                        {review.role}
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-success/[0.08] text-success border-success/20 text-[10px] font-mono">
                    {review.rating.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                <p className="mt-2 text-[10px] text-muted-foreground/60">{review.date}</p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "Provenance" && (
          <div className="space-y-5">
            <Card className="border-border/40 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
                <Fingerprint className="size-3.5 text-primary/70" />
                Cryptographic Provenance Chain
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Every trusted primitive carries a SHA-256 content digest and a Context CI attestation
                record. Ed25519 signing via Sigstore is planned. The provenance chain establishes an
                immutable audit trail from authorship through validation to publication.
              </p>
              <div className="space-y-3">
                {[
                  { event: "Authored", timestamp: "2026-04-10T09:00:00Z", actor: primitive.author, detail: `Initial draft of ${primitive.fileName} submitted for review` },
                  { event: "Schema Validated", timestamp: "2026-04-10T09:01:00Z", actor: "Context CI", detail: "All 12 required frontmatter fields verified. Semver format confirmed." },
                  { event: "Safety Scanned", timestamp: "2026-04-10T09:02:00Z", actor: "Context CI", detail: "0 prompt injection vectors. 0 unsafe instructions. 0 PII leaks detected." },
                  { event: "Benchmarked", timestamp: "2026-04-12T14:00:00Z", actor: "Context CI", detail: "Tested across 5 agents x 3 prompts. All benchmark thresholds passed." },
                  { event: "Human Reviewed", timestamp: primitive.lastUpdated, actor: primitive.reviewerBadge || "Reviewer", detail: "Expert review completed. All decision rules verified. Approved for release." },
                  { event: "Attested & Published", timestamp: primitive.lastUpdated, actor: "PrimitiveHub Registry", detail: `Content digest ${primitive.contentDigest}. Sigstore keyless OIDC (Fulcio cert + Rekor entry). Published as v${primitive.version}. Immutable record stored.` },
                ].map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-mono font-semibold text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {i < 5 && <div className="w-px h-6 bg-border/40" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{entry.event}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/60">{entry.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        <span className="text-foreground/70">{entry.actor}</span> -- {entry.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-border/40 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Provenance Verification</h3>
              <div className="rounded-md bg-secondary/30 border border-border/40 px-3 py-2.5">
                <pre className="text-[11px] font-mono text-muted-foreground leading-[1.7]">
{`$ phub verify ${primitive.fileName}
Content Digest: ${primitive.contentDigest}
Digest Algo:    SHA-256
Signature:      Ed25519 (planned, via Sigstore)
Attestation:    cci-v1 — pass (10/10 stages)
Provenance:     PrimitiveHub Registry
Timestamp:      ${primitive.lastUpdated}T14:32:00Z
Status:         VERIFIED`}
                </pre>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "License" && (
          <div className="space-y-5">
            <Card className="border-border/40 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Scale className="size-3.5 text-primary/70" />
                License: {primitive.license}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                This primitive is distributed under the <strong className="text-foreground/80">{primitive.license}</strong> license.
                You are free to use, modify, and distribute this primitive in accordance with the license terms.
              </p>
              <div className="rounded-md bg-secondary/30 border border-border/40 px-3 py-2.5">
                <pre className="text-[11px] font-mono text-muted-foreground leading-[1.7] whitespace-pre-wrap">
{primitive.license === "MIT"
  ? `MIT License

Copyright (c) 2026 ${primitive.author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.`
  : primitive.license === "Apache-2.0"
    ? `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright (c) 2026 ${primitive.author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.`
    : `Creative Commons Attribution 4.0 International (CC BY 4.0)

Copyright (c) 2026 ${primitive.author}

You are free to:
- Share: copy and redistribute the material in any medium or format
- Adapt: remix, transform, and build upon the material for any purpose

Under the following terms:
- Attribution: You must give appropriate credit, provide a link to the
  license, and indicate if changes were made.

Full license: https://creativecommons.org/licenses/by/4.0/legalcode`}
                </pre>
              </div>
            </Card>
            <Card className="border-border/40 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">License Compatibility</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { allowed: true, label: "Commercial use" },
                  { allowed: true, label: "Modification" },
                  { allowed: true, label: "Distribution" },
                  { allowed: true, label: "Private use" },
                  { allowed: primitive.license !== "CC-BY-4.0", label: "Sublicensing" },
                  { allowed: false, label: "Liability warranty" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    {item.allowed ? (
                      <CheckCircle2 className="size-3 text-success/70" />
                    ) : (
                      <AlertTriangle className="size-3 text-amber/70" />
                    )}
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
