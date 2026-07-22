"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MarkdownEditor } from "@/components/forge/markdown-editor"
import { lintFrontmatter } from "@/lib/forge/codemirror-linter"
import { lintForgeContent } from "@/lib/forge/lint"
import { analyzeSections, estimateTokens, countLines, extractFrontmatter, setFrontmatterName } from "@/lib/forge/parse"
import { linter } from "@codemirror/lint"
import {
  Play,
  FlaskConical,
  Upload,
  Save,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Gauge,
  XCircle,
  Shield,
} from "lucide-react"

import { PlannedBadge } from "@/components/ui/planned-badge"
import { TrustReadinessPanel } from "@/components/forge/trust-readiness-panel"
import { ForgeSidePanel } from "@/components/forge/forge-side-panel"

const TARGET_AGENTS = ["Claude Code", "Cursor", "Codex", "Copilot", "v0", "Windsurf"] as const

const sampleMarkdown = `---
spec_version: "0.1"
name: my-new-primitive
version: 0.1.0
type: engineering
domain: software
author: Your Name
license: MIT
tokens: 0
token_budget: 4000
risk_level: low
compatible_agents:
  - claude-code
  - cursor
use_when:
  - "Building production applications"
  - "Reviewing pull requests"
do_not_use_when:
  - "Rapid prototyping"
  - "Exploratory coding"
---

# My New Primitive

## Purpose
Describe what this primitive teaches AI agents to do.
Include measurable criteria for success.

## Core Principles
- Principle 1: Description with concrete example
- Principle 2: Description with concrete example

## Decision Rules
- IF the output lacks specific criteria THEN reject and request measurable standards
- IF anti-patterns are detected THEN flag with explanation and provide alternative

## Anti-Patterns
- Anti-pattern 1: Why it is harmful + what to do instead
- Anti-pattern 2: Why it is harmful + what to do instead

## Review Checklist
- [ ] All principles have concrete examples
- [ ] Decision rules have clear IF/THEN structure
- [ ] Anti-patterns include alternatives

## Agent Behavior Instructions
When loaded, the agent should:
1. Apply all decision rules before generating output
2. Check output against anti-patterns
3. Report confidence level for each section
`

export default function ForgePage() {
  const [content, setContent] = useState(sampleMarkdown)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Restore a locally-saved draft on first mount. localStorage is the real
  // backing store for "Save" in v1 — no account needed; a server-side draft
  // model is the post-launch upgrade.
  useEffect(() => {
    try {
      const draft = window.localStorage.getItem("forge:draft")
      if (draft) setContent(draft)
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [])

  const handleSaveDraft = () => {
    try {
      window.localStorage.setItem("forge:draft", content)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2000)
    } catch {
      /* localStorage unavailable — ignore */
    }
  }

  // Live analysis — recomputed on every keystroke (cheap; ~100µs for typical primitives).
  const analysis = useMemo(() => {
    const fm = extractFrontmatter(content)
    const sections = analyzeSections(fm.ok ? fm.body : content)
    const findings = lintForgeContent(content)
    const tokens = estimateTokens(content)
    return {
      tokens,
      lineCount: countLines(content),
      sections,
      findings,
      errors: findings.filter((f) => f.severity === "error").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
      infos: findings.filter((f) => f.severity === "info").length,
      // Pull live frontmatter for the metadata bar
      fmName: fm.ok && typeof fm.data.name === "string" ? fm.data.name : "—",
      fmType: fm.ok && typeof fm.data.type === "string" ? fm.data.type : "—",
      fmRisk: fm.ok && typeof fm.data.risk_level === "string" ? fm.data.risk_level : "—",
      fmLicense: fm.ok && typeof fm.data.license === "string" ? fm.data.license : "—",
      fmBudget: fm.ok && typeof fm.data.token_budget === "number" ? fm.data.token_budget : 4000,
    }
  }, [content])

  const tokenPercent = Math.min(
    100,
    Math.round((analysis.tokens / analysis.fmBudget) * 100),
  )

  // CodeMirror extensions: the linter + a few options. Memoized so the editor
  // doesn't re-init on every render.
  const editorExtensions = useMemo(
    () => [linter(lintFrontmatter, { delay: 250 })],
    [],
  )

  const allSections = [
    { name: "YAML Frontmatter", present: extractFrontmatter(content).ok, required: true },
    ...analysis.sections.required.map((s) => ({ ...s })),
    ...analysis.sections.recommended.map((s) => ({ ...s })),
  ]
  const requiredAll = allSections.filter((s) => s.required)
  const requiredPresent = requiredAll.filter((s) => s.present).length

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-1">
                Primitive Forge
              </p>
              <h1 className="text-xl font-bold text-foreground">Primitive Authoring Environment</h1>
              <p className="mt-1 text-xs text-muted-foreground max-w-lg">
                IDE-grade authoring for AI Context Primitives. CodeMirror editor with live spec
                validation, inline lint, and section discovery — calibrated to Primitive Spec v0.1.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap gap-2">
                {/* Functional — scrolls to the live lint panel. The
                    panel itself runs the linter on every keystroke;
                    this button is the deliberate "show me the
                    findings now" affordance. */}
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-8"
                  onClick={() => {
                    document.getElementById("forge-lint-output")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }}
                >
                  <Play className="size-3" />
                  Run Validation
                </Button>

                {/* Planned — agent-behavior test harness against the
                    primitive. Phase 5.6 work per execution-plan. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 border-border/70 border-dashed text-muted-foreground disabled:opacity-100 cursor-not-allowed"
                  disabled
                  title="Planned — agent-behavior test harness lands in Phase 5.6"
                >
                  <FlaskConical className="size-3" />
                  Test Primitive
                  <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground">soon</span>
                </Button>

                {/* Planned — registry submission. Pre-launch posture
                    gates the submit pipeline until ADR-0022 flips. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 border-border/70 border-dashed text-muted-foreground disabled:opacity-100 cursor-not-allowed"
                  disabled
                  title="Planned — submission opens when the registry launches (ADR-0022)"
                >
                  <Upload className="size-3" />
                  Submit to Registry
                  <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground">soon</span>
                </Button>

                {/* Functional — downloads the current editor buffer
                    as <name>.md. Frontmatter `name` determines the
                    filename; falls back to `primitive.md`. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 border-border/60"
                  onClick={() => {
                    const filename =
                      typeof analysis.fmName === "string" && analysis.fmName !== "—"
                        ? `${analysis.fmName}.md`
                        : "primitive.md"
                    const blob = new Blob([content], { type: "text/markdown" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = filename
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="size-3" />
                  Export
                </Button>

                {/* Planned — persistent draft store. Requires a
                    per-user draft model; deferred until accounts are
                    live post-launch. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 border-border/60"
                  onClick={handleSaveDraft}
                  title="Save a local draft to this browser (no account needed)"
                >
                  <Save className="size-3" />
                  {savedAt ? "Saved" : "Save"}
                </Button>
              </div>

              {/* Honesty footnote — 2 of 5 actions are scoped but
                  not yet live (Save became a live local-draft action).
                  We say so on the surface instead of hiding it. */}
              <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <PlannedBadge label="2 planned" />
                Live now: Run Validation, Export, Save · dashed “soon” = planned.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata bar — derived live from the frontmatter */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-2.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Name</span>
              <Input
                className="h-6 w-52 bg-secondary/40 border-border/60 text-[11px] font-mono text-foreground px-2"
                value={analysis.fmName === "—" ? "" : analysis.fmName}
                onChange={(e) => setContent(setFrontmatterName(content, e.target.value))}
                placeholder="my-new-primitive"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Primitive name — writes to the frontmatter name field"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Type</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-foreground/80 h-5">
                {analysis.fmType}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Risk</span>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 gap-1 font-mono ${
                  analysis.fmRisk === "low"
                    ? "border-success/20 text-success"
                    : analysis.fmRisk === "medium"
                      ? "border-amber/20 text-amber"
                      : analysis.fmRisk === "high"
                        ? "border-destructive/20 text-destructive"
                        : "border-border/40 text-muted-foreground"
                }`}
              >
                <Shield className="size-2" />
                {analysis.fmRisk}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">License</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-foreground/80 h-5">
                {analysis.fmLicense}
              </Badge>
            </div>

            {/* Token budget — live */}
            <div className="flex items-center gap-2 ml-auto">
              <Gauge className="size-3 text-muted-foreground" />
              <div className="token-bar w-24 h-1.5">
                <div
                  className={`token-bar-fill h-full ${
                    tokenPercent > 90 ? "bg-amber" : "bg-primary/70"
                  }`}
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                ~{analysis.tokens.toLocaleString()}/{analysis.fmBudget.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar — live counts */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-1.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <XCircle className="size-2.5 text-destructive" />
              <span className="tabular-nums">{analysis.errors}</span> errors
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-2.5 text-amber" />
              <span className="tabular-nums">{analysis.warnings}</span> warnings
            </span>
            <span className="flex items-center gap-1">
              <Info className="size-2.5 text-primary" />
              <span className="tabular-nums">{analysis.infos}</span> info
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-2.5 text-success" />
              <span className="tabular-nums">{requiredPresent}</span>/{requiredAll.length} required sections
            </span>
            <span className="ml-auto font-mono tabular-nums">{analysis.lineCount} lines</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Editor */}
          <div className="lg:col-span-7">
            <Card className="border-border/40 bg-card overflow-hidden">
              <div className="border-b border-border/40 bg-secondary/40 px-4 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-3 text-primary/80" />
                  <span className="text-[11px] font-mono text-foreground/90">
                    {analysis.fmName !== "—" ? `${analysis.fmName}.md` : "primitive.md"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                  <span>spec v0.1</span>
                  <span className="text-border">|</span>
                  <span>markdown</span>
                </div>
              </div>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                extensions={editorExtensions}
                className="min-h-[640px]"
              />
            </Card>
          </div>

          {/* Right panels */}
          <div className="lg:col-span-5 space-y-4">
            {/* Trust Readiness — Reviewer B's security-aware IDE
                block. Sits at the top because "will this pass
                enterprise CI?" is the question an author asks
                BEFORE they look at the section checklist or the
                lint findings. Every signal here is already
                computed on every keystroke by the parent useMemo;
                this component is presentational. */}
            <TrustReadinessPanel
              errors={analysis.errors}
              warnings={analysis.warnings}
              infos={analysis.infos}
              requiredPresent={requiredPresent}
              requiredTotal={requiredAll.length}
              tokens={analysis.tokens}
              fmBudget={analysis.fmBudget}
              fmRisk={analysis.fmRisk}
              frontmatterOk={extractFrontmatter(content).ok}
            />

            {/* Consolidated inspector — three tabs (Sections / Lint /
                Agents) replace the three separate cards that used to
                stack below the Trust Readiness panel. One card, three
                views. Editor recovers the vertical space. The id stays
                on the outer card so the "Run Validation" header button
                still scrolls to the right place. */}
            <ForgeSidePanel
              sections={allSections}
              findings={analysis.findings}
              agents={[...TARGET_AGENTS]}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
