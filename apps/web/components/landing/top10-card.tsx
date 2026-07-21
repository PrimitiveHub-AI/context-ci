import Link from "next/link"
import { ArrowUpRight, FileText } from "lucide-react"

import { EvaluationLink } from "@/components/primitives/evaluation-link"
import type { Top10Entry } from "@/lib/top10"
import type { DetectorScore } from "@/lib/evaluation"

/**
 * Top10Card — one of the ten visual cards on /top-10.
 *
 * Each card surfaces what a CISO buyer + research reviewer + paper
 * citer all need at a glance:
 *   - stable identifier (CCI-NNN) — the citation primitive
 *   - taxonomy name + one-line definition — the recognition primitive
 *   - severity ceiling — the impact primitive
 *   - measured F1 from the embedded baseline — the proof primitive
 *   - canonical adversarial sample — the show-me primitive
 *
 * Discipline notes:
 *   - F1 is passed in by the page (read live from lib/evaluation.ts).
 *     We do not hardcode it here; the loader is the single source.
 *   - Sample link points at the actual GitHub blob, not a local route
 *     stub — pre-launch the proof is in the repo, not the website.
 *   - Severity glyphs reuse the same color tokens used elsewhere on
 *     the site (destructive = fail, amber = warn) to stay
 *     visually consistent with verdict copy.
 */

interface Top10CardProps {
  entry: Top10Entry
  score: DetectorScore | undefined
}

function SeverityGlyph({ max }: { max: "warn" | "fail" }) {
  const isFail = max === "fail"
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
        isFail
          ? "border-destructive/30 bg-destructive/[0.06] text-destructive/90"
          : "border-amber/30 bg-amber/[0.06] text-amber/90",
      ].join(" ")}
      title={
        isFail
          ? "Maximum severity: fail — match blocks the Trusted verdict"
          : "Maximum severity: warn — match flags but does not block by default"
      }
    >
      <span
        className={[
          "size-1.5 rounded-full",
          isFail ? "bg-destructive" : "bg-amber",
        ].join(" ")}
        aria-hidden
      />
      max {max}
    </span>
  )
}

function f1Label(score: DetectorScore | undefined): string {
  if (!score || score.f1 === null) return "—"
  return score.f1 === 1 ? "1.000" : score.f1.toFixed(3)
}

export function Top10Card({ entry, score }: Top10CardProps) {
  return (
    <div className="group relative flex h-full flex-col bg-card p-5 transition-colors hover:bg-card/80">
      {/* Header row — stable ID + severity ceiling */}
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
          {entry.cci}
        </span>
        <SeverityGlyph max={entry.severityMax} />
      </div>

      {/* Title + one-liner */}
      <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">
        {entry.name}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {entry.definition}
      </p>

      {/* Spacer — pushes the proof row to the card bottom on grid */}
      <div className="flex-1" />

      {/* Proof row 1 — measured F1, wrapped in EvaluationLink so a
          hover proves the claim is reproducible. */}
      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] font-mono">
        <span className="text-muted-foreground/80">in-sample F1</span>
        <EvaluationLink
          className="text-foreground/90"
          title={`${entry.cci} measured against the adversarial corpus — open the scoreboard`}
        >
          {f1Label(score)}
        </EvaluationLink>
      </div>

      {/* Proof row 2 — detector implementation pointer */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground/70">
        <span>detector</span>
        <span className="text-muted-foreground">
          {entry.detector} {entry.detectorVersion}
        </span>
      </div>

      {/* Proof row 3 — canonical sample link */}
      <Link
        href="/specs/context-ci-top-10-v0.1"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-primary/85 hover:text-primary"
        title={`Canonical sample ${entry.canonicalSample} — read the normative definition for ${entry.cci}. The raw adversarial fixtures ship in the private corpus, not the public repo.`}
      >
        <FileText className="size-2.5" />
        {entry.canonicalSample}
        <ArrowUpRight className="size-2.5 opacity-60" />
      </Link>
    </div>
  )
}
