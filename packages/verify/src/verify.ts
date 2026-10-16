/**
 * Trust Bundle v0.1 verification orchestrator — implements the
 * normative 7-step procedure from `docs/trust-contract-v0.1.md` § 7.
 *
 * v0.1 implements steps 1, 2, and 7 fully:
 *   1. Schema validation        — via src/schema.ts
 *   2. Re-hash the content      — via src/digest.ts
 *   7. Apply Context CI policy  — via src/policy.ts
 *
 * Steps 3–6 (in-toto Statement parse + signature + cert chain +
 * Rekor inclusion proof) require Sigstore-aware cryptographic
 * primitives. They are STUBBED in v0.1 of this library — each
 * returns a `*_DEFERRED` failure when its corresponding verification
 * level is requested. The README documents this as a known
 * limitation; v0.2 brings real Sigstore verification.
 *
 * Per ADR-0021 the conformance suite is the executable contract;
 * v0.1 of this library is conformant to the SUBSET of the suite
 * that exercises steps 1, 2, 7. Steps 3-6 fixtures (when they
 * exist) are skipped in the conformance harness.
 */

import { base64ToBytes, parseSha256Digest, sha256Hex } from "./digest.js"
import type { VerificationFailure } from "./errors.js"
import schemaJson from "../schema/v0.1.json" with { type: "json" }
import { evaluatePolicy, extractValidation, type PolicyOpts } from "./policy.js"
import { validateAgainstSchema } from "./schema.js"
import type { TrustBundle } from "./types.js"

const TRUST_BUNDLE_SCHEMA = schemaJson as Record<string, unknown>

/**
 * Verification level — what depth of the 7-step procedure to run.
 *
 *   "structural"  → steps 1 + 2 only (schema + digest). Fast, offline,
 *                   no crypto required. Catches T9 storage corruption
 *                   and malformed bundles. Default for v0.1.
 *   "policy"      → structural + step 7. Adds Context CI policy
 *                   evaluation against the predicate's validation[]
 *                   block.
 *   "full"        → all 7 steps. v0.1 returns *_DEFERRED failures
 *                   for steps 3-6 because Sigstore crypto isn't yet
 *                   wired in this library.
 */
export type VerificationLevel = "structural" | "policy" | "full"

export interface VerifyOptions {
  /** Default: "policy". */
  level?: VerificationLevel
  /** Context CI policy options (only applied when level >= "policy"). */
  policy?: PolicyOpts
}

export interface VerificationResult {
  /**
   * TRUSTED: the bundle is both inspected AND cryptographically
   * authenticated — i.e. `valid === inspected && authenticated`.
   *
   * SECURITY (PH-SEC-001 / forged-bundle report): `valid` is the single
   * trust verdict and it **fails closed**. Because v0.1 stubs the crypto
   * (steps 3-6), `authenticated` is always false, so **`valid` is always
   * false in v0.1** — a structural/policy pass alone is NEVER reported as
   * valid. A forged, digest-consistent bundle therefore never comes back
   * `valid:true`, even to a third party that only checks this field.
   */
  valid: boolean
  /**
   * The requested level's NON-cryptographic checks passed (schema +
   * content-digest [+ Context CI policy]). This is an inspection signal,
   * NOT a trust signal: a forged bundle passes inspection. Use it for
   * diagnostics ("the bytes are well-formed and self-consistent"), never
   * as authorization.
   */
  inspected: boolean
  /**
   * The bundle was cryptographically authenticated end-to-end — the
   * in-toto statement, signature, certificate chain, and Rekor inclusion
   * proof all actually verified.
   *
   * v0.1 stubs steps 3-6, so this is ALWAYS `false` today: the library
   * fails closed. When v0.2 wires real Sigstore crypto, a genuinely
   * signed bundle verified at `full` level sets this (and thus `valid`)
   * `true`.
   */
  authenticated: boolean
  /** All failures detected. Empty when inspected + authenticated. */
  failures: VerificationFailure[]
  /** Echo back what level was actually evaluated. */
  level: VerificationLevel
  /**
   * When level is "full" and v0.1 stubs apply, this lists the steps
   * that were not actually performed. Consumers SHOULD treat the
   * verdict as advisory when this array is non-empty.
   */
  deferredSteps: ReadonlyArray<"signature" | "cert" | "rekor" | "statement">
}

/**
 * Verify a Trust Bundle. Returns `{ valid, failures, level, deferredSteps }`.
 * Never throws on a verification failure — failures are data. Throws
 * only on programmer error (e.g. malformed `opts`).
 *
 * Bundle input is `unknown` so consumers can feed parsed JSON without
 * pre-validation. The schema step handles "this isn't even a bundle"
 * cases with the same `SCHEMA_INVALID` codes.
 */
export async function verifyBundle(
  bundle: unknown,
  opts: VerifyOptions = {},
): Promise<VerificationResult> {
  const level = opts.level ?? "policy"
  const failures: VerificationFailure[] = []
  const deferredSteps: ("signature" | "cert" | "rekor" | "statement")[] = []

  // ── Step 1: schema validation ──────────────────────────────────
  const schemaResult = validateAgainstSchema(bundle, TRUST_BUNDLE_SCHEMA)
  failures.push(...schemaResult.failures)
  if (!schemaResult.valid) {
    return { valid: false, inspected: false, authenticated: false, failures, level, deferredSteps }
  }

  // Past schema we can narrow the type.
  const b = bundle as TrustBundle

  // ── Step 2: re-hash content ─────────────────────────────────────
  let contentBytes: Uint8Array
  try {
    contentBytes = base64ToBytes(b.content.bytesB64)
  } catch (cause) {
    failures.push({
      step: "digest",
      code: "CONTENT_DECODE_FAILED",
      message: "content.bytesB64 is not valid base64",
      path: "content.bytesB64",
      cause,
    })
    return { valid: false, inspected: false, authenticated: false, failures, level, deferredSteps }
  }

  if (contentBytes.byteLength !== b.content.sizeBytes) {
    failures.push({
      step: "digest",
      code: "SIZE_MISMATCH",
      message: `decoded content is ${contentBytes.byteLength} bytes; sizeBytes claims ${b.content.sizeBytes}`,
      path: "content.sizeBytes",
    })
    return { valid: false, inspected: false, authenticated: false, failures, level, deferredSteps }
  }

  let expectedHex: string
  try {
    expectedHex = parseSha256Digest(b.subject.contentDigest)
  } catch (cause) {
    failures.push({
      step: "digest",
      code: "SCHEMA_INVALID",
      message: `subject.contentDigest not parseable as sha256: ${b.subject.contentDigest}`,
      path: "subject.contentDigest",
      cause,
    })
    return { valid: false, inspected: false, authenticated: false, failures, level, deferredSteps }
  }

  const actualHex = await sha256Hex(contentBytes)
  if (actualHex !== expectedHex) {
    failures.push({
      step: "digest",
      code: "DIGEST_MISMATCH",
      message: `content sha256 does not match subject.contentDigest (got ${actualHex}, expected ${expectedHex})`,
      path: "subject.contentDigest",
    })
    return { valid: false, inspected: false, authenticated: false, failures, level, deferredSteps }
  }

  if (level === "structural") {
    // structural/policy never attempt crypto → never authenticated.
  // inspection passed/failed per `failures`; authenticated=false in v0.1,
  // so valid = inspected && authenticated = false (fail closed).
  return { valid: false, inspected: failures.length === 0, authenticated: false, failures, level, deferredSteps }
  }

  // ── Steps 3–6 (deferred in v0.1) ────────────────────────────────
  if (level === "full") {
    deferredSteps.push("statement", "signature", "cert", "rekor")
    failures.push({
      step: "statement",
      code: "STATEMENT_DECODE_FAILED",
      message: "v0.1 of @primitivehub/verify does not yet decode in-toto Statement protobuf bytes; treat full-verification result as advisory",
      path: "attestation.statementB64",
    })
    failures.push({
      step: "signature",
      code: "SIGNATURE_VERIFICATION_DEFERRED",
      message: "v0.1 does not yet perform cryptographic signature verification; structural verification has passed",
      path: "attestation.signatureB64",
    })
    failures.push({
      step: "cert",
      code: "CERT_CHAIN_VERIFICATION_DEFERRED",
      message: "v0.1 does not yet walk the cert chain to Sigstore trust roots",
      path: "attestation.certChainPem",
    })
    failures.push({
      step: "rekor",
      code: "REKOR_INCLUSION_PROOF_DEFERRED",
      message: "v0.1 does not yet verify Rekor Merkle inclusion proofs",
      path: "attestation.rekorInclusionProofJson",
    })
    // Full-level: schema+digest passed (inspected), but steps 3-6 are
    // stubbed so nothing was authenticated. valid = inspected && auth =
    // false → fail closed. v0.2 replaces the deferred pushes above with
    // real Sigstore verification and sets authenticated accordingly.
    return { valid: false, inspected: true, authenticated: false, failures, level, deferredSteps }
  }

  // ── Step 7: Context CI policy ──────────────────────────────────
  // level === "policy" here.
  const validation = extractValidation(b.attestation.predicate)
  const evaluation = evaluatePolicy(validation, opts.policy)
  if (!evaluation.passed) {
    for (const v of evaluation.rejecting) {
      failures.push({
        step: "policy",
        code: "POLICY_REJECTED",
        message: `Context CI verdict rejected by policy: ${v.detector_name} (severity=${v.severity}) — ${v.summary ?? "no summary"}`,
        path: `attestation.predicate.validation[${v.detector_name}]`,
      })
    }
  }

  // structural/policy never attempt crypto → never authenticated.
  // inspection passed/failed per `failures`; authenticated=false in v0.1,
  // so valid = inspected && authenticated = false (fail closed).
  return { valid: false, inspected: failures.length === 0, authenticated: false, failures, level, deferredSteps }
}
