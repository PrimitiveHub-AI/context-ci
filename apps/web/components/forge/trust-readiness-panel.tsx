import { Card } from "@/components/ui/card"
import { PlannedBadge } from "@/components/ui/planned-badge"
import {
  ShieldCheck,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Fingerprint,
} from "lucide-react"

/**
 * TrustReadinessPanel — Reviewer B's "security-aware IDE" right-side
 * block. Sits at the top of the Forge right column.
 *
 * Aggregates the same live analysis the Lint Output panel uses
 * (errors / warnings / sections / fmRisk / token budget) into one
 * paper-grade "Ready to publish?" summary. Every signal here is
 * already computed by the parent on every keystroke; this component
 * is presentational — no fetches, no hooks, no parallel logic.
 *
 * Reviewer B's contract (paraphrased): "Make Forge feel like a
 * security-aware IDE, not a Markdown editor with chrome." This
 * panel is the smallest unit of that contract: a deterministic
 * answer to "will this pass enterprise CI?" computed from the
 * same kernel CI runs.
 */

const FAIL_PREFLIGHT: ReadonlyArray<string> = [
  "any Top 10 detector raises an error-class finding",
  "required spec sections are missing (Purpose, Core Principles, Decision Rules, Anti-Patterns, Review Checklist, Agent Behavior Instructions)",
  "frontmatter omits `compatible_agents`, `risk_level`, or `license`",
  "risk is `high` and no security reviewer is named",
  "tokens exceed the declared `token_budget`",
]

type Risk = "low" | "medium" | "high" | string

interface ReadinessInput {
  errors: number
  warnings: number
  infos: number
  requiredPresent: number
  requiredTotal: number
  tokens: number
  fmBudget: number
  fmRisk: Risk
  /**
   * Optional frontmatter-derived signal — we only block on it when
   * the literal value is `false`. Undefined is treated as "user has
   * not declared yet" (no block, just info).
   */
  frontmatterOk?: boolean
}

interface BlockReason {
  key: string
  message: string
}

function computeReadiness(input: ReadinessInput): {
  ready: boolean
  blockers: BlockReason[]
} {
  const blockers: BlockReason[] = []
  if (input.errors > 0) {
    blockers.push({
      key: "errors",
      message: `${input.errors} error-class finding${input.errors === 1 ? "" : "s"} — must be 0`,
    })
  }
  if (input.requiredPresent < input.requiredTotal) {
    blockers.push({
      key: "sections",
      message: `${input.requiredTotal - input.requiredPresent} required section${input.requiredTotal - input.requiredPresent === 1 ? "" : "s"} missing`,
    })
  }
  if (input.tokens > input.fmBudget) {
    blockers.push({
      key: "tokens",
      message: `${input.tokens.toLocaleString()} tokens over the declared ${input.fmBudget.toLocaleString()}-token budget`,
    })
  }
  if (input.fmRisk !== "low" && input.fmRisk !== "medium" && input.fmRisk !== "high") {
    blockers.push({
      key: "risk",
      message: "`risk_level` not declared (must be low / medium / high)",
    })
  }
  if (input.frontmatterOk === false) {
    blockers.push({
      key: "frontmatter",
      message: "frontmatter does not parse against Primitive Spec v0.1",
    })
  }
  return { ready: blockers.length === 0, blockers }
}

function tokenPercent(tokens: number, budget: number): number {
  if (budget <= 0) return 0
  return Math.min(100, Math.round((tokens / budget) * 100))
}

export function TrustReadinessPanel(input: ReadinessInput) {
  const { ready, blockers } = computeReadiness(input)
  const pct = tokenPercent(input.tokens, input.fmBudget)

  return (
    <Card className="border-border/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <ShieldCheck className={ready ? "size-3 text-success/80" : "size-3 text-amber/80"} />
          Trust Readiness
        </h3>
        {ready ? (
          <span
            className="inline-flex items-center gap-1 rounded-sm border border-success/30 bg-success/[0.07] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-success/90"
            title="Local kernel says yes; final verdict comes from Context CI on submit"
          >
            <CheckCircle2 className="size-2.5" />
            Ready to publish
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-sm border border-amber/30 bg-amber/[0.07] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber/90"
            title="Local kernel found blockers — resolve before submit"
          >
            <AlertTriangle className="size-2.5" />
            {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Headline cells — same numbers the status bar shows, framed as
          the trust-readiness verdict. */}
      <div className="grid grid-cols-2 gap-px rounded-md border border-border/40 overflow-hidden bg-border/40 text-[10px] font-mono">
        <div className="bg-card px-2.5 py-2 flex items-center justify-between">
          <span className="text-muted-foreground/80 uppercase tracking-wider">Blocking</span>
          <span className={input.errors > 0 ? "text-destructive font-semibold tabular-nums" : "text-foreground/70 tabular-nums"}>
            {input.errors}
          </span>
        </div>
        <div className="bg-card px-2.5 py-2 flex items-center justify-between">
          <span className="text-muted-foreground/80 uppercase tracking-wider">Warnings</span>
          <span className={input.warnings > 0 ? "text-amber font-semibold tabular-nums" : "text-foreground/70 tabular-nums"}>
            {input.warnings}
          </span>
        </div>
        <div className="bg-card px-2.5 py-2 flex items-center justify-between">
          <span className="text-muted-foreground/80 uppercase tracking-wider">Spec sections</span>
          <span
            className={
              input.requiredPresent === input.requiredTotal
                ? "text-success tabular-nums"
                : "text-amber font-semibold tabular-nums"
            }
          >
            {input.requiredPresent}/{input.requiredTotal}
          </span>
        </div>
        <div className="bg-card px-2.5 py-2 flex items-center justify-between">
          <span className="text-muted-foreground/80 uppercase tracking-wider">Risk</span>
          <span
            className={
              input.fmRisk === "low"
                ? "text-success uppercase tabular-nums"
                : input.fmRisk === "medium"
                  ? "text-amber uppercase tabular-nums"
                  : input.fmRisk === "high"
                    ? "text-destructive font-semibold uppercase tabular-nums"
                    : "text-muted-foreground/70 uppercase tabular-nums"
            }
          >
            {input.fmRisk}
          </span>
        </div>
      </div>

      {/* Token budget — full-width bar so the absolute and relative
          fit are visible at a glance. */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span className="text-muted-foreground/80 uppercase tracking-wider">Token budget</span>
          <span
            className={
              input.tokens > input.fmBudget
                ? "text-destructive font-semibold tabular-nums"
                : pct > 90
                  ? "text-amber tabular-nums"
                  : "text-foreground/70 tabular-nums"
            }
          >
            ~{input.tokens.toLocaleString()} / {input.fmBudget.toLocaleString()} ({pct}%)
          </span>
        </div>
        <div className="token-bar h-1.5 overflow-hidden rounded-full bg-border/40">
          <div
            className={`token-bar-fill h-full transition-all ${
              input.tokens > input.fmBudget
                ? "bg-destructive"
                : pct > 90
                  ? "bg-amber"
                  : "bg-primary/60"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Attestation preview — pre-launch, always Planned. Reuses
          the same <PlannedBadge> primitive every other deferred
          surface uses; the project speaks one language about
          gated work. */}
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
          <Fingerprint className="size-3 text-primary/60" />
          Attestation preview
        </div>
        <PlannedBadge label="ADR-0022 gated" />
      </div>

      {/* Enterprise-policy preflight — fixed list of guarantees the
          policy gate enforces on submit, with current blockers
          highlighted. We say so on the surface instead of hiding it
          in tooltips. */}
      <div className="mt-3 border-t border-border/40 pt-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 mb-2 flex items-center gap-1.5">
          <Lock className="size-3 text-primary/60" />
          Enterprise policy will fail this submit if
        </p>
        <ul className="space-y-1.5">
          {FAIL_PREFLIGHT.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted-foreground"
            >
              <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Active blockers, if any — quote-back what's currently
          stopping a publish so the author can resolve in place. */}
      {blockers.length > 0 && (
        <div className="mt-3 rounded-md bg-amber/[0.04] border border-amber/15 px-2.5 py-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-amber/90 mb-1.5 flex items-center gap-1.5">
            <XCircle className="size-3 text-amber/80" />
            Active blockers (live)
          </p>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li
                key={b.key}
                className="text-[10.5px] leading-relaxed text-muted-foreground"
              >
                · {b.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
