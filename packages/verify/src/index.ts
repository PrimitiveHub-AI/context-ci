/**
 * @primitivehub/verify — offline-first verifier for PrimitiveHub Trust Bundles.
 *
 * Conformant to Trust Contract v0.1 (https://primitivehub.ai —
 * docs/trust-contract-v0.1.md in the source repo).
 *
 * Public API:
 *
 *   import { verifyBundle } from "@primitivehub/verify"
 *
 *   const result = await verifyBundle(parsedJson, { level: "policy" })
 *   if (!result.valid) {
 *     for (const failure of result.failures) console.error(failure.code, failure.message)
 *   }
 *
 * v0.1 implements verification steps 1, 2, 7 (schema, content digest,
 * Context CI policy). Steps 3-6 (in-toto Statement parse +
 * cryptographic signature, cert-chain, Rekor inclusion proof) are
 * stubbed and return *_DEFERRED failures when level: "full" is
 * requested. See README "Known limitations" for the v0.2 roadmap.
 */

export {
  VerificationError,
  type VerificationErrorCode,
  type VerificationErrorDetail,
  type VerificationFailure,
} from "./errors.js"
export {
  type PolicyEvaluation,
  type PolicyOpts,
  type PredicateVerdict,
  type Severity,
  evaluatePolicy,
  extractValidation,
} from "./policy.js"
export {
  type TrustBundle,
  type TrustBundleAttestation,
  type TrustBundleBackendName,
  type TrustBundleContent,
  type TrustBundleSubject,
} from "./types.js"
export {
  type VerificationLevel,
  type VerificationResult,
  type VerifyOptions,
  verifyBundle,
} from "./verify.js"
