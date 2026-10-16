/**
 * Trust Contract v0.1 conformance suite — TypeScript port.
 *
 * Reads the SAME canonical fixtures the Python pytest harness uses
 * (`docs/trust-contract/conformance/valid/` and `invalid/`). Runs the
 * same assertions in vitest. If both harnesses pass the same fixture
 * set, the two implementations agree.
 *
 * Per ADR-0021, the suite is the executable spec. This file IS the
 * v0.1 contract for `@primitivehub/verify`.
 *
 * v0.1 of the library implements steps 1, 2, 7. Adversarial fixtures
 * that exercise steps 3-6 (signature, cert, Rekor) are not present in
 * the suite yet; this harness covers what exists.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { verifyBundle } from "../src/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Walk up from this file until we find docs/trust-contract/conformance.
// Mirrors the Python harness's fixture discovery (see
// apps/api/tests/test_trust_contract_conformance.py).
function findConformanceDir(): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(cursor, "docs", "trust-contract", "conformance")
    if (existsSync(candidate)) return candidate
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error(
    "could not locate docs/trust-contract/conformance — checked parents of " +
      __filename,
  )
}

const CONFORMANCE_DIR = findConformanceDir()
const VALID_DIR = join(CONFORMANCE_DIR, "valid")
const INVALID_DIR = join(CONFORMANCE_DIR, "invalid")

function jsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(dir, name))
}

function loadBundle(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

// ─────────────────────────────────────────────────────────────────────
// Suite-wide invariants — mirror Python harness
// ─────────────────────────────────────────────────────────────────────
describe("suite invariants", () => {
  it("locates the conformance directory", () => {
    expect(existsSync(VALID_DIR)).toBe(true)
    expect(existsSync(INVALID_DIR)).toBe(true)
  })

  it("has ≥10 valid fixtures (PR 5.5.B floor)", () => {
    expect(jsonFiles(VALID_DIR).length).toBeGreaterThanOrEqual(10)
  })

  it("has ≥3 invalid fixtures (PR 5.5.B floor)", () => {
    expect(jsonFiles(INVALID_DIR).length).toBeGreaterThanOrEqual(3)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Every valid fixture passes structural verification (steps 1 + 2)
// ─────────────────────────────────────────────────────────────────────
describe("valid fixtures (structural — steps 1 + 2)", () => {
  const fixtures = jsonFiles(VALID_DIR)
  for (const fixture of fixtures) {
    const name = fixture.split("/").pop() ?? fixture
    it(`accepts ${name}`, async () => {
      const bundle = loadBundle(fixture)
      const result = await verifyBundle(bundle, { level: "structural" })
      expect(result.valid, JSON.stringify(result.failures, null, 2)).toBe(true)
      expect(result.failures).toEqual([])
    })
  }
})

// ─────────────────────────────────────────────────────────────────────
// SECURITY (forged-bundle report, 2026-09-30): "valid" authenticates
// nothing. No fixture — not even a well-formed, policy-passing one — may
// ever report authenticated:true while steps 3-6 crypto are stubbed. The
// library fails closed. This is part of the executable contract.
// ─────────────────────────────────────────────────────────────────────
describe("fail-closed invariant: nothing is authenticated in v0.1", () => {
  const fixtures = jsonFiles(VALID_DIR)
  for (const fixture of fixtures) {
    const name = fixture.split("/").pop() ?? fixture
    for (const level of ["structural", "policy", "full"] as const) {
      it(`${name} is NOT authenticated at level=${level}`, async () => {
        const result = await verifyBundle(loadBundle(fixture), { level })
        expect(result.authenticated).toBe(false)
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────────────
// Policy-level verification: a fixture with a FAIL verdict in its
// predicate is rejected by default policy.
// ─────────────────────────────────────────────────────────────────────
describe("policy verification (step 7)", () => {
  it("rejects predicate-with-fail under default policy", async () => {
    const fixture = join(VALID_DIR, "04-predicate-with-fail.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "policy" })
    expect(result.valid).toBe(false)
    expect(result.failures.some((f) => f.code === "POLICY_REJECTED")).toBe(true)
  })

  it("accepts predicate-with-fail when the failing detector is allow-listed", async () => {
    const fixture = join(VALID_DIR, "04-predicate-with-fail.json")
    const result = await verifyBundle(loadBundle(fixture), {
      level: "policy",
      policy: { allowFailFor: ["t5.unsafe_shell_install"] },
    })
    expect(result.valid).toBe(true)
  })

  it("accepts populated-predicate-all-pass under default policy", async () => {
    const fixture = join(VALID_DIR, "02-populated-predicate-all-pass.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "policy" })
    expect(result.valid).toBe(true)
  })

  it("treats WARN as fail in strict mode", async () => {
    const fixture = join(VALID_DIR, "03-predicate-with-warn.json")
    const lenient = await verifyBundle(loadBundle(fixture), { level: "policy" })
    expect(lenient.valid).toBe(true)
    const strict = await verifyBundle(loadBundle(fixture), {
      level: "policy",
      policy: { strict: true },
    })
    expect(strict.valid).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Adversarial fixtures: each rejects at the expected layer.
// Companion .md files document the expected failure step.
// ─────────────────────────────────────────────────────────────────────
describe("invalid fixtures", () => {
  it("rejects 01-digest-mismatch at the digest step", async () => {
    const fixture = join(INVALID_DIR, "01-digest-mismatch.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "structural" })
    expect(result.valid).toBe(false)
    expect(result.failures.some((f) => f.code === "DIGEST_MISMATCH")).toBe(true)
  })

  it("rejects 02-unknown-bundle-version at the schema step", async () => {
    const fixture = join(INVALID_DIR, "02-unknown-bundle-version.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "structural" })
    expect(result.valid).toBe(false)
    expect(result.failures.some((f) => f.code === "UNKNOWN_BUNDLE_VERSION")).toBe(true)
  })

  it("rejects 03-unknown-backend at the schema step", async () => {
    const fixture = join(INVALID_DIR, "03-unknown-backend.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "structural" })
    expect(result.valid).toBe(false)
    expect(result.failures.some((f) => f.code === "UNKNOWN_BACKEND")).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Level: full — currently returns DEFERRED failures for steps 3-6.
// Documented in README. Reaffirmed here so a future Sigstore-aware
// implementation knows what flips.
// ─────────────────────────────────────────────────────────────────────
describe("full verification (v0.1 stubs steps 3-6)", () => {
  it("returns DEFERRED failures for the cryptographic steps", async () => {
    const fixture = join(VALID_DIR, "01-minimal-valid.json")
    const result = await verifyBundle(loadBundle(fixture), { level: "full" })
    expect(result.valid).toBe(false)
    expect(result.deferredSteps).toContain("signature")
    expect(result.deferredSteps).toContain("cert")
    expect(result.deferredSteps).toContain("rekor")
    expect(result.failures.some((f) => f.code === "SIGNATURE_VERIFICATION_DEFERRED")).toBe(true)
    expect(result.failures.some((f) => f.code === "CERT_CHAIN_VERIFICATION_DEFERRED")).toBe(true)
    expect(result.failures.some((f) => f.code === "REKOR_INCLUSION_PROOF_DEFERRED")).toBe(true)
  })
})
