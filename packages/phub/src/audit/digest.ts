/**
 * SHA-256 content digest helper for `phub audit`.
 *
 * The digest is the foundation for `phub.lock` (future ADR-0026) and
 * matches the cryptographic vocabulary locked in CLAUDE.md:
 *   "Content Digest = SHA-256 hash of the canonical content"
 *
 * NB the digest is over the file's raw bytes — no normalization, no
 * line-ending massaging. Two files that differ only in their trailing
 * newline have different digests by design.
 */

import { createHash } from "node:crypto"

/**
 * Hex-encoded SHA-256 of a byte buffer. Use the `node:fs.readFileSync`
 * Buffer (no encoding) as input so the digest matches what an external
 * tool (e.g. `sha256sum`) would produce.
 */
export function sha256Hex(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex")
}

/** Convenience: returns the digest with the `sha256:` prefix used in spec text. */
export function sha256Ref(content: Buffer | string): string {
  return `sha256:${sha256Hex(content)}`
}
