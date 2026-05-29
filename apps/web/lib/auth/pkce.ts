/**
 * PKCE — Proof Key for Code Exchange (RFC 7636).
 *
 * Defends against authorization-code interception by binding the
 * /token exchange to a secret only the original /authorize requester
 * knows. We use S256 (the only mode worth using) — the verifier is
 * generated server-side, hashed to produce the challenge sent in
 * /authorize, and the original verifier is sent back at /token time.
 *
 * Both the verifier and the OAuth `state` are stored in short-lived
 * httpOnly cookies between the redirect to Authentik and the callback.
 */

import { createHash, randomBytes } from "node:crypto"

export interface PkcePair {
  verifier: string
  challenge: string
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function generatePkcePair(): PkcePair {
  // 32 bytes → 43 chars base64-url. Falls inside RFC 7636's 43-128 range.
  const verifier = base64UrlEncode(randomBytes(32))
  const challenge = base64UrlEncode(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function generateState(): string {
  // 16 bytes is the standard recommendation for state.
  return base64UrlEncode(randomBytes(16))
}
