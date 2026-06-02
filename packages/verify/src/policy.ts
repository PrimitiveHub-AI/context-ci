/**
 * Context CI policy evaluation — verification procedure step 7.
 *
 * The attestation predicate's `validation[]` block contains zero or
 * more verdict objects. Default policy: refuse the bundle if ANY
 * verdict has `severity === "fail"`.
 *
 * Advanced consumers can supply a custom `PolicyOpts` that:
 *   - Treats `warn` as `fail` (strict mode)
 *   - Allows a per-detector or per-CCI-ID override list
 *
 * Policy never silently passes a `fail` verdict. The Context Policy
 * Language v0.1 spec (forthcoming Phase 5.5 Week 6) will formalize
 * the YAML schema this object mirrors.
 */

export type Severity = "info" | "warn" | "fail"

export interface PredicateVerdict {
  detector_name: string
  threat_category: string
  severity: Severity
  passed: boolean
  summary?: string
  detector_version?: string
  diff_hints?: unknown[]
  cci_id?: string
}

export interface PolicyOpts {
  /** Treat `warn` verdicts as policy rejections too. Default: false. */
  strict?: boolean
  /**
   * Detector names (or CCI IDs) that are explicitly allowed to FAIL
   * without rejecting the bundle. Use sparingly + auditedly — this is
   * the "I know what I'm doing" override.
   */
  allowFailFor?: ReadonlyArray<string>
}

export interface PolicyEvaluation {
  /** True iff the bundle's verdicts satisfy the policy. */
  passed: boolean
  /** Verdicts that the policy treats as blockers. Empty when passed. */
  rejecting: PredicateVerdict[]
}

/**
 * Evaluate Context CI policy against a predicate's `validation[]` block.
 * Returns the verdicts that block (if any). Empty list = bundle allowed.
 */
export function evaluatePolicy(
  validation: PredicateVerdict[],
  opts: PolicyOpts = {},
): PolicyEvaluation {
  const blockingSeverities: Severity[] = opts.strict ? ["warn", "fail"] : ["fail"]
  const allow = new Set(opts.allowFailFor ?? [])

  const rejecting = validation.filter((v) => {
    if (!blockingSeverities.includes(v.severity)) return false
    if (allow.has(v.detector_name)) return false
    if (v.cci_id && allow.has(v.cci_id)) return false
    return true
  })

  return { passed: rejecting.length === 0, rejecting }
}

/**
 * Extract the `validation[]` block from an attestation predicate.
 * Returns an empty array if the predicate has none (legitimately
 * empty predicate, or pre-Phase-5 attestation).
 */
export function extractValidation(
  predicate: Record<string, unknown>,
): PredicateVerdict[] {
  const raw = predicate["validation"]
  if (!Array.isArray(raw)) return []
  return raw as PredicateVerdict[]
}
