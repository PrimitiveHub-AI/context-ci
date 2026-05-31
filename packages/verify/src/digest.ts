/**
 * Content digest verification — verification procedure step 2.
 *
 * Uses Web Crypto (`crypto.subtle.digest`) — built into Node 20+ and
 * every modern browser. Zero runtime deps.
 *
 * Bound to SHA-256; the Trust Contract v0.1 uses sha256 exclusively
 * (subject.contentDigest pattern `^sha256:[0-9a-f]{64}$`).
 */

/** Decode a base64 string into bytes. Uses the Node 20+ / WHATWG
 *  `Uint8Array` + `atob` path; no Buffer dependency for browser portability. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Compute SHA-256 of bytes; return lowercase hex string (64 chars). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Web Crypto subtle.digest requires an ArrayBuffer view. Uint8Array.buffer
  // works in Node 20+ and browsers; .slice ensures we pass exactly the
  // wrapped bytes if the underlying buffer is larger.
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
  const hashBuf = await crypto.subtle.digest("SHA-256", buf)
  const hashBytes = new Uint8Array(hashBuf)
  let hex = ""
  for (const b of hashBytes) hex += b.toString(16).padStart(2, "0")
  return hex
}

/** Strip the `sha256:` prefix and return the hex portion, or throw. */
export function parseSha256Digest(prefixed: string): string {
  const m = /^sha256:([0-9a-f]{64})$/.exec(prefixed)
  if (!m) throw new Error(`not a sha256 digest: ${prefixed}`)
  return m[1] as string
}
