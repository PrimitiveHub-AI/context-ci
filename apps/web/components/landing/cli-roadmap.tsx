import { Terminal, FileSearch, Lock, Eye, Download, Shield } from "lucide-react"

import { PlannedBadge } from "@/components/ui/planned-badge"

/**
 * CLI section — the five active-posture surfaces locked in ADR-0025.
 *
 * Pre-this-PR: a 3-command "planned for v1" panel showing
 * registry-flavored validate / publish / install workflows. Both
 * the audit and the expert reviews flagged this as an underclaim:
 * the active-posture five have all shipped per gates G-C.1 (Samurai
 * Cut, ADR-0025) and G-C.2 (lock / watch / install / runtime gate,
 * ADRs 0026 / 0027 / 0028 / 0029). The framing now matches reality.
 *
 * Discipline: each card cites its ADR so a reader who suspects we
 * are overclaiming can verify in one click. The shipped surfaces
 * are the active ones; the publish path is the only piece still
 * gated (ADR-0022 three-lock, launch-day flip).
 *
 * Design: 5 cards in a stack (single column for narrow viewports,
 * two columns from md upward). Each card carries the command,
 * a one-line description, an ADR reference, and a realistic
 * terminal output snippet derived from the shipped behavior.
 */

const GH_BLOB = "https://github.com/DevXYZx/primitivehub/blob/main"

interface SurfaceCard {
  icon: typeof Terminal
  cmd: string
  label: string
  description: string
  adr: { id: string; href: string }
  output: string
}

const SURFACES: readonly SurfaceCard[] = [
  {
    icon: FileSearch,
    cmd: "phub audit",
    label: "Active sweep",
    description:
      "Walks the project. Discovers every agent-context artifact, classifies it, digests it (SHA-256), runs the Top 10 detector roster. The Samurai Cut — the surface that turns the contract from \"verifier on demand\" into \"guardian by default.\"",
    adr: {
      id: "ADR-0025",
      href: `${GH_BLOB}/docs/decisions/0025-active-posture-and-phub-audit.md`,
    },
    output: `▸ walking process.cwd()                  scanned 47 files
▸ classified                              12 agent-context artifacts
▸ digesting + scanning                    Top 10 (CCI-001..010)
  CLAUDE.md                               PASS · sha256:8f3d2c…
  AGENTS.md                               PASS · sha256:b71ea0…
  .cursor/rules/security.md               WARN · CCI-008 (1 finding)
  .claude/skills/setup.md                 PASS · sha256:3c8f91…
  README.md                               PASS · sha256:fa20cd…
12 artifacts · 0 FAIL · 1 WARN · 0.84s    write report? phub audit --sarif`,
  },
  {
    icon: Lock,
    cmd: "phub audit --check-lock",
    label: "Drift detection",
    description:
      "Compares the current tree against the committed `.primitivehub/phub.lock`. Reports added / modified / removed / reclassified artifacts. Reproducibility is unit-tested — byte-identical re-stamps.",
    adr: {
      id: "ADR-0026",
      href: `${GH_BLOB}/docs/decisions/0026-phub-lock-format-and-drift-detection.md`,
    },
    output: `▸ reading .primitivehub/phub.lock         20 artifacts pinned
▸ re-stamping current tree                12 artifacts walked
▸ drift report
  +  .claude/skills/new-helper.md         added (claude-skill)
  ~  CLAUDE.md                            modified (sha mismatch)
  =  AGENTS.md, README.md, .cursorrules   unchanged
drift detected (2) · gate failed · update with --update-lock`,
  },
  {
    icon: Eye,
    cmd: "phub watch",
    label: "On-access guard",
    description:
      "Filesystem daemon. Per-path debounce. NDJSON event stream. Reuses `runAudit` so behavior is provably identical. The AV product-family on-access-guard slot.",
    adr: {
      id: "ADR-0027",
      href: `${GH_BLOB}/docs/decisions/0027-phub-watch.md`,
    },
    output: `▸ watching process.cwd() (recursive, .git skipped)
[2026-06-10T07:50:14] CREATED .cursor/rules/temp.md
[2026-06-10T07:50:14] SCANNED .cursor/rules/temp.md PASS · sha256:9e1b4a…
[2026-06-10T07:50:31] MODIFIED CLAUDE.md
[2026-06-10T07:50:31] SCANNED CLAUDE.md WARN · CCI-005 quoted-trigger
[2026-06-10T07:50:31] EMITTED quarantine-marker (documentary, v0.1)`,
  },
  {
    icon: Download,
    cmd: "phub install strict-code-review@2.1.0",
    label: "Safe install",
    description:
      "Pre-verifies before write. Classify → fetch → JSON.parse → verifyBundle → writer safety rules → write → lock update. Stable refusal codes. Replaces the `npx ... | bash` attack class operationally.",
    adr: {
      id: "ADR-0028",
      href: `${GH_BLOB}/docs/decisions/0028-phub-install.md`,
    },
    output: `▸ resolving strict-code-review@2.1.0      registry · v2.1.0
▸ fetching bundle                         3,840 bytes
▸ verifying bundle
   digest match                           sha256:b7e4f1a9c…  OK
   Sigstore (Fulcio cert + Rekor entry)   inclusion proof   OK
   Context CI attestation predicate       cci-v0.1 · pass   OK
▸ writer safety check                     no symlinks · in-tree
▸ installing                              ~/.config/agents/primitives/
▸ updating .primitivehub/phub.lock        +1 artifact (registry:*)
installed strict-code-review@2.1.0 · 0.61s`,
  },
  {
    icon: Shield,
    cmd: "claude mcp add primitivehub",
    label: "Runtime gate (MCP)",
    description:
      "MCP server exposes `verify_before_load` — composite tool combining `check_lock` + scanner + optional `verify_bundle`. 8 stable refusal codes. Every trust decision delegated to `@primitivehub/phub`; zero custom logic in the MCP layer.",
    adr: {
      id: "ADR-0029",
      href: `${GH_BLOB}/docs/decisions/0029-mcp-runtime-gate.md`,
    },
    output: `[mcp ⇄ primitivehub] tool: verify_before_load
  request   { "subject": "skill:foo@0.3.0", "mode": "lock+scan" }
  resolved  digest sha256:3c8f9176…
  verdict   { "ok": false, "code": "LOCK_DRIFT", "category": "modified" }
  detail    "CLAUDE.md modified vs phub.lock — agent must not load"
refused at the gate · agent receives no bytes`,
  },
] as const

export function CLIRoadmap() {
  return (
    <section className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1 mb-4">
            <Terminal className="size-3 text-primary/80" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Active by default · the 5 surfaces locked in ADR-0025
            </span>
          </div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Five commands that find what you didn&rsquo;t know to scan.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            A linter waits for the operator to point it at a known file. A
            guardian sits with the project and finds the unknown ones.{" "}
            <code className="font-mono text-foreground/80">phub</code>{" "}
            ships the five active surfaces — discover, drift-check, watch,
            install, gate — and runs the same Context CI kernel the
            scoreboard measures. Source published to GitHub today; the npm
            publish flips on launch day per{" "}
            <a
              href={`${GH_BLOB}/docs/decisions/0022-publishing-deferred-to-launch.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/90 hover:text-primary underline decoration-primary/30 underline-offset-2"
            >
              ADR-0022
            </a>
            .
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-5xl grid grid-cols-1 gap-3 md:grid-cols-2">
          {SURFACES.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.cmd}
                className="rounded-xl border border-border/40 bg-card overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-secondary/20 px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3 shrink-0 text-primary/70" />
                    <span className="text-[10px] font-mono text-primary/60 select-none">$</span>
                    <code className="text-xs font-mono text-foreground/90 truncate">
                      {s.cmd}
                    </code>
                  </div>
                  <a
                    href={s.adr.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 hover:text-primary"
                    title={`Read ${s.adr.id} — the source of truth for this surface`}
                  >
                    {s.adr.id}
                  </a>
                </div>
                <div className="px-4 py-3 flex-1 flex flex-col">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-primary/70 mb-1.5">
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {s.description}
                  </p>
                  <pre className="mt-auto rounded-md bg-background/60 border border-border/30 px-3 py-2 text-[10px] font-mono text-muted-foreground/90 leading-[1.7] overflow-x-auto whitespace-pre">
{s.output}
                  </pre>
                </div>
              </div>
            )
          })}
        </div>

        {/* Honest footer — what's shipped vs. what's gated. Reuses
            the same <PlannedBadge> primitive Forge uses so the
            project speaks one language about deferred surfaces. */}
        <div className="mt-10 mx-auto max-w-3xl flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground/80">
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
