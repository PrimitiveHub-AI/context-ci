/**
 * MCP tool: `check_lock`
 *
 * Compares the working tree against `.primitivehub/phub.lock`
 * (ADR-0026) and reports drift. Pure transport over phub's audit
 * surface with lockMode = "check".
 *
 * Foreshadows ADR-0029 (MCP runtime gate `verify_before_load`):
 * the runtime gate is "check_lock + refuse-to-load on drift" applied
 * at the agent's read time. This tool gives the agent the data;
 * the gate is built when ADR-0029 lands.
 */

import {
  runAudit,
  type AuditOptions,
  type AuditResult,
} from "@primitivehub/phub"

export const CHECK_LOCK_TOOL = {
  name: "check_lock",
  description:
    "Compare the workspace against .primitivehub/phub.lock and report drift (added / modified / removed / reclassified artifacts). Use this BEFORE consuming any agent-context primitive — drift means an artifact changed since the operator last sealed it. Returns drift summary; the agent decides whether to proceed.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      root: {
        type: "string",
        description: "Workspace root to check. Defaults to server cwd.",
      },
      lock_path: {
        type: "string",
        description:
          "Override the auto-discovered lock path. Without this: ./.primitivehub/phub.lock.",
      },
      policy_path: {
        type: "string",
        description: "Policy file path (same semantics as scan_text/audit_workspace).",
      },
      max_files: { type: "number", description: "Hard cap on artifacts walked. Default 10000." },
      max_depth: { type: "number", description: "Max directory depth. Default 16." },
    },
  },
} as const

interface CheckLockArgs {
  root?: string
  lock_path?: string
  policy_path?: string
  max_files?: number
  max_depth?: number
}

export interface CheckLockResultText {
  type: "text"
  text: string
}

export function callCheckLock(
  rawArgs: unknown,
): { content: CheckLockResultText[]; isError: boolean } {
  const args = (rawArgs ?? {}) as CheckLockArgs

  const auditOpts: AuditOptions = {
    json: true,
    sarif: false,
    strict: false,
    detectors: [],
    maxFiles: args.max_files ?? 10000,
    maxDepth: args.max_depth ?? 16,
    lockMode: "check",
  }
  if (args.lock_path !== undefined) auditOpts.lockPath = args.lock_path
  if (args.policy_path !== undefined) auditOpts.policyPath = args.policy_path

  let result: AuditResult
  try {
    result = runAudit(args.root ?? process.cwd(), auditOpts)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }],
      isError: true,
    }
  }

  const lockState = result.lockState
  const payload = {
    root: result.root,
    lockMode: lockState?.mode ?? "off",
    lockPath: lockState?.lockPath ?? null,
    missing: lockState?.missing ?? false,
    specVersionMismatch: lockState?.specVersionMismatch ?? false,
    hasDrift: lockState?.hasDrift ?? false,
    drift: lockState?.drift ?? null,
    artifactCount: result.artifacts.length,
    scanClean: result.scanClean,
    exitCode: result.exitCode,
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: result.exitCode !== 0,
  }
}
