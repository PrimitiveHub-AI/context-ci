/**
 * in-toto Statement binding — @primitivehub/verify v0.2 Phase 1 (closes R09/R10).
 *
 * The Sigstore signature (verified in Phase 2) is over the in-toto **Statement**
 * bytes, NOT over the content directly. So a valid signature only authenticates
 * THIS bundle's content if the Statement's subject digest IS this content's
 * digest. This module decodes + validates the Statement and binds its subject to
 * the already-verified content digest, so Phase 2's signature check cannot
 * authenticate a signature made over some OTHER artifact (R10) or carrying an
 * unexpected predicate (R09).
 *
 * No external dependencies — pure parsing + binding.
 */

import { type VerificationFailure } from "./errors.js"

/** in-toto Statement type URIs v0.2 accepts (v1 + the historical v0.1 marker). */
const STATEMENT_TYPES: ReadonlySet<string> = new Set([
  "https://in-toto.io/Statement/v1",
  "https://in-toto.io/Statement/v0.1",
])

/**
 * predicateTypes v0.2 accepts. The Context CI Attestation predicate is the only
 * one we issue; an unknown predicateType is REFUSED, not trusted (R09). Extend
 * deliberately.
 */
export const ALLOWED_PREDICATE_TYPES: ReadonlySet<string> = new Set([
  "https://primitivehub.ai/attestations/context-ci/v1",
])

interface InTotoStatement {
  _type: string
  subject: Array<{ name?: string; digest?: Record<string, string> }>
  predicateType: string
  predicate?: unknown
}

/** Decode base64 → UTF-8 (Node Buffer or browser atob). */
function b64ToUtf8(b64: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8")
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/**
 * Validate the in-toto Statement and bind its subject to the content digest.
 * Returns failures (empty = binding OK). Does NOT verify the signature (Phase 2)
 * — only that a valid signature WOULD authenticate THIS content under an allowed
 * predicate.
 *
 * @param statementB64 `attestation.statementB64`
 * @param contentDigestHex the already-verified sha256 hex of the bundle content
 * @param declaredPredicateType `attestation.predicateType` (must match the Statement)
 */
export function verifyStatementBinding(
  statementB64: string,
  contentDigestHex: string,
  declaredPredicateType: string,
): VerificationFailure[] {
  const fail = (
    code: VerificationFailure["code"],
    message: string,
    cause?: unknown,
  ): VerificationFailure[] => [
    {
      step: "statement",
      code,
      message,
      path: "attestation.statementB64",
      ...(cause !== undefined ? { cause } : {}),
    },
  ]

  let stmt: InTotoStatement
  try {
    stmt = JSON.parse(b64ToUtf8(statementB64)) as InTotoStatement
  } catch (cause) {
    return fail("STATEMENT_DECODE_FAILED", "attestation.statementB64 is not base64-encoded JSON", cause)
  }

  if (typeof stmt !== "object" || stmt === null || !STATEMENT_TYPES.has(stmt._type)) {
    const t = (stmt as { _type?: unknown })?._type
    return fail("STATEMENT_INVALID", `not an in-toto Statement (_type=${JSON.stringify(t)})`)
  }
  if (!Array.isArray(stmt.subject) || stmt.subject.length === 0) {
    return fail("STATEMENT_INVALID", "Statement has no subject[]")
  }
  if (typeof stmt.predicateType !== "string") {
    return fail("STATEMENT_INVALID", "Statement has no predicateType")
  }

  // R09: predicateType must match the bundle's declared type AND be allowed.
  if (stmt.predicateType !== declaredPredicateType) {
    return fail(
      "STATEMENT_PREDICATE_TYPE_MISMATCH",
      `Statement predicateType '${stmt.predicateType}' != bundle attestation.predicateType '${declaredPredicateType}'`,
    )
  }
  if (!ALLOWED_PREDICATE_TYPES.has(stmt.predicateType)) {
    return fail(
      "STATEMENT_PREDICATE_TYPE_MISMATCH",
      `predicateType '${stmt.predicateType}' is not in the v0.2 allow-list`,
    )
  }

  // R10: the SIGNED subject digest MUST be this content. A signature over some
  // other artifact's Statement must not authenticate this bundle's content.
  const bound = stmt.subject.some(
    (s) =>
      typeof s?.digest?.sha256 === "string" &&
      s.digest.sha256.toLowerCase() === contentDigestHex.toLowerCase(),
  )
  if (!bound) {
    const seen = stmt.subject.map((s) => s?.digest?.sha256 ?? "<none>").join(", ")
    return fail(
      "STATEMENT_SUBJECT_MISMATCH",
      `no Statement subject digest matches the content digest ${contentDigestHex} (subjects: ${seen}) — the signature does not attest to this content`,
    )
  }

  return []
}
