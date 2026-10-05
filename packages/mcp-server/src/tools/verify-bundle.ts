/**
 * MCP tool: `verify_bundle`
 *
 * Thin wrapper around `@primitivehub/verify`'s `verifyBundle`.
 * Zero custom trust logic — every behavioral question is delegated
 * to the verify reference implementation (ADR-0020).
 *
 * Tool input/output schemas mirror the verify library's public types.
 * When verify v0.2 unstubs cryptographic steps 3-6, this tool gets
 * the new behavior for free.
 */

import { verifyBundle, type VerificationLevel } from "@primitivehub/verify"
import { isBundleAuthenticated, unauthenticatedBundleMessage } from "@primitivehub/phub"

export const VERIFY_BUNDLE_TOOL = {
  name: "verify_bundle",
  description:
    "Verify a PrimitiveHub Trust Bundle against the v0.1 wire format. Runs schema validation, content-digest verification, and Context CI policy evaluation. Steps 3-6 (signature/cert/Rekor) are stubbed in v0.1 — pass level: 'full' to see DEFERRED failures. All verification runs locally; no network calls.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["bundle"],
    properties: {
      bundle: {
        description: "The Trust Bundle as a JSON string OR a pre-parsed JSON object. Strings are JSON.parse'd before verification.",
        oneOf: [{ type: "string" }, { type: "object" }],
      },
      level: {
        type: "string",
        enum: ["structural", "policy", "full"],
        description:
          "Verification depth. 'structural' = schema + digest (steps 1+2). 'policy' (default) = + Context CI policy (steps 1+2+7). 'full' = + signature/cert/Rekor (steps 1-7; steps 3-6 stubbed in v0.1).",
      },
      strict: {
        type: "boolean",
        description: "Treat predicate WARN verdicts as FAIL during policy evaluation.",
      },
      allow_fail_for: {
        type: "array",
        items: { type: "string" },
        description:
          "Detector names, CCI IDs, or threat categories that are permitted to FAIL without rejecting the bundle.",
      },
    },
  },
} as const

interface VerifyBundleArgs {
  bundle: unknown
  level?: VerificationLevel
  strict?: boolean
  allow_fail_for?: readonly string[]
}

export interface VerifyBundleResultText {
  type: "text"
  text: string
}

/** Call shape for the MCP server's CallToolRequestSchema handler. */
export async function callVerifyBundle(
  rawArgs: unknown,
): Promise<{ content: VerifyBundleResultText[]; isError: boolean }> {
  const args = (rawArgs ?? {}) as VerifyBundleArgs

  let parsedBundle: unknown
  if (typeof args.bundle === "string") {
    try {
      parsedBundle = JSON.parse(args.bundle)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorResponse(`bundle string is not valid JSON: ${msg}`)
    }
  } else if (typeof args.bundle === "object" && args.bundle !== null) {
    parsedBundle = args.bundle
  } else {
    return errorResponse("bundle argument is required (string or object)")
  }

  const result = await verifyBundle(parsedBundle, {
    level: args.level ?? "policy",
    policy: {
      strict: args.strict ?? false,
      allowFailFor: args.allow_fail_for ?? [],
    },
  })

  // SECURITY (forged-bundle report, 2026-09-30): `valid` at the
  // structural/policy levels authenticates NOTHING — an agent must not
  // treat it as a trust verdict. Surface a separate `authenticated`
  // flag and fail closed (isError) unless the bundle was actually
  // cryptographically verified. See @primitivehub/phub isBundleAuthenticated.
  const authenticated = isBundleAuthenticated(result)
  const payload = {
    ...result,
    authenticated,
    trust: authenticated
      ? "AUTHENTICATED"
      : "INSPECTED_NOT_AUTHENTICATED",
    securityNote: authenticated ? undefined : unauthenticatedBundleMessage(result),
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: !authenticated,
  }
}

function errorResponse(message: string): { content: VerifyBundleResultText[]; isError: true } {
  return {
    content: [{ type: "text", text: JSON.stringify({ valid: false, error: message }, null, 2) }],
    isError: true,
  }
}
