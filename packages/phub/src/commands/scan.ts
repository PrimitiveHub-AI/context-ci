import { readFileSync } from "node:fs"

import { DETECTORS, detectorByName } from "../scanners/registry.js"
import { Severity, type Verdict } from "../scanners/types.js"
import { renderHumanScanReport } from "../reporters/human.js"
import { renderSarif } from "../reporters/sarif.js"

export interface ScanOptions {
  /** Output JSON instead of human-readable text */
  json: boolean
  /** Output SARIF 2.1.0 (mutually exclusive with json) */
  sarif: boolean
  /** Restrict to specific detectors (by name, CCI ID, or threat category) */
  detectors?: readonly string[]
  /** Treat WARN as FAIL (default: only FAIL triggers exit 1) */
  strict: boolean
}

export interface ScanResult {
  filename: string
  verdicts: Verdict[]
  exitCode: number
}

export function runScan(filename: string, content: string, opts: ScanOptions): ScanResult {
  const selected = opts.detectors && opts.detectors.length > 0
    ? opts.detectors
        .map((id) => detectorByName(id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined)
    : DETECTORS

  const verdicts = selected.map((d) => d.run({ content, filename }))

  const fails = verdicts.filter((v) => v.severity === Severity.FAIL)
  const warns = opts.strict ? verdicts.filter((v) => v.severity === Severity.WARN) : []
  const exitCode = fails.length + warns.length > 0 ? 1 : 0

  return { filename, verdicts, exitCode }
}

/** Top-level dispatch for `phub scan`. Returns process exit code. */
export function scanCommand(filename: string, opts: ScanOptions): number {
  let content: string
  try {
    content = readFileSync(filename, "utf8")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub scan: cannot read ${filename}: ${msg}\n`)
    return 2
  }
  const result = runScan(filename, content, opts)
  if (opts.sarif) {
    // SARIF output goes to stdout; human-readable progress to stderr
    // so callers redirecting stdout into a .sarif file get clean JSON.
    process.stdout.write(renderSarif(filename, result.verdicts) + "\n")
  } else if (opts.json) {
    process.stdout.write(JSON.stringify({ filename: result.filename, verdicts: result.verdicts }, null, 2) + "\n")
  } else {
    process.stdout.write(renderHumanScanReport(filename, result.verdicts) + "\n")
  }
  return result.exitCode
}
