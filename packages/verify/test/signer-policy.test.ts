/**
 * verify v0.2 signer-identity + anti-replay policy.
 *
 * Two halves:
 *   1. LIVE tests — the dep-free trust DECISIONS (matchesSigner / checkFreshness
 *      / validateSignerPolicy) that Phase 2/3 crypto will call. Fully testable
 *      today; these are the fail-closed guarantees.
 *   2. it.todo SKELETON — the Phase 4 negative-test matrix (spec §6). Each case
 *      needs sigstore-js + fixtures (owner must ratify the dep first), so they're
 *      declared here as the named exit condition, not yet implemented. Filling
 *      every todo green IS the Phase 4 gate.
 */
import { describe, expect, it } from "vitest"

import {
  checkFreshness,
  matchesSigner,
  validateSignerPolicy,
  type SignerPolicy,
} from "../src/signer-policy.js"

const GH_ISSUER = "https://token.actions.githubusercontent.com"
const GH_SAN = "https://github.com/PrimitiveHub-AI/context-ci/.github/workflows/release.yml@refs/heads/main"

const policy = (over: Partial<SignerPolicy> = {}): SignerPolicy => ({
  signers: [{ issuer: GH_ISSUER, san: GH_SAN }],
  ...over,
})

describe("validateSignerPolicy — fail-closed shape validation", () => {
  it("absent policy → NO_APPROVED_SIGNERS (refuse, don't trust-all)", () => {
    const f = validateSignerPolicy(undefined)
    expect(f.map((x) => x.code)).toContain("NO_APPROVED_SIGNERS")
  })

  it("empty signers[] → NO_APPROVED_SIGNERS", () => {
    const f = validateSignerPolicy({ signers: [] })
    expect(f.map((x) => x.code)).toContain("NO_APPROVED_SIGNERS")
  })

  it("a valid single-signer policy → no failures", () => {
    expect(validateSignerPolicy(policy())).toEqual([])
  })

  it("empty issuer → SIGNER_POLICY_INVALID", () => {
    const f = validateSignerPolicy({ signers: [{ issuer: "", san: GH_SAN }] })
    expect(f.map((x) => x.code)).toContain("SIGNER_POLICY_INVALID")
  })

  it("empty string SAN → SIGNER_POLICY_INVALID", () => {
    const f = validateSignerPolicy({ signers: [{ issuer: GH_ISSUER, san: "" }] })
    expect(f.map((x) => x.code)).toContain("SIGNER_POLICY_INVALID")
  })

  it("a RegExp SAN is accepted", () => {
    expect(validateSignerPolicy({ signers: [{ issuer: GH_ISSUER, san: /^https:\/\/github\.com\/PrimitiveHub-AI\// }] })).toEqual([])
  })

  it("custom trustRoot missing rekorKeysPem → TRUST_ROOT_INVALID (no half-pinning)", () => {
    const f = validateSignerPolicy(policy({ trustRoot: { fulcioRootsPem: "-----BEGIN CERTIFICATE-----", rekorKeysPem: "" } }))
    expect(f.map((x) => x.code)).toContain("TRUST_ROOT_INVALID")
  })

  it('"public-good" trustRoot is accepted', () => {
    expect(validateSignerPolicy(policy({ trustRoot: "public-good" }))).toEqual([])
  })

  it("non-positive maxBundleAgeSec → SIGNER_POLICY_INVALID", () => {
    expect(validateSignerPolicy(policy({ maxBundleAgeSec: 0 })).map((x) => x.code)).toContain("SIGNER_POLICY_INVALID")
    expect(validateSignerPolicy(policy({ maxBundleAgeSec: -1 })).map((x) => x.code)).toContain("SIGNER_POLICY_INVALID")
    expect(validateSignerPolicy(policy({ maxBundleAgeSec: Infinity })).map((x) => x.code)).toContain("SIGNER_POLICY_INVALID")
  })
})

describe("matchesSigner — the approved-signer bar (R-class: identity, not just a valid sig)", () => {
  it("exact issuer + exact SAN → approved", () => {
    expect(matchesSigner({ issuer: GH_ISSUER, san: GH_SAN }, policy())).toEqual([])
  })

  it("right issuer, wrong SAN → SIGNER_NOT_ALLOWED", () => {
    const f = matchesSigner({ issuer: GH_ISSUER, san: "https://github.com/evil/repo/.github/workflows/x.yml@refs/heads/main" }, policy())
    expect(f[0]?.code).toBe("SIGNER_NOT_ALLOWED")
  })

  it("lookalike issuer, matching SAN → SIGNER_NOT_ALLOWED (issuer is exact, never regex)", () => {
    const f = matchesSigner({ issuer: "https://token.actions.githubusercontent.com.evil.co", san: GH_SAN }, policy())
    expect(f[0]?.code).toBe("SIGNER_NOT_ALLOWED")
  })

  it("RegExp SAN matches a whole family of workflow refs", () => {
    const p = policy({ signers: [{ issuer: GH_ISSUER, san: /^https:\/\/github\.com\/PrimitiveHub-AI\/context-ci\// }] })
    expect(matchesSigner({ issuer: GH_ISSUER, san: GH_SAN }, p)).toEqual([])
    expect(matchesSigner({ issuer: GH_ISSUER, san: "https://github.com/PrimitiveHub-AI/OTHER/.github/workflows/x.yml@refs/heads/main" }, p)[0]?.code).toBe("SIGNER_NOT_ALLOWED")
  })

  it("no signers configured → NO_APPROVED_SIGNERS (never trust-all)", () => {
    expect(matchesSigner({ issuer: GH_ISSUER, san: GH_SAN }, { signers: [] })[0]?.code).toBe("NO_APPROVED_SIGNERS")
  })

  it("first non-matching + second matching rule → approved (OR across the allow-list)", () => {
    const p = policy({ signers: [{ issuer: "https://other.issuer", san: "x" }, { issuer: GH_ISSUER, san: GH_SAN }] })
    expect(matchesSigner({ issuer: GH_ISSUER, san: GH_SAN }, p)).toEqual([])
  })
})

describe("checkFreshness — anti-replay", () => {
  const NOW = 1_700_000_000 // fixed epoch-seconds; time is injected, never read

  it("no maxBundleAgeSec → no constraint (freshness is opt-in)", () => {
    expect(checkFreshness(NOW - 999_999, NOW, undefined)).toEqual([])
  })

  it("within the window → fresh", () => {
    expect(checkFreshness(NOW - 100, NOW, 3600)).toEqual([])
  })

  it("older than the window → BUNDLE_STALE", () => {
    expect(checkFreshness(NOW - 7200, NOW, 3600)[0]?.code).toBe("BUNDLE_STALE")
  })

  it("future-dated beyond skew tolerance → BUNDLE_STALE", () => {
    expect(checkFreshness(NOW + 3600, NOW, 3600)[0]?.code).toBe("BUNDLE_STALE")
  })

  it("future-dated within skew tolerance → accepted", () => {
    expect(checkFreshness(NOW + 30, NOW, 3600)).toEqual([])
  })

  it("non-finite / non-positive timestamp → BUNDLE_TIMESTAMP_INVALID", () => {
    expect(checkFreshness(NaN, NOW, 3600)[0]?.code).toBe("BUNDLE_TIMESTAMP_INVALID")
    expect(checkFreshness(0, NOW, 3600)[0]?.code).toBe("BUNDLE_TIMESTAMP_INVALID")
  })
})

/**
 * ── Phase 4 negative-test matrix (spec §6) — the named exit condition ─────────
 *
 * Each needs sigstore-js + a crafted fixture; implement when the owner ratifies
 * the dependency (spec open-question #1). Every case must yield
 * `authenticated:false` with the specific `failures[].code` noted. Plus ONE
 * independently-constructed POSITIVE bundle that returns `authenticated:true` —
 * the only input for which `valid:true` is reachable.
 *
 * Statement-binding cases (R09/R10) are ALREADY live — see statement.test.ts.
 */
describe("Phase 4 negative matrix (sigstore-js — owner-gated)", () => {
  // signature step
  it.todo("forged signer key (sig doesn't verify under the leaf) → authenticated:false")
  it.todo("swapped DSSE/Statement payload (sig over a different statement) → authenticated:false")

  // cert step — chain + identity
  it.todo("expired Fulcio cert (outside validity window) → CERT_* fail")
  it.todo("cert chains to a swapped/poisoned trust root → TRUST_ROOT_* fail")
  it.todo("wrong OIDC issuer extracted from leaf → SIGNER_NOT_ALLOWED")
  it.todo("wrong SAN extracted from leaf → SIGNER_NOT_ALLOWED")
  it.todo("valid signer but not in policy.signers (cross-signer) → SIGNER_NOT_ALLOWED")

  // rekor step — inclusion + anti-replay
  it.todo("Rekor leaf-hash mismatch → REKOR_* fail")
  it.todo("Rekor inclusion-proof corruption → REKOR_* fail")
  it.todo("tampered checkpoint / SET → REKOR_* fail")
  it.todo("stale bundle beyond maxBundleAgeSec → BUNDLE_STALE")

  // positive
  it.todo("one independently-constructed valid bundle → authenticated:true, valid:true")
})
