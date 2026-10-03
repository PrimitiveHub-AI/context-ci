/**
 * `phub verify-before-load <path...>` — the CLI leg of the inline Context
 * Firewall. A thin transport over the tested `verifyBeforeLoad` core
 * (same engine the MCP `verify_before_load` tool and the `phub-scan`
 * gate-mode action call). No trust logic here — this file only maps one
 * or more paths to the composite gate, renders a crisp verdict, and owns
 * the exit code.
 *
 * Exit codes (the CI contract):
 *   0  every path is safe, OR the only failures are posture-tier
 *      (unsealed) AND --allow-unsealed was passed
 *   1  at least one path carries a block-tier reason (tamper / drift /
 *      live scanner finding / demanded-but-absent attestation), OR a path
 *      is unsealed and --allow-unsealed was NOT passed
 *   2  usage error (no paths) — raised by the cli.ts dispatcher
 */

import {
  verifyBeforeLoad,
  hasBlockingReason,
  type VerifyBeforeLoadResult,
} from "./verify-before-load.js"
import {
  renderHumanVerifyBeforeLoadReport,
  type VerifyBeforeLoadReport,
} from "../reporters/human.js"

export interface VerifyBeforeLoadCommandOptions {
  /** Absolute workspace root. Defaults to cwd in the dispatcher. */
  workspaceRoot: string
  /** Emit machine-readable JSON instead of the human report. */
  json: boolean
  /** Promote `unattested` lock entries to a block-tier failure. */
  requireAttestation: boolean
  /** Treat posture-only (unsealed) failures as a pass with a warning. */
  allowUnsealed: boolean
  /** Optional explicit policy path. */
  policyPath?: string
  /** Optional explicit lock path. */
  lockPath?: string
}

type Verdict = "safe" | "blocked" | "unsealed"

function verdictOf(result: VerifyBeforeLoadResult): Verdict {
  if (result.safe) return "safe"
  return hasBlockingReason(result) ? "blocked" : "unsealed"
}

export function verifyBeforeLoadCommand(
  paths: readonly string[],
  opts: VerifyBeforeLoadCommandOptions,
): number {
  const reports: VerifyBeforeLoadReport[] = paths.map((path) => {
    const gateOpts: Parameters<typeof verifyBeforeLoad>[0] = {
      workspaceRoot: opts.workspaceRoot,
      path,
      requireAttestation: opts.requireAttestation,
    }
    if (opts.policyPath !== undefined) gateOpts.policyPath = opts.policyPath
    if (opts.lockPath !== undefined) gateOpts.lockPath = opts.lockPath
    return { path, result: verifyBeforeLoad(gateOpts) }
  })

  // A path fails the gate unless it is safe, or unsealed-only under
  // --allow-unsealed. Block-tier always fails regardless of the flag.
  const failed = reports.filter(({ result }) => {
    const v = verdictOf(result)
    if (v === "safe") return false
    if (v === "unsealed") return !opts.allowUnsealed
    return true
  })

  if (opts.json) {
    const payload = {
      gate: "verify-before-load",
      allowUnsealed: opts.allowUnsealed,
      blocked: failed.length > 0,
      results: reports.map(({ path, result }) => ({
        path,
        verdict: verdictOf(result),
        safe: result.safe,
        reasons: result.reasons,
        checks: result.checks,
      })),
    }
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
  } else {
    process.stdout.write(
      renderHumanVerifyBeforeLoadReport(reports, { allowUnsealed: opts.allowUnsealed }) + "\n",
    )
  }

  return failed.length > 0 ? 1 : 0
}
