/**
 * MCP tool: `scan_text`
 *
 * Runs the Context CI Top 10 v0.1 detector roster (T1/T2/T5) against
 * arbitrary text. Pure transport over `@primitivehub/phub`'s `runScan`.
 *
 * The agent passes the text it's about to consume (e.g. a freshly
 * downloaded AGENTS.md, an MCP server's response, a copied skill);
 * the tool returns the post-policy verdicts. The agent decides what
 * to do with the result.
 */

import { runScan, UnknownDetectorError, type ScanOptions } from "@primitivehub/phub"

export const SCAN_TEXT_TOOL = {
  name: "scan_text",
  description:
    "Run the PrimitiveHub Context CI Top 10 v0.1 detectors (T1 prompt-injection, T2 Unicode-steganography, T5 unsafe-shell-install) against a string. Pure-local scan; no network. Returns per-detector verdicts, post-policy. Use this BEFORE loading any agent-context content from an untrusted source.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["content"],
    properties: {
      content: {
        type: "string",
        description: "The text to scan (typically markdown — AGENTS.md, CLAUDE.md, .cursorrules, a skill body, etc.).",
      },
      filename: {
        type: "string",
        description:
          "Optional filename for the content (used for policy matching against per-file allow rules). Defaults to '<inline>'.",
      },
      detectors: {
        type: "array",
        items: { type: "string" },
        description:
          "Restrict to specific detectors. Accepts detector names (t1.prompt_injection), CCI IDs (CCI-001), or threat categories (T1). Empty/omitted = all.",
      },
      strict: {
        type: "boolean",
        description: "Treat WARN verdicts as FAIL for the policy exit code.",
      },
      policy_path: {
        type: "string",
        description:
          "Path to a .primitivehub/policy.yaml file (ADR-0018). Without this: auto-discover from cwd → git root, fall back to implicit default.",
      },
      allow_fail: {
        type: "array",
        items: { type: "string" },
        description:
          "Detector/CCI/threat IDs permitted to FAIL without rejecting the scan. Appended to policy.allow as synthetic entries.",
      },
    },
  },
} as const

interface ScanTextArgs {
  content: string
  filename?: string
  detectors?: readonly string[]
  strict?: boolean
  policy_path?: string
  allow_fail?: readonly string[]
}

export interface ScanTextResultText {
  type: "text"
  text: string
}

export function callScanText(
  rawArgs: unknown,
): { content: ScanTextResultText[]; isError: boolean } {
  const args = (rawArgs ?? {}) as ScanTextArgs

  if (typeof args.content !== "string") {
    return errorResponse("content argument is required (string)")
  }

  const filename = args.filename ?? "<inline>"
  const scanOpts: ScanOptions = {
    json: true,
    sarif: false,
    strict: args.strict ?? false,
    detectors: args.detectors ?? [],
    allowFail: args.allow_fail ?? [],
  }
  if (args.policy_path !== undefined) {
    scanOpts.policyPath = args.policy_path
  }

  // SECURITY (R14): an unknown detector id must NOT yield an empty, clean-
  // looking scan. Fail safe with isError instead of reporting zero verdicts.
  let result
  try {
    result = runScan(filename, args.content, scanOpts)
  } catch (err) {
    if (err instanceof UnknownDetectorError) {
      return errorResponse(`${err.message} — refusing to report a zero-detector scan as clean`)
    }
    throw err
  }

  const summary = result.evaluation.summary
  const allowed = result.evaluation.adjusted.flatMap((a) =>
    a.allowedHints.map((ah) => ({
      cciId: a.verdict.cciId,
      line: ah.hint.line,
      snippet: ah.hint.snippet,
      detailTag: ah.hint.detailTag,
      reason: ah.allowEntry.reason,
    })),
  )

  const payload = {
    filename: result.filename,
    policySource: result.policySource,
    verdicts: result.verdicts,
    policyAllowed: allowed,
    summary,
    exitCode: result.exitCode,
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: result.exitCode !== 0,
  }
}

function errorResponse(message: string): { content: ScanTextResultText[]; isError: true } {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  }
}
