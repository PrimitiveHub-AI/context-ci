"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

const sampleMarkdown = `---
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
3. Report confidence level for each section`

const lintWarnings = [
  {
    type: "error" as const,
    line: 29,
    message: "Instruction is vague: \"Describe what this primitive teaches\" — add measurable criteria and expected outcomes.",
  },
  {
    type: "error" as const,
    line: 33,
    message: "Core Principles lack concrete examples. Each principle must include at least one testable example.",
  },
  {
    type: "warning" as const,
    line: 0,
    message: "No \"Expected Output Format\" section found. Agents need explicit format guidance for consistent outputs.",
  },
  {
    type: "warning" as const,
    line: 0,
    message: "No \"Examples\" section found. Real-world examples significantly improve primitive effectiveness.",
  },
  {
    type: "info" as const,
    line: 0,
    message: "Token count will be calculated after content is finalized. Current estimate: ~420 tokens.",
  },
]

const sectionChecklist = [
  { name: "YAML Frontmatter", present: true, required: true },
  { name: "Purpose", present: true, required: true },
  { name: "Core Principles", present: true, required: true },
  { name: "Decision Rules", present: true, required: true },
  { name: "Anti-Patterns", present: true, required: true },
  { name: "Review Checklist", present: true, required: true },
  { name: "Agent Behavior", present: true, required: true },
  { name: "Use When / Do Not Use", present: true, required: true },
  { name: "Expected Output Format", present: false, required: false },
  { name: "Examples", present: false, required: false },
  { name: "References", present: false, required: false },
]

export default function WorkbenchPage() {
  const [content, setContent] = useState(sampleMarkdown)

  const tokenEstimate = Math.round(content.length / 4)
  const tokenBudget = 4000
  const tokenPercent = Math.min(100, Math.round((tokenEstimate / tokenBudget) * 100))
  const lineCount = content.split("\n").length
  const errors = lintWarnings.filter((w) => w.type === "error").length
  const warnings = lintWarnings.filter((w) => w.type === "warning").length
  const requiredSections = sectionChecklist.filter((s) => s.required)
  const requiredPresent = requiredSections.filter((s) => s.present).length

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-1">
                Primitive Workbench
              </p>
              <h1 className="text-xl font-bold text-foreground">Primitive Authoring Environment</h1>
              <p className="mt-1 text-xs text-muted-foreground max-w-lg">
                An engineering environment for creating, linting, testing, validating, and
                publishing AI Context Primitives. Author with structure. Ship with confidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-8">
                <Play className="size-3" />
                Run Validation
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 border-border/60">
                <FlaskConical className="size-3" />
                Test Primitive
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 border-border/60">
                <Upload className="size-3" />
                Submit to Registry
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 border-border/60">
                <Download className="size-3" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 border-border/60">
                <Save className="size-3" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-2.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Name</span>
              <Input className="h-6 w-36 bg-secondary/30 border-border/40 text-[11px] font-mono px-2" defaultValue="my-new-primitive" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Category</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground cursor-pointer hover:border-border h-5">
                Software Engineering
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Risk</span>
              <Badge variant="outline" className="text-[10px] border-success/20 text-success cursor-pointer h-5 gap-1">
                <Shield className="size-2" />
                Low
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">License</span>
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground cursor-pointer hover:border-border h-5">
                MIT
              </Badge>
            </div>

            {/* Token budget */}
            <div className="flex items-center gap-2 ml-auto">
              <Gauge className="size-3 text-muted-foreground" />
              <div className="token-bar w-20 h-1.5">
                <div
                  className={`token-bar-fill h-full ${
                    tokenPercent > 90 ? "bg-amber" : "bg-primary/50"
                  }`}
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                ~{tokenEstimate.toLocaleString()}/{tokenBudget.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-1.5 lg:px-6">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <XCircle className="size-2.5 text-destructive" />
              {errors} errors
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-2.5 text-amber" />
              {warnings} warnings
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-2.5 text-success" />
              {requiredPresent}/{requiredSections.length} required sections
            </span>
            <span className="ml-auto font-mono">{lineCount} lines</span>
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
                  <span className="text-[11px] font-mono text-muted-foreground">editor</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">
                  markdown
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[560px] resize-none bg-transparent p-4 text-[11px] font-mono text-foreground/90 leading-[1.7] focus:outline-none placeholder:text-muted-foreground"
                spellCheck={false}
              />
            </Card>
          </div>

          {/* Right panels */}
          <div className="lg:col-span-5 space-y-4">
            {/* Section checklist */}
            <Card className="border-border/40 bg-card p-4">
              <h3 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="size-3 text-success/70" />
                Sections
              </h3>
              <div className="space-y-1.5">
                {sectionChecklist.map((section) => (
                  <div key={section.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {section.present ? (
                        <CheckCircle2 className="size-3 text-success/70" />
                      ) : (
                        <AlertTriangle className="size-3 text-amber/70" />
                      )}
                      <span className={`text-[11px] ${section.present ? "text-muted-foreground" : "text-amber/80"}`}>
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

            {/* Lint output */}
            <Card className="border-border/40 bg-card p-4">
              <h3 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="size-3 text-amber/70" />
                Lint Output
              </h3>
              <div className="space-y-2">
                {lintWarnings.map((warning, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] ${
                      warning.type === "error"
                        ? "bg-destructive/[0.04] border border-destructive/15"
                        : warning.type === "warning"
                          ? "bg-amber/[0.04] border border-amber/15"
                          : "bg-primary/[0.03] border border-primary/10"
                    }`}
                  >
                    {warning.type === "error" ? (
                      <XCircle className="size-3 shrink-0 text-destructive mt-0.5" />
                    ) : warning.type === "warning" ? (
                      <AlertTriangle className="size-3 shrink-0 text-amber mt-0.5" />
                    ) : (
                      <Info className="size-3 shrink-0 text-primary mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground leading-relaxed">{warning.message}</span>
                      {warning.line > 0 && (
                        <span className="ml-1.5 text-[9px] font-mono text-muted-foreground/50">
                          L{warning.line}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Compatibility selector */}
            <Card className="border-border/40 bg-card p-4">
              <h3 className="text-[11px] font-semibold text-foreground mb-3 uppercase tracking-wider">
                Target Agents
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {["Claude Code", "Cursor", "Codex", "Copilot", "v0", "Windsurf"].map((agent) => (
                  <Badge
                    key={agent}
                    variant="outline"
                    className="cursor-pointer text-[10px] font-mono border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                  >
                    {agent}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
