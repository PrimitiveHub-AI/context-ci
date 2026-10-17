import { readFileSync } from "node:fs"

import { applyPolicy, type PolicyEvaluation } from "../policy/evaluator.js"
import { resolvePolicy } from "../policy/loader.js"
import { type Policy, type PolicyAllowEntry, PolicyLoadError } from "../policy/types.js"
import { renderHumanScanReport } from "../reporters/human.js"
import { renderSarif } from "../reporters/sarif.js"
import { resolveDetectors, UnknownDetectorError } from "../scanners/registry.js"
import { Severity, type Verdict } from "../scanners/types.js"

// Re-exported so consumers importing from `commands/scan.js` (and the package
// index) keep working now that the strict resolver lives in the registry
// (shared across scan / audit / watch / MCP — PH-20261017-03).
export { UnknownDetectorError }

export interface ScanOptions {
  /** Output JSON instead of human-readable text */
  json: boolean
  /** Output SARIF 2.1.0 (mutually exclusive with json) */
  sarif: boolean
  /** Restrict to specific detectors (by name, CCI ID, or threat category) */
  detectors?: readonly string[]
  /** Treat WARN as FAIL. CLI true composes with policy: CLI wins on true. */
  strict: boolean
  /** --allow-fail=<id> values; appended to policy.allow as synthetic entries */
  allowFail?: readonly string[]
  /** Explicit policy file path. If undefined → discover then implicit default. */
  policyPath?: string
}

export interface ScanResult {
  filename: string
  verdicts: Verdict[]
  policySource: string
  evaluation: PolicyEvaluation
  exitCode: number
}

function applyCliOverridesToPolicy(policy: Policy, opts: ScanOptions): Policy {
  let merged = policy
  if (opts.strict && !policy.strict) {
    merged = { ...merged, strict: true }
  }
  if (opts.allowFail && opts.allowFail.length > 0) {
    const synthetic: PolicyAllowEntry[] = opts.allowFail.map((id) => ({
      reason: `--allow-fail=${id}`,
      files: ["**/*"],
      rules: [{ id }],
    }))
    merged = { ...merged, allow: [...merged.allow, ...synthetic] }
  }
  return merged
}

export function runScan(filename: string, content: string, opts: ScanOptions): ScanResult {
  // SECURITY (R14 / PH-20261017-03): a scan that selects ZERO detectors must
  // NEVER be reported clean. The shared strict resolver rejects any unknown id
  // (UnknownDetectorError) — no silent drop, no fallback-to-all.
  const selected = resolveDetectors(opts.detectors)

  const verdicts = selected.map((d) => d.run({ content, filename }))

  const resolved = resolvePolicy(opts.policyPath)
  const policy = applyCliOverridesToPolicy(resolved.policy, opts)
  const evaluation = applyPolicy(verdicts, policy, filename)

  return {
    filename,
    verdicts: evaluation.adjusted.map((a) => a.verdict),
    policySource: resolved.source,
    evaluation,
    exitCode: evaluation.exitCode,
  }
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

  let result: ScanResult
  try {
    result = runScan(filename, content, opts)
  } catch (err) {
    if (err instanceof UnknownDetectorError) {
      process.stderr.write(
        `phub scan: ${err.message}. A scan selecting zero detectors is NOT reported clean.\n` +
          `phub scan: valid ids are CCI-001…CCI-010, the t1…t10 names, or threat categories.\n`,
      )
      return 2
    }
    if (err instanceof PolicyLoadError) {
      process.stderr.write(`phub scan: policy error in ${err.source}: ${err.message}\n`)
      return 2
    }
    throw err
  }

  if (opts.sarif) {
    process.stdout.write(renderSarif(filename, result.verdicts) + "\n")
  } else if (opts.json) {
    const allowedHints = result.evaluation.adjusted.flatMap((a) =>
      a.allowedHints.map((ah) => ({
        cciId: a.verdict.cciId,
        line: ah.hint.line,
        snippet: ah.hint.snippet,
        detailTag: ah.hint.detailTag,
        reason: ah.allowEntry.reason,
      })),
    )
    process.stdout.write(
      JSON.stringify(
        {
          filename: result.filename,
          policySource: result.policySource,
          verdicts: result.verdicts,
          policyAllowed: allowedHints,
          summary: result.evaluation.summary,
        },
        null,
        2,
      ) + "\n",
    )
  } else {
    process.stdout.write(renderHumanScanReport(filename, result.verdicts) + "\n")
    if (result.evaluation.summary.suppressedFindingsCount > 0) {
      const n = result.evaluation.summary.suppressedFindingsCount
      const plural = n === 1 ? "" : "s"
      process.stdout.write(
        `\n  ${n} finding${plural} permitted by policy (${result.policySource}):\n`,
      )
      const seen = new Set<string>()
      for (const a of result.evaluation.adjusted) {
        for (const ah of a.allowedHints) {
          const key = `${a.verdict.cciId}::${ah.allowEntry.reason}`
          if (seen.has(key)) continue
          seen.add(key)
          process.stdout.write(`    [${a.verdict.cciId}] ${ah.allowEntry.reason}\n`)
        }
      }
    }
  }
  return result.exitCode
}

// Keep Severity in scope for downstream tests/types
export { Severity }
