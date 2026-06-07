/**
 * Evaluation loader — single source of truth for measured P/R/F1.
 *
 * Reads the freshest committed `bench/baseline/YYYY-MM-DD-ts.json` at
 * build time. `bench/scripts/render-evaluation.py` writes the same
 * numbers into `docs/evaluation.md`, and CI fails if either drifts —
 * so anything the homepage shows comes from the same artifact the
 * scanner-bench gate just measured.
 *
 * TS is the side we read because ADR-0023 parity is CI-enforced: Py
 * and TS produce byte-identical (tp, fp, tn, fn) per detector or the
 * gate fails. Either file would yield the same numbers; we read TS
 * to keep the loader pure-Node, no Python.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

export interface DetectorScore {
  readonly tp: number
  readonly fp: number
  readonly tn: number
  readonly fn: number
  readonly precision: number | null
  readonly recall: number | null
  readonly f1: number | null
  readonly support: number
}

export interface OverallScore {
  readonly precision_macro: number
  readonly recall_macro: number
  readonly f1_macro: number
}

export interface Evaluation {
  readonly measured_at: string
  readonly language: "ts" | "py"
  readonly manifest_version: string
  readonly top10_version: string
  readonly samples_total: number
  readonly per_detector: Readonly<Record<string, DetectorScore>>
  readonly overall: OverallScore
  readonly holdout?: {
    readonly samples_total: number
    readonly overall: OverallScore
    readonly per_detector: Readonly<Record<string, DetectorScore>>
  }
}

const BASELINE_NAME_RE = /^(\d{4}-\d{2}-\d{2})-ts\.json$/

/**
 * Find the bench/baseline directory regardless of where Next is
 * launched from. Mirrors the candidate-list pattern in
 * app/top-10/page.tsx so dev (`cwd === apps/web`) and Next's
 * standalone runtime both resolve.
 */
function findBaselineDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../bench/baseline"),
    path.resolve(process.cwd(), "bench/baseline"),
    "/repo/bench/baseline",
  ]
  for (const candidate of candidates) {
    try {
      const entries = readdirSync(candidate)
      if (entries.some((e) => BASELINE_NAME_RE.test(e))) return candidate
    } catch {
      // try next
    }
  }
  throw new Error(
    `bench/baseline not reachable. Tried: ${candidates.join(", ")}`,
  )
}

/**
 * Latest committed TS baseline JSON. "Latest" = largest filename by
 * lexical sort, which works because the filenames are ISO dates.
 * Throws if none are present — fail loud at build time, not silent at
 * render time.
 */
export function loadLatestEvaluation(): Evaluation {
  const dir = findBaselineDir()
  const dated = readdirSync(dir)
    .filter((e) => BASELINE_NAME_RE.test(e))
    .sort()
  const latest = dated[dated.length - 1]
  if (!latest) throw new Error(`No bench/baseline/*-ts.json found in ${dir}`)
  const raw = readFileSync(path.join(dir, latest), "utf8")
  return JSON.parse(raw) as Evaluation
}

/**
 * Compact view used by the homepage: total detectors at F1 = 1.000,
 * total measured, in-sample + holdout sample counts, parity status.
 * The exact tuple the Trust Runtime caption needs without forcing
 * the caller to walk per_detector themselves.
 */
export interface EvaluationSummary {
  readonly measuredAt: string
  readonly totalDetectors: number
  readonly perfectDetectors: number
  readonly macroF1InSample: number
  readonly macroPrecisionInSample: number
  readonly macroRecallInSample: number
  readonly inSampleSamples: number
  readonly holdoutSamples: number
  readonly corpusVersion: string
  readonly top10Version: string
}

export function summarize(ev: Evaluation): EvaluationSummary {
  const detectors = Object.values(ev.per_detector)
  const perfect = detectors.filter((d) => d.f1 === 1).length
  return {
    measuredAt: ev.measured_at,
    totalDetectors: detectors.length,
    perfectDetectors: perfect,
    macroF1InSample: ev.overall.f1_macro,
    macroPrecisionInSample: ev.overall.precision_macro,
    macroRecallInSample: ev.overall.recall_macro,
    inSampleSamples: ev.samples_total,
    holdoutSamples: ev.holdout?.samples_total ?? 0,
    corpusVersion: ev.manifest_version,
    top10Version: ev.top10_version,
  }
}
