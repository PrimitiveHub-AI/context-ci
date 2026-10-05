/**
 * MCP tool: `verify_before_load`
 *
 * The composite runtime gate. Per ADR-0029, every agent runtime that
 * loads agent-context primitives MUST consult this tool before reading
 * the content. Refuses-by-default for:
 *   - missing lock (operator hasn't sealed anything)
 *   - lock spec-version mismatch (Top 10 ratcheted; re-seal required)
 *   - drift (working tree differs from lock)
 *   - unattested artifacts (with requireAttestation set)
 *   - scanner findings (T1/T2/T5 at v0.1)
 *   - invalid Trust Bundle (when one is provided)
 *
 * Pure transport per ADR-0031 § 2 rule #1. Combines two existing
 * primitives:
 *   - `verifyBeforeLoad` from @primitivehub/phub  (workspace + lock + scan)
 *   - `verifyBundle` from @primitivehub/verify    (cryptographic bundle)
 *
 * If a future ADR changes any check semantics, it changes in phub /
 * verify; this file inherits the new behavior with zero edits.
 */

import { verifyBundle, type VerificationLevel } from "@primitivehub/verify"
import {
  verifyBeforeLoad,
  isBundleAuthenticated,
  unauthenticatedBundleMessage,
  UNAUTHENTICATED_BUNDLE_CODE,
  type VerifyBeforeLoadResult,
} from "@primitivehub/phub"

export const VERIFY_BEFORE_LOAD_TOOL = {
  name: "verify_before_load",
  description:
    "Composite runtime gate. Call this BEFORE loading any agent-context primitive — refuses-by-default for drift, unattested artifacts, scanner findings, or invalid Trust Bundles. Returns {safe, reasons[], checks}. The composite of check_lock + scan_text + (optional) verify_bundle.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: {
        type: "string",
        description:
          "The artifact path to gate (relative to workspace_root, or absolute). The agent's 'I'm about to read this file' anchor.",
      },
      workspace_root: {
        type: "string",
        description: "Workspace root. Defaults to the server's cwd.",
      },
      policy_path: {
        type: "string",
        description: "Path to .primitivehub/policy.yaml. Auto-discover if absent.",
      },
      lock_path: {
        type: "string",
        description: "Explicit lock path. Auto-discover if absent.",
      },
      require_attestation: {
        type: "boolean",
        description:
          "If true, an 'unattested' lock entry counts as unsafe. Use when consuming registry primitives that should carry rekor:* or registry:* attestations. Default false (matches v0.1 lock semantics).",
      },
      bundle: {
        description:
          "Optional Trust Bundle (JSON string OR parsed object). When provided, verify_bundle runs at the requested level and contributes its failures to the unsafe reasons.",
        oneOf: [{ type: "string" }, { type: "object" }],
      },
      level: {
        type: "string",
        enum: ["structural", "policy", "full"],
        description:
          "Bundle verification depth. Only meaningful when 'bundle' is provided. Default 'policy'.",
      },
    },
  },
} as const

interface VBLArgs {
  path: string
  workspace_root?: string
  policy_path?: string
  lock_path?: string
  require_attestation?: boolean
  bundle?: unknown
  level?: VerificationLevel
}

export interface VerifyBeforeLoadResultText {
  type: "text"
  text: string
}

export async function callVerifyBeforeLoad(
  rawArgs: unknown,
): Promise<{ content: VerifyBeforeLoadResultText[]; isError: boolean }> {
  const args = (rawArgs ?? {}) as VBLArgs

  if (typeof args.path !== "string" || args.path.length === 0) {
    return errorResponse("path argument is required (non-empty string)")
  }

  // Run the workspace/lock/scan gate first.
  let phubResult: VerifyBeforeLoadResult
  try {
    const opts: Parameters<typeof verifyBeforeLoad>[0] = {
      workspaceRoot: args.workspace_root ?? process.cwd(),
      path: args.path,
    }
    if (args.policy_path !== undefined) opts.policyPath = args.policy_path
    if (args.lock_path !== undefined) opts.lockPath = args.lock_path
    if (args.require_attestation !== undefined) opts.requireAttestation = args.require_attestation
    phubResult = verifyBeforeLoad(opts)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorResponse(`workspace gate failed: ${msg}`)
  }

  let safe = phubResult.safe
  const reasons: Array<{ code: string; message: string }> = [...phubResult.reasons]
  let bundleCheck: object | null = null

  // Optional bundle verification.
  if (args.bundle !== undefined) {
    let parsedBundle: unknown
    if (typeof args.bundle === "string") {
      try {
        parsedBundle = JSON.parse(args.bundle)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        reasons.push({
          code: "BUNDLE_PARSE_ERROR",
          message: `bundle string is not valid JSON: ${msg}`,
        })
        safe = false
        bundleCheck = { provided: true, parsed: false }
      }
    } else if (typeof args.bundle === "object" && args.bundle !== null) {
      parsedBundle = args.bundle
    } else {
      reasons.push({
        code: "BUNDLE_PARSE_ERROR",
        message: "bundle must be a JSON string or parsed object",
      })
      safe = false
      bundleCheck = { provided: true, parsed: false }
    }

    if (parsedBundle !== undefined) {
      const verifyResult = await verifyBundle(parsedBundle, { level: args.level ?? "policy" })
      // SECURITY (forged-bundle report, 2026-09-30): a supplied bundle is
      // part of the load-time trust decision. `valid` at structural/policy
      // authenticates nothing and is forgeable, so gate on real
      // authentication and fail closed — an unauthenticated bundle BLOCKS.
      const authenticated = isBundleAuthenticated(verifyResult)
      bundleCheck = {
        provided: true,
        parsed: true,
        valid: verifyResult.valid,
        authenticated,
        level: verifyResult.level,
        failureCodes: verifyResult.failures.map((f) => f.code),
        deferredSteps: verifyResult.deferredSteps,
      }
      if (!authenticated) {
        safe = false
        reasons.push({
          code: UNAUTHENTICATED_BUNDLE_CODE,
          message: unauthenticatedBundleMessage(verifyResult),
        })
      }
      if (!verifyResult.valid) {
        for (const f of verifyResult.failures) {
          reasons.push({
            code: `BUNDLE_${f.code}`,
            message: f.message + (f.path ? ` (at ${f.path})` : ""),
          })
        }
      }
    }
  } else {
    bundleCheck = { provided: false }
  }

  const payload = {
    safe,
    reasons,
    checks: {
      ...phubResult.checks,
      bundle: bundleCheck,
    },
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: !safe,
  }
}

function errorResponse(message: string): {
  content: VerifyBeforeLoadResultText[]
  isError: true
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { safe: false, reasons: [{ code: "USAGE_ERROR", message }], checks: null },
          null,
          2,
        ),
      },
    ],
    isError: true,
  }
}
