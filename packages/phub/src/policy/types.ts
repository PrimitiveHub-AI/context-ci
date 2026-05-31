/**
 * Context Policy Language v0.1 — TS types mirroring the YAML schema.
 *
 * Source of truth: docs/context-policy-v0.1.md § 4.
 * JSON Schema: docs/context-policy/conformance/schema/v0.1.json
 * (vendored at packages/phub/src/policy/schema-v0.1.ts).
 */

export type PolicySeverity = "error" | "warning" | "note" | "off"

export interface PolicyRuleConfig {
  severity?: PolicySeverity
}

export interface PolicyAllowRule {
  /** CCI ID, detector name, threat category, or "*" */
  id: string
  /** Specific detailTag values to allow; omitted/empty = all */
  detail_tags?: readonly string[]
}

export interface PolicyAllowEntry {
  /** Free-text justification — REQUIRED per spec § 4.1 */
  reason: string
  /** File-path glob patterns; at least one required */
  files: readonly string[]
  /** Rule selectors; at least one required */
  rules: readonly PolicyAllowRule[]
}

export interface Policy {
  /** Always "0.1" in this spec version */
  version: "0.1"
  /** If true, warning → fail in exit-code logic. Default false. */
  strict: boolean
  /** Per-rule severity overrides. Empty object = all defaults. */
  rules: Readonly<Record<string, PolicyRuleConfig>>
  /** Allow exceptions */
  allow: readonly PolicyAllowEntry[]
}

/**
 * The implicit default policy (spec § 7) — what's applied when no
 * policy file is provided. Equivalent to `phub scan` pre-policy
 * behavior.
 */
export const IMPLICIT_DEFAULT_POLICY: Policy = {
  version: "0.1",
  strict: false,
  rules: {
    "CCI-001": { severity: "error" },
    "CCI-002": { severity: "error" },
    "CCI-005": { severity: "error" },
  },
  allow: [],
}

export class PolicyLoadError extends Error {
  constructor(
    message: string,
    readonly source: string,
  ) {
    super(message)
    this.name = "PolicyLoadError"
  }
}
