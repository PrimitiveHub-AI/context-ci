/**
 * Evaluation loader — single source of truth for measured P/R/F1.
 *
 * Reads from the latest TS baseline embedded at
 * `apps/web/lib/evaluation.data.json`. `bench/scripts/render-evaluation.py`
 * writes the same numbers into `docs/evaluation.md`, and CI fails if
 * either drifts — so anything the homepage shows comes from the same
 * artifact the scanner-bench gate just measured.
 *
 * Why embedded JSON instead of a runtime fs read of `bench/baseline/`:
 * the web app is shipped as a Docker image whose build context is
 * `apps/web/`. `bench/baseline/` lives one level up at the repo root
 * and is not copied into the image — a runtime fs read fails with
 * "/app/bench/baseline not reachable" in any non-local environment.
 * Embedding the JSON at build time makes the loader deterministic
 * across dev, Docker, and Next standalone output.
 *
 * Keeping it fresh: `apps/web/scripts/sync-evaluation.mjs` copies the
 * newest `bench/baseline/YYYY-MM-DD-ts.json` over the embedded file.
 * Run it (or wire it into a prebuild hook) whenever a new baseline
 * lands. The committed FLOOR.md discipline guarantees the baseline
 * only ratchets upward, so the embedded copy is stale-safe — it can
 * only lag behind reality, never overstate it.
 *
 * TS is the side we read (not Py) because ADR-0023 parity is
 * CI-enforced: Py and TS produce byte-identical (tp, fp, tn, fn) per
 * detector or the gate fails. Either file would yield the same
 * numbers; we read TS to keep the loader pure JS.
 */
import baselineData from "./evaluation.data.json"

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

/**
 * Latest committed TS baseline, embedded at build time. See header
 * comment for why this is an embedded JSON import rather than an fs
 * read of `bench/baseline/`.
 */
export function loadLatestEvaluation(): Evaluation {
  return baselineData as unknown as Evaluation
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
