/**
 * Verification error taxonomy.
 *
 * Every rejection path returns a `VerificationError` with a stable
 * `code` field so consumers can branch on the failure mode without
 * string-matching messages. Codes are stable across patch + minor
 * versions per ADR-0015; new codes can be added in minor bumps,
 * existing codes never change meaning.
 */

export type VerificationErrorCode =
  // Step 1: schema validation
  | "SCHEMA_INVALID"
  | "UNKNOWN_BUNDLE_VERSION"
  | "UNKNOWN_BACKEND"
  // Step 2: content / digest
  | "CONTENT_DECODE_FAILED"
  | "SIZE_MISMATCH"
  | "DIGEST_MISMATCH"
  // Step 3: in-toto Statement binding (v0.2 Phase 1 — R09/R10)
  | "STATEMENT_DECODE_FAILED"
  | "STATEMENT_INVALID"
  | "STATEMENT_SUBJECT_MISMATCH"
  | "STATEMENT_PREDICATE_TYPE_MISMATCH"
  // Step 4–6: cryptographic verification (v0.1: stubbed)
  | "SIGNATURE_VERIFICATION_DEFERRED"
  | "CERT_CHAIN_VERIFICATION_DEFERRED"
  | "REKOR_INCLUSION_PROOF_DEFERRED"
  // Step 7: Context CI policy
  | "POLICY_REJECTED"

export interface VerificationErrorDetail {
  /** Stable identifier per the enum above. */
  code: VerificationErrorCode
  /** Human-readable explanation. NOT stable; for logs + UI only. */
  message: string
  /** Optional structured pointer (e.g. JSON path) the error refers to. */
  path?: string
  /** Optional cause (the underlying error if there was one). */
  cause?: unknown
}

export class VerificationError extends Error {
  readonly code: VerificationErrorCode
  readonly path?: string

  constructor(detail: VerificationErrorDetail) {
    super(`[${detail.code}] ${detail.message}${detail.path ? ` (at ${detail.path})` : ""}`)
    this.name = "VerificationError"
    this.code = detail.code
    if (detail.path !== undefined) this.path = detail.path
    if (detail.cause !== undefined) (this as { cause?: unknown }).cause = detail.cause
  }
}

/** A failure plus the step at which it was detected. */
export interface VerificationFailure extends VerificationErrorDetail {
  /** Which step of the verification procedure rejected the bundle. */
  step: "schema" | "digest" | "statement" | "signature" | "cert" | "rekor" | "policy"
}
