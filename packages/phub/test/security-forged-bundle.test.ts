/**
 * SECURITY regression — forged Trust Bundle (report 2026-09-30, Critical).
 *
 * Mirrors the reporter's PoC exactly: attacker-controlled content, a
 * self-computed digest, an empty passing predicate, and fabricated
 * crypto fields. verify@0.1.x accepts it at the default `policy` level
 * (valid:true) — this suite documents that hole AND asserts that every
 * phub trust path now REFUSES it (fail closed).
 */

import { createHash } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { verifyBundle } from "@primitivehub/verify"
import { describe, expect, it } from "vitest"

import { runInstall } from "../src/commands/install.js"
import { isBundleAuthenticated } from "../src/trust/authentication.js"

/** The reporter's forged bundle — schema-valid, zero real cryptography. */
function forgedBundle(): Record<string, unknown> {
  const payload = Buffer.from("# ATTACKER CONTROLLED AGENT INSTRUCTIONS\n", "utf8")
  const digest = createHash("sha256").update(payload).digest("hex")
  return {
    bundleVersion: "0.1",
    subject: { slug: "forged-bundle", semver: "1.0.0", contentDigest: "sha256:" + digest },
    content: {
      bytesB64: payload.toString("base64"),
      sizeBytes: payload.length,
      mediaType: "text/markdown; charset=utf-8",
    },
    attestation: {
      predicateType: "https://primitivehub.ai/context-ci/v0.1/Attestation",
      predicate: {},
      backendName: "public",
      certChainPem: "forged",
      signatureB64: "Zm9yZ2Vk",
      statementB64: "Zm9yZ2Vk",
      rekorLogIndex: 0,
      rekorLogId: "0".repeat(64),
      rekorInclusionProofJson: "{}",
      verifyUrl: "https://example.invalid/forged",
      signedAt: "2026-09-30T00:00:00Z",
    },
  }
}

describe("SECURITY: forged Trust Bundle must never be trusted", () => {
  it("documents the library hole: verifyBundle('policy') accepts the forgery as valid", async () => {
    const r = await verifyBundle(forgedBundle(), { level: "policy" })
    expect(r.valid).toBe(true) // ← the vulnerability: valid without authentication
    expect(isBundleAuthenticated(r)).toBe(false) // ← our gate sees through it
  })

  it("isBundleAuthenticated is false at EVERY level for the forgery (fail closed)", async () => {
    for (const level of ["structural", "policy", "full"] as const) {
      const r = await verifyBundle(forgedBundle(), { level })
      expect(isBundleAuthenticated(r)).toBe(false)
    }
  })

  it("phub install REFUSES the forged bundle by default", async () => {
    const ws = mkdtempSync(join(tmpdir(), "sec-install-"))
    const bundlePath = join(ws, "forged.json")
    writeFileSync(bundlePath, JSON.stringify(forgedBundle()), "utf8")
    await expect(runInstall({ workspaceRoot: ws, bundlePath, noLock: true })).rejects.toMatchObject({
      code: "BUNDLE_UNAUTHENTICATED",
    })
  })

  it("phub install --allow-unauthenticated is the only way through (explicit opt-in)", async () => {
    const ws = mkdtempSync(join(tmpdir(), "sec-install-optin-"))
    const bundlePath = join(ws, "forged.json")
    writeFileSync(bundlePath, JSON.stringify(forgedBundle()), "utf8")
    const result = await runInstall({
      workspaceRoot: ws,
      bundlePath,
      noLock: true,
      allowUnauthenticated: true,
    })
    expect(result.bytesWritten).toBeGreaterThan(0)
  })
})
