/**
 * SECURITY regression — forged Trust Bundle via the MCP tools
 * (report 2026-09-30, Critical). The verify_bundle and
 * verify_before_load tools must never report a forged, unauthenticated
 * bundle as trustworthy.
 */

import { createHash } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { callVerifyBundle } from "../src/tools/verify-bundle.js"
import { callVerifyBeforeLoad } from "../src/tools/verify-before-load.js"

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

describe("SECURITY: MCP tools reject the forged bundle", () => {
  it("verify_bundle returns isError + authenticated:false + INSPECTED_NOT_AUTHENTICATED", async () => {
    const res = await callVerifyBundle({ bundle: forgedBundle() })
    expect(res.isError).toBe(true)
    const payload = JSON.parse(res.content[0]!.text)
    expect(payload.authenticated).toBe(false)
    expect(payload.trust).toBe("INSPECTED_NOT_AUTHENTICATED")
    expect(typeof payload.securityNote).toBe("string")
  })

  it("verify_before_load with a forged bundle BLOCKS (safe:false, BUNDLE_UNAUTHENTICATED)", async () => {
    const ws = mkdtempSync(join(tmpdir(), "sec-vbl-"))
    writeFileSync(join(ws, "AGENTS.md"), "# clean\n", "utf8")
    const res = await callVerifyBeforeLoad({
      path: "AGENTS.md",
      workspace_root: ws,
      bundle: forgedBundle(),
    })
    expect(res.isError).toBe(true)
    const payload = JSON.parse(res.content[0]!.text)
    expect(payload.safe).toBe(false)
    expect(
      payload.reasons.some((r: { code: string }) => r.code === "BUNDLE_UNAUTHENTICATED"),
    ).toBe(true)
    expect(payload.checks.bundle.authenticated).toBe(false)
  })
})
