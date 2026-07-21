import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight, BookOpen } from "lucide-react"

import { AVParallelMap } from "@/components/landing/av-parallel-map"
import { Top10Card } from "@/components/landing/top10-card"
import { EvaluationLink } from "@/components/primitives/evaluation-link"
import { loadLatestEvaluation, summarize } from "@/lib/evaluation"
import { listTop10 } from "@/lib/top10"

/**
 * /top-10 — public visual surface for the Context CI Top 10 v0.1
 * taxonomy.
 *
 * Two-layer split per the expert review:
 *   - this page is the public, scannable artifact (10 visual cards
 *     with measured F1, severity ceiling, canonical sample). The
 *     OWASP Top 10 dashboard pattern, not a spec dump.
 *   - the normative reference lives at /specs/context-ci-top-10-v0.1
 *     (full markdown rendered from docs/context-ci-top-10-v0.1.md
 *     with stable CCI-NNN anchors). The "Read the full normative
 *     spec →" link at the bottom of this page is the bridge.
 *
 * Pre-launch posture: page metadata robots: noindex inherits from
 * apps/web/app/layout.tsx; the page renders production-parity but
 * does not appear in search results until ADR-0045 launch flips.
 */

export const metadata: Metadata = {
  title: "Context CI Top 10 v0.1 — PrimitiveHub",
  description:
    "The ten supply-chain attack categories Context CI detects, classified, and gated. Stable identifiers CCI-001 through CCI-010, measured precision and recall on an open adversarial corpus, canonical samples linked.",
}

export default function TopTenPage() {
  const summary = summarize(loadLatestEvaluation())
  const evaluation = loadLatestEvaluation()
  const entries = listTop10()
  const totalSamples = summary.inSampleSamples + summary.holdoutSamples

  return (
    <main className="mx-auto max-w-6xl px-4 py-14 lg:px-6">
      {/* Header — names the artifact, anchors the credibility */}
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-3">
          Versioned public spec · v{summary.top10Version}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
          Context CI Top 10
        </h1>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          The ten AI-agent context supply-chain attack categories detected,
          classified, and gated by Context CI. Stable identifiers{" "}
          <code className="font-mono text-foreground/80">CCI-001</code>{" "}
          through{" "}
          <code className="font-mono text-foreground/80">CCI-010</code> —
          cited by the Trust Contract attestation predicate and append-only
          after the v0.1 freeze.
        </p>

        {/* Measured headline — paper-grade truth, one click from proof */}
        <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-primary/15 bg-primary/[0.04] px-4 py-2 text-[11px] font-mono text-primary/90">
          <EvaluationLink>
            {summary.perfectDetectors}/{summary.totalDetectors} detectors at F1 = {summary.macroF1InSample.toFixed(3)}
          </EvaluationLink>
          <span className="text-muted-foreground">·</span>
          <EvaluationLink proof="corpus">
            {totalSamples} labeled samples
          </EvaluationLink>
          <span className="text-muted-foreground">·</span>
          <EvaluationLink proof="floor">Py ↔ TS parity gated</EvaluationLink>
        </p>
      </header>

      {/* AV-parallel recognition primer (full) — per ADR-0030 §3 +
          ADR-0040 §1. Sets the reference frame for the 10 cards
          below: this is AV for agent context. The buyer already
          understands this product family; the cards then teach the
          ten specific threat shapes our scanner emits against. */}
      <div className="mt-14">
        <AVParallelMap variant="full" />
      </div>

      {/* 10-card grid — the dashboard, not the dump */}
      <section className="mt-14 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border/40 overflow-hidden bg-border/40">
        {entries.map((entry) => (
          <Top10Card
            key={entry.cci}
            entry={entry}
            score={evaluation.per_detector[entry.cci]}
          />
        ))}
      </section>

      {/* Bridge to the normative reference + reproducibility */}
      <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/specs/context-ci-top-10-v0.1"
          className="group flex flex-col rounded-xl border border-border/40 bg-card p-6 transition-colors hover:border-primary/40 hover:bg-card/80"
        >
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            <BookOpen className="size-3" />
            Normative reference
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Read the full Context CI Top 10 v0.1 spec
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Severity model, per-category definitions, attestation predicate,
            detector roster, ID stability rules. Cited by the Trust Contract
            attestation predicate and the paper.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-mono text-primary/90 group-hover:text-primary">
            /specs/context-ci-top-10-v0.1
            <ArrowUpRight className="size-3" />
          </span>
        </Link>

        <div className="flex flex-col rounded-xl border border-border/40 bg-card/50 p-6">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
            Reproduce the numbers
          </div>
          <h2 className="text-base font-semibold text-foreground">
            One command, both engines, byte-identical parity.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Per-detector precision and recall measured by{" "}
            <EvaluationLink proof="gate">
              <code className="text-foreground/80">bench/scripts/gate.sh</code>
            </EvaluationLink>{" "}
            against the committed{" "}
            <EvaluationLink proof="corpus">v0.2 adversarial corpus</EvaluationLink>
            . Floor enforced by the{" "}
            <EvaluationLink proof="floor">scanner-bench regression gate</EvaluationLink>
            ; drift fails the build.
          </p>
          <pre className="mt-4 rounded-md border border-border/40 bg-background/60 px-3 py-2 text-[11px] font-mono text-muted-foreground overflow-x-auto">
            {`# run the same detectors the scoreboard measures:
npx @primitivehub/phub audit

# full corpus evaluation + every measured number: /paper`}
          </pre>
        </div>
      </section>
    </main>
  )
}
