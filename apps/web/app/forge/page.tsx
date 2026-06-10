"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MarkdownEditor } from "@/components/forge/markdown-editor"
import { lintFrontmatter } from "@/lib/forge/codemirror-linter"
import { lintForgeContent } from "@/lib/forge/lint"
import { analyzeSections, estimateTokens, countLines, extractFrontmatter } from "@/lib/forge/parse"
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
                  className="gap-1.5 h-8 border-border/60 opacity-60 cursor-not-allowed"
                  disabled
                  title="Planned — agent-behavior test harness lands in Phase 5.6"
                >
                  <FlaskConical className="size-3" />
                  Test Primitive
                </Button>

                {/* Planned — registry submission. Pre-launch posture
                    gates the submit pipeline until ADR-0022 flips. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 border-border/60 opacity-60 cursor-not-allowed"
                  disabled
                  title="Planned — submission opens when the registry launches (ADR-0022)"
                >
                  <Upload className="size-3" />
                  Submit to Registry
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
                  className="gap-1.5 h-8 border-border/60 opacity-60 cursor-not-allowed"
                  disabled
                  title="Planned — persistent drafts arrive with the post-launch account model"
                >
                  <Save className="size-3" />
                  Save
                </Button>
              </div>

              {/* Honesty footnote — 3 of 5 actions are scoped but
                  not yet live. We say so on the surface instead of
                  hiding it in a tooltip. */}
              <p className="text-[10px] font-mono text-muted-foreground/70 flex items-center gap-1.5">
                <PlannedBadge label="3 of 5 planned" />
                Test, Submit, Save scoped — Run Validation + Export live now.
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
                className="h-6 w-44 bg-secondary/30 border-border/40 text-[11px] font-mono px-2"
                value={analysis.fmName}
                readOnly
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Type</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground h-5">
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
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground h-5">
                {analysis.fmLicense}
              </Badge>
            </div>

            {/* Token budget — live */}
            <div className="flex items-center gap-2 ml-auto">
              <Gauge className="size-3 text-muted-foreground" />
              <div className="token-bar w-24 h-1.5">
                <div
                  className={`token-bar-fill h-full ${
                    tokenPercent > 90 ? "bg-amber" : "bg-primary/50"
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
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
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
              <div className="border-b border-border/40 bg-secondary/20 px-4 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-3 text-primary/60" />
                  <span className="text-[11px] font-mono text-muted-foreground">editor.md</span>
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
            {/* Sections — live */}
            <Card className="border-border/40 bg-card p-4">
              <h3 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="size-3 text-success/70" />
                Sections
              </h3>
              <div className="space-y-1.5">
                {allSections.map((section) => (
                  <div key={section.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {section.present ? (
                        <CheckCircle2 className="size-3 text-success/70" />
                      ) : section.required ? (
                        <AlertTriangle className="size-3 text-destructive/70" />
                      ) : (
                        <Info className="size-3 text-muted-foreground/70" />
                      )}
                      <span
                        className={`text-[11px] ${
                          section.present
                            ? "text-muted-foreground"
                            : section.required
                              ? "text-destructive/80"
                              : "text-muted-foreground/70"
                        }`}
                      >
                        {section.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/60">
                      {section.required ? "required" : "optional"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Lint output — live from the same linter as the editor
                squiggles. The `id` is the scroll target for the
                "Run Validation" header button; the panel itself runs
                the linter on every keystroke. */}
            <Card id="forge-lint-output" className="scroll-mt-24 border-border/40 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="size-3 text-amber/70" />
                  Lint Output
                </h3>
                <span className="text-[9px] font-mono text-muted-foreground/70">
                  {analysis.findings.length} finding{analysis.findings.length === 1 ? "" : "s"}
                </span>
              </div>
              {analysis.findings.length === 0 ? (
                <div className="rounded-md bg-success/[0.04] border border-success/15 px-2.5 py-3 text-center">
                  <CheckCircle2 className="inline size-3.5 text-success/70 mr-1.5 mb-0.5" />
                  <span className="text-[11px] text-muted-foreground">
                    No findings — primitive conforms to Spec v0.1.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {analysis.findings.map((finding, i) => (
                    <div
                      key={`${finding.code}-${i}`}
                      className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] ${
                        finding.severity === "error"
                          ? "bg-destructive/[0.04] border border-destructive/15"
                          : finding.severity === "warning"
                            ? "bg-amber/[0.04] border border-amber/15"
                            : "bg-primary/[0.03] border border-primary/10"
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
                        <p className="text-muted-foreground leading-relaxed">{finding.message}</p>
                        <p className="mt-1 flex items-center gap-2 text-[9px] font-mono text-muted-foreground/60">
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
              )}
            </Card>

            {/* Target agents — declarative chips, not filters. The
                `compatible_agents` frontmatter field is the source of
                truth; these chips reflect it. Removed cursor-pointer
                and hover-color affordances that suggested clickable
                filtering (false-affordance fix). */}
            <Card className="border-border/40 bg-card p-4">
              <h3 className="text-[11px] font-semibold text-foreground mb-3 uppercase tracking-wider">
                Target Agents
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {["Claude Code", "Cursor", "Codex", "Copilot", "v0", "Windsurf"].map((agent) => (
                  <Badge
                    key={agent}
                    variant="outline"
                    className="text-[10px] font-mono border-border/40 text-muted-foreground"
                  >
                    {agent}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                Declared in <code className="font-mono text-foreground/80">compatible_agents</code> frontmatter.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
