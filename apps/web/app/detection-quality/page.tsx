import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, CheckCircle2, AlertTriangle, ShieldCheck, FlaskConical } from "lucide-react"

import { Card } from "@/components/ui/card"
import { loadLatestEvaluation, summarize, type DetectorScore } from "@/lib/evaluation"
import { docRoute } from "@/lib/site"

/**
 * /detection-quality — the credibility page (UI/UX audit 2026-10-24,
 * Finding A). "Your credibility comes from showing precisely where
 * PrimitiveHub succeeds AND where it does not."
 *
 * Every number here is read from the committed, reproducible baseline
 * (`lib/evaluation.data.json`, rendered by `bench/scripts/render-evaluation.py`)
 * — the same source the homepage pill reads. Measured truth, not demo
 * data: we publish in-sample AND held-out, the per-detector breakdown,
 * the one false positive, and the engine-parity status. No number is
 * shown that we can't reproduce for the paper.
 */

export const metadata: Metadata = {
  title: "Detection Quality — PrimitiveHub",
  description:
    "Exactly how well Context CI detects — in-sample and held-out, per detector, with the false positives and the coverage gaps shown honestly. Measured, reproducible, dated.",
}

function pct(v: number | null): string {
  return v === null ? "—" : v.toFixed(3)
}

export default function DetectionQualityPage() {
  const ev = loadLatestEvaluation()
  const s = summarize(ev)

  const detectors: ReadonlyArray<[string, DetectorScore]> = Object.entries(ev.per_detector).sort(
    ([a], [b]) => a.localeCompare(b),
  )
  // Where we DON'T fully succeed: in-sample detectors with a false positive,
  // and held-out detectors whose recall drops below 1.0.
  const inSampleFPs = detectors.filter(([, d]) => d.fp > 0)
  const holdout = ev.holdout
  const holdoutMisses = holdout
    ? Object.entries(holdout.per_detector).filter(([, d]) => d.recall !== null && d.recall < 1)
    : []

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 lg:px-6">
      {/* Header */}
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
          Detection Quality
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
          Exactly how well Context CI detects — and where it doesn&rsquo;t.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] text-muted-foreground leading-relaxed">
          Credibility comes from showing both. Below is the measured performance of the{" "}
          {s.totalDetectors} Context CI Top 10 detectors on a labeled adversarial corpus —
          in-sample and on a held-out slice, per detector, including the false positive and the
          coverage gap. Every figure is reproducible from the committed baseline; none is demo data.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1 text-muted-foreground">
            Measured {ev.language.toUpperCase()} · {s.measuredAt}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1 text-muted-foreground">
            Context CI Top 10 v{s.top10Version}
          </span>
          <a
            href={docRoute("docs/evaluation.md")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1 text-primary/90 hover:text-primary"
          >
            Reproduce it <ArrowUpRight className="size-3" />
          </a>
        </div>
      </header>

      {/* Two headline slices: in-sample vs held-out */}
      <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/40 bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-success/80" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-foreground">In-sample</h2>
          </div>
          <Metric label="Macro F1" value={s.macroF1InSample.toFixed(3)} />
          <Metric label="Macro precision" value={s.macroPrecisionInSample.toFixed(3)} />
          <Metric label="Macro recall" value={s.macroRecallInSample.toFixed(3)} />
          <Metric label="Labeled samples" value={s.inSampleSamples.toString()} />
          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            {s.perfectDetectors}/{s.totalDetectors} detectors at F1 = 1.000. This is the ceiling —
            performance on the corpus the detectors were tuned against.
          </p>
        </Card>

        <Card className="border-amber/20 bg-amber/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="size-4 text-amber/80" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-foreground">Held-out</h2>
          </div>
          {holdout ? (
            <>
              <Metric label="Macro recall" value={pct(holdout.overall.recall_macro)} tone="amber" />
              <Metric label="Macro precision" value={pct(holdout.overall.precision_macro)} />
              <Metric label="Macro F1" value={pct(holdout.overall.f1_macro)} />
              <Metric label="Held-out samples" value={holdout.samples_total.toString()} />
              <p className="mt-3 text-[11px] text-foreground/80 leading-relaxed">
                <span className="text-amber/90 font-medium">This is the honest number.</span>{" "}
                On attacks the detectors were <em>not</em> tuned against, macro recall is{" "}
                {pct(holdout.overall.recall_macro)} — we miss some novel attacks. Static detection
                cannot prove an arbitrary skill is safe; this gap is why.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">Held-out slice not present in this baseline.</p>
          )}
        </Card>
      </section>

      {/* Per-detector breakdown */}
      <section className="mb-10">
        <h2 className="text-sm font-mono uppercase tracking-wider text-primary/85 mb-3">
          Per detector (in-sample)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/40">
          <div className="grid grid-cols-12 gap-px bg-border/40 text-[10px] font-mono uppercase tracking-widest">
            <div className="col-span-3 bg-card/60 px-4 py-2.5 text-muted-foreground/80">Detector</div>
            <div className="col-span-2 bg-card/60 px-3 py-2.5 text-primary/85">Precision</div>
            <div className="col-span-2 bg-card/60 px-3 py-2.5 text-primary/85">Recall</div>
            <div className="col-span-2 bg-card/60 px-3 py-2.5 text-primary/85">F1</div>
            <div className="col-span-3 bg-card/60 px-3 py-2.5 text-muted-foreground/80">Notes</div>
          </div>
          <div className="grid grid-cols-12 gap-px bg-border/40">
            {detectors.map(([cci, d]) => {
              const clean = d.f1 === 1
              return (
                <div key={cci} className="contents">
                  <div className="col-span-3 bg-card px-4 py-2.5 font-mono text-[11px] text-foreground">{cci}</div>
                  <div className="col-span-2 bg-card px-3 py-2.5 font-mono text-[11px] text-foreground/90 tabular-nums">{pct(d.precision)}</div>
                  <div className="col-span-2 bg-card px-3 py-2.5 font-mono text-[11px] text-foreground/90 tabular-nums">{pct(d.recall)}</div>
                  <div className={`col-span-2 bg-card px-3 py-2.5 font-mono text-[11px] tabular-nums ${clean ? "text-success/90" : "text-amber/90"}`}>{pct(d.f1)}</div>
                  <div className="col-span-3 bg-card px-3 py-2.5 text-[10px] text-muted-foreground">
                    {d.fp > 0 ? `${d.fp} false positive${d.fp === 1 ? "" : "s"}` : clean ? "clean" : ""}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Where we don't succeed — stated plainly */}
      <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/40 bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber/80" />
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground">False positives (in-sample)</h3>
          </div>
          {inSampleFPs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">None on this corpus.</p>
          ) : (
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {inSampleFPs.map(([cci, d]) => (
                <li key={cci}>
                  <span className="font-mono text-foreground/90">{cci}</span> — {d.fp} FP (F1 {pct(d.f1)})
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="border-border/40 bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="size-4 text-amber/80" />
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground">Coverage gaps (held-out)</h3>
          </div>
          {holdoutMisses.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No per-detector recall drop recorded.</p>
          ) : (
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {holdoutMisses.map(([cci, d]) => (
                <li key={cci}>
                  <span className="font-mono text-foreground/90">{cci}</span> — recall {pct(d.recall)} on held-out
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Parity + limits */}
      <section className="rounded-xl border border-border/40 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary/80" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-primary/85">What these numbers do and don&rsquo;t mean</h2>
        </div>
        <ul className="space-y-2 text-[13px] text-muted-foreground leading-relaxed">
          <li>
            <span className="text-foreground/90">Python ↔ TypeScript parity is gated.</span> Both engines
            must produce identical verdicts on every sample or the regression gate fails — the number
            above is the same on both.
          </li>
          <li>
            <span className="text-foreground/90">Held-out recall is the coverage number that matters.</span>{" "}
            In-sample F1 is the ceiling; held-out is closer to the field. We publish both, and the gap.
          </li>
          <li>
            <span className="text-foreground/90">This is static detection.</span> It cannot prove an
            arbitrary skill is harmless — especially when an attack depends on runtime behavior or
            external content the scanner never sees. A clean verdict is &ldquo;no findings under these
            checks&rdquo;, not a safety guarantee.
          </li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3 text-[12px] font-mono">
          <Link href="/check" className="inline-flex items-center gap-1 text-primary/90 hover:text-primary">
            Run a check <ArrowUpRight className="size-3" />
          </Link>
          <Link href="/top-10" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            The Top 10 taxonomy <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/30 py-1.5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums text-sm ${tone === "amber" ? "text-amber/90" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}
