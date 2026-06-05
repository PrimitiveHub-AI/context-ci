#!/usr/bin/env tsx
/**
 * measure.ts — TS precision/recall measurement against
 * bench/corpus/manifest.yaml.
 *
 * Reads the manifest, runs every active TS detector against every
 * sample, computes per-detector TP / FP / TN / FN, derives
 * precision / recall / F1, emits a human-readable report + an
 * optional JSON baseline.
 *
 * Spec: docs/corpus-v0.1.md
 * ADR:  docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md
 *
 * Usage:
 *   tsx measure.ts                              # measure + write today's baseline
 *   tsx measure.ts --baseline <path>            # compare against a prior baseline
 *   tsx measure.ts --gate                       # exit 1 on F1 regression > tolerance
 *   tsx measure.ts --detector CCI-001           # restrict to one detector
 *   tsx measure.ts --no-baseline                # don't write the baseline file
 *
 * Exit codes:
 *   0 — measurement completed; no regression (under --gate)
 *   1 — regression detected (under --gate) OR usage error
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parse as parseYaml } from "yaml"

import {
  DETECTORS,
  type Detector,
  type Verdict,
  Severity,
} from "@primitivehub/phub"

// ----- types ------------------------------------------------------------------

type Label = "adversarial" | "benign" | "borderline"
type ExpectedVerdict = "PASS" | "WARN" | "FAIL"

interface ManifestSample {
  id: string
  path: string
  label: Label
  threat_category: string
  cci_id: string
  detail_tags?: string[]
  severity: string
  expected_verdict: ExpectedVerdict
  contributor: string
  added: string
  notes: string
  incident_reference?: string | null
  parity_status?: string
  // Round 4 (ADR-0038): 80/20 holdout split for overfit detection.
  // Default false — sample contributes to in-sample stats unless
  // explicitly flagged in the manifest.
  holdout?: boolean
}

interface Manifest {
  version: string
  top10_version: string
  license: string
  samples: ManifestSample[]
}

interface DetectorStats {
  tp: number
  fp: number
  tn: number
  fn: number
  precision: number | null
  recall: number | null
  f1: number | null
  support: number
}

interface OverallStats {
  precision_macro: number | null
  recall_macro: number | null
  f1_macro: number | null
}

interface BaselineDoc {
  version: "0.1"
  language: "ts"
  measured_at: string
  manifest_version: string
  top10_version: string
  samples_total: number
  per_detector: Record<string, DetectorStats>
  overall: OverallStats
  parity: {
    agreed_sample_ids: string[]
    drift_sample_ids: string[]
  }
  // Round 4 (ADR-0038): holdout stats reported separately. Present
  // only when the manifest contains at least one holdout sample.
  holdout?: {
    samples_total: number
    per_detector: Record<string, DetectorStats>
    overall: OverallStats
  }
}

// ----- helpers ----------------------------------------------------------------

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const BENCH_ROOT = join(REPO_ROOT, "bench")
const CORPUS_ROOT = join(BENCH_ROOT, "corpus")
const MANIFEST_PATH = join(CORPUS_ROOT, "manifest.yaml")
const BASELINE_DIR = join(BENCH_ROOT, "baseline")

const REGRESSION_TOLERANCE = 0.02

function loadManifest(): Manifest {
  const raw = readFileSync(MANIFEST_PATH, "utf8")
  const doc = parseYaml(raw) as Manifest
  if (doc.version !== "0.1" && doc.version !== "0.2") {
    throw new Error(`unsupported corpus version: ${doc.version}`)
  }
  return doc
}

function detectorVerdictSeverity(v: Verdict): ExpectedVerdict {
  if (v.severity === Severity.FAIL) return "FAIL"
  if (v.severity === Severity.WARN) return "WARN"
  return "PASS"
}

function severityToInt(s: ExpectedVerdict): number {
  return s === "FAIL" ? 2 : s === "WARN" ? 1 : 0
}

/**
 * Score one sample against all active detectors.
 *
 * For the sample's *primary* detector (matching cci_id):
 *   - adversarial + verdict >= expected → TP
 *   - adversarial + verdict <  expected → FN
 *   - benign      + verdict >= WARN     → FP
 *   - benign      + verdict == PASS     → TN
 *
 * For OTHER detectors (cross-trip), only the FP/TN dimension matters:
 *   - benign      + other detector flagged → FP on the OTHER detector
 *   - benign      + no flag                → TN on the OTHER detector
 *   - adversarial samples don't contribute to other detectors' TP/FN
 *     (they're not "ground truth" for those detectors).
 */
function scoreSample(
  s: ManifestSample,
  detectorVerdicts: Map<string, Verdict>,
  stats: Map<string, DetectorStats>,
): void {
  const expected = severityToInt(s.expected_verdict)

  for (const [cci, v] of detectorVerdicts) {
    let st = stats.get(cci)
    if (!st) {
      st = { tp: 0, fp: 0, tn: 0, fn: 0, precision: null, recall: null, f1: null, support: 0 }
      stats.set(cci, st)
    }
    const got = severityToInt(detectorVerdictSeverity(v))

    if (cci === s.cci_id) {
      // Primary detector: full TP/FP/TN/FN logic.
      if (s.label === "adversarial" || s.label === "borderline") {
        if (got >= expected) st.tp += 1
        else st.fn += 1
      } else if (s.label === "benign") {
        if (got >= 1 /* WARN or FAIL */) st.fp += 1
        else st.tn += 1
      }
    } else {
      // Cross-trip: only FP/TN dimension applies (we have no ground
      // truth for OTHER detectors on this sample's attack family).
      if (s.label === "benign") {
        if (got >= 1) st.fp += 1
        else st.tn += 1
      }
    }
  }
}

function finalizeStats(st: DetectorStats): void {
  st.support = st.tp + st.fp + st.tn + st.fn
  st.precision = st.tp + st.fp > 0 ? st.tp / (st.tp + st.fp) : null
  st.recall = st.tp + st.fn > 0 ? st.tp / (st.tp + st.fn) : null
  st.f1 = st.precision !== null && st.recall !== null && st.precision + st.recall > 0
    ? (2 * st.precision * st.recall) / (st.precision + st.recall)
    : null
}

function macroAverage(per: Record<string, DetectorStats>): { precision_macro: number | null; recall_macro: number | null; f1_macro: number | null } {
  const ps: number[] = []
  const rs: number[] = []
  const fs: number[] = []
  for (const st of Object.values(per)) {
    if (st.precision !== null) ps.push(st.precision)
    if (st.recall !== null) rs.push(st.recall)
    if (st.f1 !== null) fs.push(st.f1)
  }
  const avg = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)
  return { precision_macro: avg(ps), recall_macro: avg(rs), f1_macro: avg(fs) }
}

function fmtNum(n: number | null, w = 6): string {
  if (n === null) return "n/a".padEnd(w)
  return n.toFixed(3).padEnd(w)
}

// ----- argv -------------------------------------------------------------------

interface Args {
  baseline: string | null
  gate: boolean
  gateVsLatest: boolean
  detector: string | null
  writeBaseline: boolean
  baselinePath: string | null
}

function latestBaseline(language: "py" | "ts"): string | null {
  let entries: string[]
  try {
    entries = readdirSync(BASELINE_DIR)
  } catch {
    return null
  }
  const matches = entries
    .filter((n) => n.endsWith(`-${language}.json`))
    .sort() // YYYY-MM-DD-<lang>.json — lex sort == chronological
  return matches.length === 0 ? null : join(BASELINE_DIR, matches[matches.length - 1])
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    baseline: null,
    gate: false,
    gateVsLatest: false,
    detector: null,
    writeBaseline: true,
    baselinePath: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === "--gate") a.gate = true
    else if (t === "--gate-vs-latest") a.gateVsLatest = true
    else if (t === "--no-baseline") a.writeBaseline = false
    else if (t === "--baseline") { a.baseline = argv[++i] ?? null }
    else if (t === "--detector") { a.detector = argv[++i] ?? null }
    else if (t === "--write-baseline") { a.baselinePath = argv[++i] ?? null }
    else if (t === "--help" || t === "-h") {
      process.stdout.write(
        `measure.ts — TS precision/recall measurement (corpus v0.1)

Usage:
  tsx measure.ts                              # measure + write today's baseline
  tsx measure.ts --baseline <path>            # compare against a prior baseline
  tsx measure.ts --gate                       # exit 1 on F1 regression > ${REGRESSION_TOLERANCE.toFixed(2)} (composes with --baseline)
  tsx measure.ts --gate-vs-latest             # CI mode: auto-discover latest baseline + gate against it
  tsx measure.ts --detector CCI-001           # restrict to one detector
  tsx measure.ts --no-baseline                # don't write the baseline file
  tsx measure.ts --write-baseline <path>      # write baseline to a specific path
`,
      )
      process.exit(0)
    }
  }
  return a
}

// ----- main -------------------------------------------------------------------

function selectDetectors(restrictTo: string | null): readonly Detector[] {
  if (restrictTo === null) return DETECTORS
  return DETECTORS.filter((d) => d.cciId === restrictTo)
}

function todayISO(): string {
  // No clock available in some sandboxes; if Date is forbidden, the
  // caller can pass --write-baseline <path>.
  try {
    return new Date().toISOString().slice(0, 10)
  } catch {
    return "unknown-date"
  }
}

function loadBaseline(path: string): BaselineDoc {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as BaselineDoc
}

function printReport(manifest: Manifest, perDetector: Record<string, DetectorStats>, overall: ReturnType<typeof macroAverage>): void {
  const labels = manifest.samples.reduce(
    (acc, s) => {
      acc[s.label] = (acc[s.label] ?? 0) + 1
      return acc
    },
    {} as Record<Label, number>,
  )

  process.stdout.write(
    `Corpus v${manifest.version} (top10 v${manifest.top10_version}) — ${manifest.samples.length} samples ` +
      `(${labels.adversarial ?? 0} adversarial, ${labels.benign ?? 0} benign, ${labels.borderline ?? 0} borderline)\n\n`,
  )

  process.stdout.write("Per detector:\n")
  for (const [cci, st] of Object.entries(perDetector)) {
    process.stdout.write(`  ${cci}:\n`)
    process.stdout.write(`    precision  ${fmtNum(st.precision)}  (TP=${st.tp}, FP=${st.fp})\n`)
    process.stdout.write(`    recall     ${fmtNum(st.recall)}  (TP=${st.tp}, FN=${st.fn})\n`)
    process.stdout.write(`    F1         ${fmtNum(st.f1)}\n`)
    process.stdout.write(`    support    ${st.support} samples\n`)
  }
  process.stdout.write("\n")
  process.stdout.write("Overall (macro-average over detectors):\n")
  process.stdout.write(`  precision  ${fmtNum(overall.precision_macro)}\n`)
  process.stdout.write(`  recall     ${fmtNum(overall.recall_macro)}\n`)
  process.stdout.write(`  F1         ${fmtNum(overall.f1_macro)}\n\n`)
}

function compareToBaseline(current: BaselineDoc, baseline: BaselineDoc, tolerance: number): { regressions: string[] } {
  const regressions: string[] = []
  for (const [cci, st] of Object.entries(current.per_detector)) {
    const prior = baseline.per_detector[cci]
    if (!prior || prior.f1 === null || st.f1 === null) continue
    const drop = prior.f1 - st.f1
    if (drop > tolerance) {
      regressions.push(`${cci}: F1 ${prior.f1.toFixed(3)} → ${st.f1.toFixed(3)} (-${drop.toFixed(3)})`)
    }
  }
  return { regressions }
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv)

  if (args.gateVsLatest) {
    if (args.baseline !== null) {
      process.stderr.write("measure: --gate-vs-latest is mutually exclusive with --baseline\n")
      return 1
    }
    const latest = latestBaseline("ts")
    if (latest === null) {
      process.stderr.write("measure: --gate-vs-latest set but no TS baselines found\n")
      return 1
    }
    args.baseline = latest
    args.gate = true
    args.writeBaseline = false
  }

  let manifest: Manifest
  try {
    manifest = loadManifest()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`measure: cannot load manifest: ${msg}\n`)
    return 1
  }

  const detectors = selectDetectors(args.detector)
  if (detectors.length === 0) {
    process.stderr.write(`measure: no detectors selected (--detector=${args.detector})\n`)
    return 1
  }

  const inSampleStats = new Map<string, DetectorStats>()
  const holdoutStats = new Map<string, DetectorStats>()

  for (const s of manifest.samples) {
    const absPath = join(CORPUS_ROOT, s.path)
    let content: string
    try {
      content = readFileSync(absPath, "utf8")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`measure: sample ${s.id} missing on disk (${absPath}): ${msg}\n`)
      return 1
    }
    const verdicts = new Map<string, Verdict>()
    for (const d of detectors) {
      verdicts.set(d.cciId, d.run({ content, filename: s.path }))
    }
    scoreSample(s, verdicts, s.holdout ? holdoutStats : inSampleStats)
  }

  const finalize = (m: Map<string, DetectorStats>): Record<string, DetectorStats> => {
    const out: Record<string, DetectorStats> = {}
    for (const [cci, st] of m) {
      finalizeStats(st)
      out[cci] = st
    }
    return out
  }

  const perDetector = finalize(inSampleStats)
  const overall = macroAverage(perDetector)
  const inSampleManifest: Manifest = { ...manifest, samples: manifest.samples.filter((s) => !s.holdout) }
  printReport(inSampleManifest, perDetector, overall)

  const holdoutSamples = manifest.samples.filter((s) => s.holdout)
  let holdoutPer: Record<string, DetectorStats> | undefined
  let holdoutOverall: OverallStats | undefined
  if (holdoutSamples.length > 0) {
    holdoutPer = finalize(holdoutStats)
    holdoutOverall = macroAverage(holdoutPer)
    const holdoutManifest: Manifest = { ...manifest, samples: holdoutSamples }
    process.stdout.write(`\n── HOLDOUT (overfit detector, informational only) ──\n\n`)
    printReport(holdoutManifest, holdoutPer, holdoutOverall)
  }

  const measuredAt = todayISO()
  const currentBaseline: BaselineDoc = {
    version: "0.1",
    language: "ts",
    measured_at: measuredAt,
    manifest_version: manifest.version,
    top10_version: manifest.top10_version,
    samples_total: inSampleManifest.samples.length,
    per_detector: perDetector,
    overall,
    parity: {
      // Filled by the cross-language parity step in a follow-up;
      // single-language measurement leaves both lists empty.
      agreed_sample_ids: [],
      drift_sample_ids: [],
    },
    ...(holdoutPer && holdoutOverall
      ? {
          holdout: {
            samples_total: holdoutSamples.length,
            per_detector: holdoutPer,
            overall: holdoutOverall,
          },
        }
      : {}),
  }

  if (args.writeBaseline) {
    mkdirSync(BASELINE_DIR, { recursive: true })
    const out = args.baselinePath ?? join(BASELINE_DIR, `${measuredAt}-ts.json`)
    writeFileSync(out, JSON.stringify(currentBaseline, null, 2) + "\n", "utf8")
    process.stdout.write(`Baseline written: ${out}\n`)
  }

  if (args.baseline) {
    const prior = loadBaseline(args.baseline)
    const { regressions } = compareToBaseline(currentBaseline, prior, REGRESSION_TOLERANCE)
    if (regressions.length === 0) {
      process.stdout.write(`Comparison vs ${args.baseline}: no regressions (tolerance ${REGRESSION_TOLERANCE}).\n`)
    } else {
      process.stdout.write(`Comparison vs ${args.baseline}: ${regressions.length} regression(s):\n`)
      for (const r of regressions) process.stdout.write(`  - ${r}\n`)
      if (args.gate) return 1
    }
  }

  return 0
}

const argv = process.argv.slice(2)
process.exit(main(argv))
