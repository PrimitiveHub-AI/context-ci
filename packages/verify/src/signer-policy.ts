/**
 * Signer-identity + anti-replay policy — @primitivehub/verify v0.2 Phase 2/3 prep.
 *
 * Authentication without an identity allow-list is theatre: a valid Sigstore
 * signature from ANY identity would pass. §4 of the v0.2 spec adds an approved-
 * signer bar (OIDC issuer + SAN), trust-root pinning, and an anti-replay
 * freshness window.
 *
 * This module is the DEP-FREE SEAM for that policy. Everything here is a pure
 * decision over values that Phase 2's crypto will *produce*:
 *
 *   - sigstore-js verifies the cert chain and EXTRACTS a `{ issuer, san }`
 *     signer identity → `matchesSigner()` decides if it's approved.
 *   - the verified bundle timestamp → `checkFreshness()` decides if it's stale.
 *   - the configured policy shape → `validateSignerPolicy()` rejects nonsense
 *     (empty allow-list, half-specified trust root, non-positive window).
 *
 * So when sigstore-js drops in (Phase 2), the trust DECISIONS are already here,
 * tested, and fail-closed. No external dependencies — pure logic.
 *
 * Fail-closed defaults (the whole point):
 *   - No `signers` configured → REFUSE (NO_APPROVED_SIGNERS). v0.2 must never
 *     authenticate an arbitrary signer silently.
 *   - `trustRoot` defaults to the Sigstore public-good roots; a custom root must
 *     specify BOTH the Fulcio roots and the Rekor keys or it's rejected.
 */

import { type VerificationFailure } from "./errors.js"

/** A single approved-signer rule: an exact OIDC issuer + an exact-or-regex SAN. */
export interface SignerMatcher {
  /** Exact OIDC issuer URL, e.g. "https://token.actions.githubusercontent.com". */
  issuer: string
  /**
   * Subject Alternative Name to accept. A string matches EXACTLY (no globbing —
   * be explicit); a RegExp is tested against the full SAN. Anchor your regex.
   */
  san: string | RegExp
}

/** Trust-root pinning: the Sigstore public-good roots, or explicit PEM material. */
export type TrustRoot =
  | "public-good"
  | { fulcioRootsPem: string; rekorKeysPem: string }

/**
 * The cryptographic-trust policy (distinct from the Context CI *verdict* policy
 * in policy.ts). Mirrors v0.2 spec §4. Kept as its own interface rather than
 * overloaded onto PolicyOpts so content-policy and trust-policy stay separable;
 * final wiring of where this hangs off VerifyOptions is confirmed in Phase 2.
 */
export interface SignerPolicy {
  /** Approved signers. ABSENT or EMPTY ⇒ refuse (fail-closed). No default signer. */
  signers?: ReadonlyArray<SignerMatcher>
  /** Trust-root pinning. Default: "public-good". */
  trustRoot?: TrustRoot
  /** Anti-replay window in seconds. Absent ⇒ no freshness constraint (documented). */
  maxBundleAgeSec?: number
}

/** The signer identity Phase 2's cert step extracts from `certChainPem`. */
export interface SignerIdentity {
  issuer: string
  san: string
}

/** Small clock-skew tolerance (seconds) so a just-issued bundle isn't "future". */
export const CLOCK_SKEW_TOLERANCE_SEC = 60

function fail(
  code: VerificationFailure["code"],
  step: VerificationFailure["step"],
  message: string,
): VerificationFailure {
  return { step, code, message }
}

/**
 * Validate the POLICY SHAPE (not the crypto). Returns failures for a policy that
 * can never authenticate anyone meaningfully. Call this once, up front, before
 * attempting the crypto path — a malformed trust policy should fail closed, not
 * be silently ignored.
 *
 * - No `signers` (absent/empty) → NO_APPROVED_SIGNERS. This is the deliberate
 *   fail-closed default: v0.2 refuses rather than trust any signer.
 * - A custom `trustRoot` object missing either PEM → TRUST_ROOT_INVALID.
 * - `maxBundleAgeSec` present and not a positive finite number → SIGNER_POLICY_INVALID.
 * - An empty issuer or an empty string SAN → SIGNER_POLICY_INVALID.
 */
export function validateSignerPolicy(policy: SignerPolicy | undefined): VerificationFailure[] {
  const failures: VerificationFailure[] = []

  if (!policy || !policy.signers || policy.signers.length === 0) {
    failures.push(
      fail(
        "NO_APPROVED_SIGNERS",
        "cert",
        "no approved signers configured — verify v0.2 refuses to authenticate an arbitrary signer (set policy.signers)",
      ),
    )
    // Still validate the rest of whatever WAS provided, so the caller sees every
    // problem at once rather than one-at-a-time.
  }

  for (const [i, m] of (policy?.signers ?? []).entries()) {
    if (typeof m.issuer !== "string" || m.issuer.trim() === "") {
      failures.push(fail("SIGNER_POLICY_INVALID", "cert", `signers[${i}].issuer must be a non-empty string`))
    }
    if (typeof m.san === "string" && m.san.trim() === "") {
      failures.push(fail("SIGNER_POLICY_INVALID", "cert", `signers[${i}].san must be a non-empty string or a RegExp`))
    } else if (!(typeof m.san === "string") && !(m.san instanceof RegExp)) {
      failures.push(fail("SIGNER_POLICY_INVALID", "cert", `signers[${i}].san must be a string or RegExp`))
    }
  }

  const tr = policy?.trustRoot
  if (tr !== undefined && tr !== "public-good") {
    const okFulcio = typeof tr.fulcioRootsPem === "string" && tr.fulcioRootsPem.trim() !== ""
    const okRekor = typeof tr.rekorKeysPem === "string" && tr.rekorKeysPem.trim() !== ""
    if (!okFulcio || !okRekor) {
      failures.push(
        fail(
          "TRUST_ROOT_INVALID",
          "cert",
          "custom trustRoot must specify BOTH fulcioRootsPem and rekorKeysPem (half-pinned trust is rejected)",
        ),
      )
    }
  }

  const age = policy?.maxBundleAgeSec
  if (age !== undefined && (!Number.isFinite(age) || age <= 0)) {
    failures.push(fail("SIGNER_POLICY_INVALID", "rekor", "maxBundleAgeSec must be a positive, finite number of seconds"))
  }

  return failures
}

/**
 * Decide whether an extracted signer identity is approved by the policy.
 * PURE — no crypto. Phase 2 verifies the chain, pulls `{ issuer, san }` out of
 * the Fulcio leaf, and calls this. Returns failures (empty = approved).
 *
 * A match requires SOME rule whose issuer is exactly equal AND whose SAN matches
 * (exact string, or RegExp test). Issuer is never regex-matched — an exact URL
 * only — so a lookalike issuer can't sneak through a loose SAN pattern.
 */
export function matchesSigner(
  identity: SignerIdentity,
  policy: SignerPolicy | undefined,
): VerificationFailure[] {
  const signers = policy?.signers ?? []
  if (signers.length === 0) {
    return [
      fail(
        "NO_APPROVED_SIGNERS",
        "cert",
        "no approved signers configured — cannot authenticate",
      ),
    ]
  }

  const approved = signers.some((m) => {
    if (m.issuer !== identity.issuer) return false
    return typeof m.san === "string" ? m.san === identity.san : m.san.test(identity.san)
  })

  if (!approved) {
    return [
      fail(
        "SIGNER_NOT_ALLOWED",
        "cert",
        `signer identity (issuer=${identity.issuer}, san=${identity.san}) is not in the approved-signer allow-list`,
      ),
    ]
  }
  return []
}

/**
 * Anti-replay freshness check. PURE — the caller supplies the bundle's verified
 * timestamp (Phase 3 reads it from the Rekor checkpoint / signed entry) and the
 * current time. Returns failures (empty = fresh / no constraint).
 *
 * - `maxBundleAgeSec` absent → no constraint (returns []). Documented: freshness
 *   is opt-in; a consumer that wants anti-replay must set it.
 * - bundle older than the window → BUNDLE_STALE.
 * - bundle dated in the FUTURE beyond the clock-skew tolerance → BUNDLE_STALE
 *   (a future timestamp is as suspect as a stale one — likely a replay or a
 *   forged checkpoint).
 * - non-finite / absurd timestamp → BUNDLE_TIMESTAMP_INVALID.
 *
 * Time is passed in (not read via Date.now()) so this stays pure + deterministic
 * and the orchestrator owns the single clock read.
 */
export function checkFreshness(
  bundleEpochSec: number,
  nowEpochSec: number,
  maxBundleAgeSec: number | undefined,
): VerificationFailure[] {
  if (maxBundleAgeSec === undefined) return []

  if (!Number.isFinite(bundleEpochSec) || bundleEpochSec <= 0) {
    return [fail("BUNDLE_TIMESTAMP_INVALID", "rekor", `bundle timestamp is not a valid epoch-seconds value (${bundleEpochSec})`)]
  }

  const ageSec = nowEpochSec - bundleEpochSec

  if (ageSec > maxBundleAgeSec) {
    return [
      fail(
        "BUNDLE_STALE",
        "rekor",
        `bundle is ${ageSec}s old; exceeds maxBundleAgeSec=${maxBundleAgeSec}s (anti-replay)`,
      ),
    ]
  }

  if (ageSec < -CLOCK_SKEW_TOLERANCE_SEC) {
    return [
      fail(
        "BUNDLE_STALE",
        "rekor",
        `bundle timestamp is ${-ageSec}s in the future (beyond ${CLOCK_SKEW_TOLERANCE_SEC}s skew) — rejected`,
      ),
    ]
  }

  return []
}
