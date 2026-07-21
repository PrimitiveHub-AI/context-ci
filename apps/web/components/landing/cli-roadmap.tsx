import {
  Terminal,
  Eye,
  Download,
  Shield,
  Lock,
  Zap,
  Box,
  Layers,
  Github,
} from "lucide-react"

import { PlannedBadge } from "@/components/ui/planned-badge"
import { DemoDataBadge } from "@/components/primitives/demo-data-badge"
import {
  TerminalBlock,
  TerminalFrame,
  TerminalLine,
} from "@/components/landing/terminal-frame"
import { docRoute } from "@/lib/site"

/**
 * CLI section — rebuilt for the "between PrimitiveHub / skills.sh /
 * coolify.io" brief, per the maintainer's call-out that `/check`
 * and `phub` are the two highest-leverage product surfaces and were
 * undersold. The previous version laid out 5 equal terminal cards
 * in a 2-col grid; visually monotonous, no answer to "why phub vs
 * what I already do."
 *
 * New layout:
 *   Header — "Five commands. One active posture."
 *   Featured row (split):
 *     left  ~3/5  — big <phub audit> demo in a macOS-style terminal
 *     right ~2/5  — "Why phub" 4-card differentiator block
 *   Secondary row — 4 compact terminal cards for the other surfaces
 *     (phub.lock drift, phub watch, phub install, MCP gate)
 *   Footer — shipped-vs-gated honesty line (unchanged content,
 *           tighter rhythm)
 *
 * Each command card cites its ADR so a sceptic is one click from the
 * source of truth (unchanged from PR #9).
 */


const DIFFERENTIATORS = [
  {
    icon: Zap,
    title: "Active by default",
    one: "Walks the project + discovers every agent-context artefact. Linters wait for the file you remembered.",
  },
  {
    icon: Layers,
    title: "Same kernel as CI",
    one: "What passes locally passes on submit. No surprise verdicts at PR time.",
  },
  {
    icon: Shield,
    title: "Refuses by default",
    one: "Eight stable refusal codes. No warn-and-proceed. The agent never sees tampered bytes.",
  },
  {
    icon: Github,
    title: "Open-source kernel",
    one: "MIT, < 50 KB, zero runtime deps. Embeddable anywhere. The contract is public.",
  },
] as const

const SECONDARY_SURFACES = [
  {
    icon: Lock,
    title: "Drift detection",
    cmd: "phub audit --check-lock",
    adr: "ADR-0026",
    adrHref: docRoute("docs/decisions/0026-phub-lock-format-and-drift-detection.md"),
    lines: [
      { text: "▸ reading .primitivehub/phub.lock     20 pinned", intent: "muted" as const },
      { text: "▸ drift", intent: "default" as const },
      { text: "  ~ CLAUDE.md            modified (sha mismatch)", intent: "warn" as const },
      { text: "  + .claude/skills/new.md added", intent: "warn" as const },
      { text: "drift (2) · gate failed", intent: "fail" as const },
    ],
  },
  {
    icon: Eye,
    title: "On-access guard",
    cmd: "phub watch",
    adr: "ADR-0027",
    adrHref: docRoute("docs/decisions/0027-phub-watch.md"),
    lines: [
      { text: "▸ watching process.cwd()", intent: "muted" as const },
      { text: "[07:50:14] CREATED .cursor/rules/temp.md", intent: "default" as const },
      { text: "[07:50:14] SCANNED PASS · sha256:9e1b4a…", intent: "pass" as const },
      { text: "[07:50:31] MODIFIED CLAUDE.md", intent: "default" as const },
      { text: "[07:50:31] WARN CCI-005 quoted-trigger", intent: "warn" as const },
    ],
  },
  {
    icon: Download,
    title: "Safe install",
    cmd: "phub install strict-code-review@2.1.0",
    adr: "ADR-0028",
    adrHref: docRoute("docs/decisions/0028-phub-install.md"),
    lines: [
      { text: "▸ verifying bundle", intent: "muted" as const },
      { text: "  digest match           OK", intent: "pass" as const },
      { text: "  Sigstore (Fulcio+Rekor) OK", intent: "pass" as const },
      { text: "  Context CI predicate   pass", intent: "pass" as const },
      { text: "installed · 0.61s", intent: "accent" as const },
    ],
  },
  {
    icon: Box,
    title: "Runtime gate (MCP)",
    cmd: "claude mcp add primitivehub",
    adr: "ADR-0029",
    adrHref: docRoute("docs/decisions/0029-mcp-runtime-gate.md"),
    lines: [
      { text: "tool: verify_before_load", intent: "muted" as const },
      { text: "request  { subject: skill:foo@0.3 }", intent: "default" as const },
      { text: "verdict  { ok: false,", intent: "default" as const },
      { text: "           code: LOCK_DRIFT }", intent: "fail" as const },
      { text: "refused · agent receives no bytes", intent: "accent" as const },
    ],
  },
] as const

export function CLIRoadmap() {
  return (
    <section className="relative border-b border-border/40 overflow-hidden">
      {/* Section-specific gradient backdrop for visual differentiation */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.78_0.14_195/0.06)_0%,transparent_60%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-6 lg:py-24">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1 mb-4">
            <Terminal className="size-3 text-primary/80" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Active by default · a guardian, not a linter
            </span>
          </div>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl text-balance">
            Five commands. One active posture.
          </h2>
          <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            A linter waits for the operator to point it at a known file. A
            guardian sits with the project and finds the unknown ones.{" "}
            <code className="font-mono text-foreground/85">phub</code>{" "}
            ships the five active surfaces and runs the same Context CI
            kernel the scoreboard measures. Source published today; the
            npm publish flips on launch day per{" "}
            <a
              href={docRoute("docs/decisions/0022-publishing-deferred-to-launch.md")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/90 hover:text-primary underline decoration-primary/30 underline-offset-2"
            >
              ADR-0022
            </a>
            .
          </p>
        </div>

        {/* Featured row — phub audit demo + why-phub differentiators */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch mb-8">
          {/* Featured terminal — phub audit */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
                01 · Active sweep
              </span>
              <a
                href={docRoute("docs/decisions/0025-active-posture-and-phub-audit.md")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                ADR-0025
              </a>
              <DemoDataBadge
                label="example output"
                title="Illustrative phub audit run — representative output, not a live scan."
                className="ml-auto"
              />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              <code className="font-mono">phub audit</code> — find what you didn&rsquo;t know to scan.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Walks the project. Classifies every agent-context artefact.
              Digests it (SHA-256). Runs the Top 10 detector roster.
              Reuses the scanner kernel, so what passes here passes in
              CI byte-for-byte.
            </p>
            <TerminalFrame title="$ phub audit" tone="cyan" className="flex-1">
              <TerminalBlock>
                <TerminalLine intent="prompt">$ phub audit</TerminalLine>
                <TerminalLine intent="muted">{"▸ walking process.cwd()                  scanned 47 files"}</TerminalLine>
                <TerminalLine intent="muted">{"▸ classified                              12 agent-context artefacts"}</TerminalLine>
                <TerminalLine intent="muted">{"▸ digesting + scanning                    Top 10 (CCI-001..010)"}</TerminalLine>
                <TerminalLine>{"  CLAUDE.md                               "}<span className="text-success/90">PASS</span>{"  sha256:8f3d2c…"}</TerminalLine>
                <TerminalLine>{"  AGENTS.md                               "}<span className="text-success/90">PASS</span>{"  sha256:b71ea0…"}</TerminalLine>
                <TerminalLine>{"  .cursor/rules/security.md               "}<span className="text-amber/90">WARN</span>{"  CCI-008 (1 finding)"}</TerminalLine>
                <TerminalLine>{"  .claude/skills/setup.md                 "}<span className="text-destructive/90">FAIL</span>{"  CCI-005 (curl|bash)"}</TerminalLine>
                <TerminalLine>{"  README.md                               "}<span className="text-success/90">PASS</span>{"  sha256:fa20cd…"}</TerminalLine>
                <TerminalLine intent="accent">
                  {"12 artefacts · 1 FAIL · 1 WARN · 10 PASS · 0.84s"}
                </TerminalLine>
                <TerminalLine intent="muted">{"   write report? phub audit --sarif > findings.sarif"}</TerminalLine>
              </TerminalBlock>
            </TerminalFrame>
          </div>

          {/* Why phub — 4-card differentiator block */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
                Why phub
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Four things AGENT-context tooling forgets.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              The kernel is the moat. Each guarantee is a posture
              choice we ship, not a policy we suggest.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {DIFFERENTIATORS.map((d) => {
                const Icon = d.icon
                return (
                  <div
                    key={d.title}
                    className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 hover:border-primary/30 hover:bg-card/80 transition-colors flex flex-col"
                  >
                    <div className="flex size-8 items-center justify-center rounded-md bg-primary/[0.08] text-primary mb-3">
                      <Icon className="size-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1.5">
                      {d.title}
                    </h4>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground flex-1">
                      {d.one}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Secondary commands row — 4 compact terminal cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECONDARY_SURFACES.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.cmd} className="flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3 text-primary/70 shrink-0" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/80 truncate">
                      {String(i + 2).padStart(2, "0")} · {s.title}
                    </span>
                  </div>
                  <a
                    href={s.adrHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 hover:text-primary"
                  >
                    {s.adr}
                  </a>
                </div>
                <TerminalFrame title={s.cmd} tone="cyan" className="flex-1">
                  <TerminalBlock className="py-2.5">
                    <TerminalLine intent="prompt" className="text-[11px]">{"$ "}{s.cmd}</TerminalLine>
                    {s.lines.map((line, j) => (
                      <TerminalLine key={j} intent={line.intent} className="text-[11px]">
                        {line.text}
                      </TerminalLine>
                    ))}
                  </TerminalBlock>
                </TerminalFrame>
              </div>
            )
          })}
        </div>

        {/* Honest footer — shipped vs gated */}
        <div className="mt-10 mx-auto max-w-3xl flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground/85">
            phub audit · phub.lock · phub watch · phub install · MCP gate
          </span>
          <span className="text-muted-foreground/40">shipped to monorepo</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-2">
            <PlannedBadge label="ADR-0022 gated" />
            <span>phub publish + npm package goes live on launch day</span>
          </span>
        </div>
      </div>
    </section>
  )
}
