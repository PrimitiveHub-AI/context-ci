/**
 * Trust-decision gate for Trust Bundles.
 *
 * SECURITY (forged-bundle report, 2026-09-30; Critical):
 * `@primitivehub/verify@0.1.x` stubs the cryptographic steps 3-6
 * (in-toto statement parse, signature, cert chain, Rekor inclusion).
 * As a result `verifyBundle` can return `valid: true` at the
 * `structural`/`policy` levels while having authenticated NOTHING — it
 * only confirmed the bundle is self-consistent (content matches the
 * digest the *same bundle* supplies) and that the bundle's *own*
 * self-reported policy verdicts pass. An attacker who controls bundle
 * delivery can forge all of that.
 *
 * Therefore `result.valid` MUST NOT be used as a trust decision.
 * Anything that installs, loads, or otherwise *trusts* bundle content
 * gates on `isBundleAuthenticated()` instead — which is true ONLY when
 * real cryptographic verification actually ran and passed.
 *
 * Until verify v0.2 ships Sigstore crypto, this returns `false` for
 * every bundle. That is intentional: the system fails closed.
 */

import type { VerificationResult } from "@primitivehub/verify"

/**
 * True iff the bundle was cryptographically authenticated end-to-end:
 * full-level verification ran and produced zero deferred/failed steps.
 *
 * In verify v0.1 steps 3-6 are stubbed, so `full` always yields
 * `deferredSteps.length > 0` (and `valid: false`) — meaning this is
 * `false` for every bundle today. When v0.2 unstubs the crypto, a
 * genuinely signed bundle will satisfy all three conditions and this
 * starts returning `true` with no change to callers.
 */
export function isBundleAuthenticated(result: VerificationResult): boolean {
  return result.level === "full" && result.valid === true && result.deferredSteps.length === 0
}

/** Stable reason code emitted when a trust path refuses an unauthenticated bundle. */
export const UNAUTHENTICATED_BUNDLE_CODE = "BUNDLE_UNAUTHENTICATED" as const

/** Human message shared by the CLI + MCP refusal paths. */
export function unauthenticatedBundleMessage(result: VerificationResult): string {
  const deferred = result.deferredSteps.length > 0 ? ` (deferred: ${result.deferredSteps.join(", ")})` : ""
  return (
    `bundle is NOT cryptographically authenticated${deferred} — ` +
    `signature/cert-chain/Rekor verification is not available in this version of @primitivehub/verify. ` +
    `Refusing to trust it. This is fail-closed behavior; real authentication lands in verify v0.2.`
  )
}
