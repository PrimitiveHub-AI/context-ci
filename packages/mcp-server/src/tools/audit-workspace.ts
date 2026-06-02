/**
 * MCP tool: `audit_workspace`
 *
 * Active-surface audit: discovers + classifies + scans every agent-
 * context artifact under a root path. Pure transport over
 * `@primitivehub/phub`'s `runAudit` (ADR-0025).
 *
 * The agent uses this to ask "what context primitives are loadable in
 * my workspace, and which trip Context CI v0.1?" — the answer it can
 * never get from a file-at-a-time scan because the threat model is
 * the file the agent didn't know about.
 */

import {
  runAudit,
  type AuditOptions,
  type AuditResult,
  type AuditedArtifact,
} from "@primitivehub/phub"

export const AUDIT_WORKSPACE_TOOL = {
  name: "audit_workspace",
  description:
    "Recursively discover, classify, and scan every agent-context artifact (AGENTS.md, CLAUDE.md, .cursorrules, .claude/skills/**, mcp.json, …) under a root path. Reuses the same T1/T2/T5 detector roster as scan_text. Returns inventory + per-artifact verdicts + project-level summary. Use this as the active default — file-at-a-time scanning can't defend against files the agent didn't know about.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      root: {
        type: "string",
        description: "Directory to audit. Defaults to the server's cwd.",
      },
      max_files: {
        type: "number",
        description: "Hard cap on artifacts traversed. Default 10000.",
      },
      max_depth: {
        type: "number",
        description: "Maximum directory depth from root. Default 16.",
      },
      strict: { type: "boolean", description: "Treat WARN verdicts as FAIL." },
      detectors: {
        type: "array",
        items: { type: "string" },
        description:
          "Restrict to specific detectors. Accepts names / CCI IDs / threat categories.",
      },
      policy_path: {
        type: "string",
        description:
          "Path to a .primitivehub/policy.yaml. Without this: auto-discover from cwd → git root.",
      },
      allow_fail: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const

interface AuditWorkspaceArgs {
  root?: string
  max_files?: number
  max_depth?: number
  strict?: boolean
  detectors?: readonly string[]
  policy_path?: string
  allow_fail?: readonly string[]
}

export interface AuditWorkspaceResultText {
  type: "text"
  text: string
}

function summarize(result: AuditResult): object {
  return {
    root: result.root,
    policySource: result.policySource,
    truncated: result.truncated,
    scanClean: result.scanClean,
    exitCode: result.exitCode,
    summary: result.summary,
    artifacts: result.artifacts.map((a: AuditedArtifact) => ({
      path: a.path,
      classification: a.classification,
      digest: a.digest,
      scanned: a.scanned,
      flagged: a.flagged,
      // Surface the post-policy verdicts only — these are what an
      // agent acts on. Raw pre-policy verdicts are available via
      // scan_text against the artifact path if needed.
      verdicts: a.adjustedVerdicts.map((adj) => ({
        cciId: adj.verdict.cciId,
        severity: adj.verdict.severity,
        passed: adj.verdict.passed,
        summary: adj.verdict.summary,
        diffHints: adj.verdict.diffHints,
        allowedHints: adj.allowedHints.map((ah) => ({
          line: ah.hint.line,
          snippet: ah.hint.snippet,
          detailTag: ah.hint.detailTag,
          reason: ah.allowEntry.reason,
        })),
      })),
    })),
  }
}

export function callAuditWorkspace(
  rawArgs: unknown,
): { content: AuditWorkspaceResultText[]; isError: boolean } {
  const args = (rawArgs ?? {}) as AuditWorkspaceArgs

  const auditOpts: AuditOptions = {
    json: true,
    sarif: false,
    strict: args.strict ?? false,
    detectors: args.detectors ?? [],
    maxFiles: args.max_files ?? 10000,
    maxDepth: args.max_depth ?? 16,
  }
  if (args.policy_path !== undefined) auditOpts.policyPath = args.policy_path
  if (args.allow_fail !== undefined) auditOpts.allowFailFor = args.allow_fail

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

  return {
    content: [{ type: "text", text: JSON.stringify(summarize(result), null, 2) }],
    isError: result.exitCode !== 0,
  }
}
