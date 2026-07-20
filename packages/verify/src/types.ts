/**
 * Trust Bundle v0.1 wire-format types.
 *
 * These are the TypeScript shape of `application/vnd.primitivehub.bundle+json`
 * per `docs/trust-contract-v0.1.md` § 4–6. The canonical JSON Schema in
 * `schema/v0.1.json` is the structural authority; these types are
 * developer ergonomics on top.
 *
 * When the spec changes, these types AND the vendored schema both move.
 * Per ADR-0015 versioning policy, additive evolution within v0.x is
 * acceptable; breaking changes are a major bump.
 */

/** The four backends our reference signer supports (ADR-0011). */
export type TrustBundleBackendName = "public" | "staging" | "self-hosted" | "noop"

export interface TrustBundleSubject {
  /** Canonical primitive slug (`^[a-z0-9][a-z0-9-]{0,127}$`). */
  slug: string
  /** Semver 2.0. */
  semver: string
  /** Format `sha256:<64 lowercase hex chars>`. */
  contentDigest: string
}

export interface TrustBundleContent {
  /** Base64-encoded primitive bytes (RFC 4648). */
  bytesB64: string
  /** Length of the decoded bytes. MUST match the actual decoded length. */
  sizeBytes: number
  /** Default + currently-only value: `text/markdown; charset=utf-8`. */
  mediaType: string
}

export interface TrustBundleAttestation {
  /** Canonical `https://primitivehub.ai/context-ci/v0.1/Attestation` for v0.1. */
  predicateType: string
  /** Context CI Attestation predicate payload (docs/spec.md § 5.3). */
  predicate: Record<string, unknown>
  /** Which Sigstore backend signed this. */
  backendName: TrustBundleBackendName
  /** PEM-encoded leaf cert from Fulcio. */
  certChainPem: string
  /** Base64-encoded raw signature over the in-toto Statement bytes. */
  signatureB64: string
  /** Base64-encoded in-toto Statement v1 bytes the signature is over. */
  statementB64: string
  /** Rekor transparency-log entry index (≥0). */
  rekorLogIndex: number
  /** Hex SHA-256 of Rekor's public key (64 hex chars). */
  rekorLogId: string
  /** JSON-serialized inclusion proof. */
  rekorInclusionProofJson: string
  /** Human-readable URL to inspect the entry. Verification MUST NOT depend on this. */
  verifyUrl: string
  /** RFC 3339 timestamp. */
  signedAt: string
}

export interface TrustBundle {
  /** For v0.1 conformance, MUST equal `"0.1"`. */
  bundleVersion: string
  subject: TrustBundleSubject
  content: TrustBundleContent
  attestation: TrustBundleAttestation
  /** Convenience back-link to the issuing PrimitiveHub instance's UI page. */
  detailUrl?: string
}
