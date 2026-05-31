# PrimitiveHub Trust Contract — v0.1

> **Status:** Draft. The wire contract every PrimitiveHub trust surface
> produces or consumes — HTTP Trust API, `phub` CLI,
> `@primitivehub/verify` library, MCP server, GitHub Action, Primitive
> Forge, Primitive Explorer. **One contract, many transports.**
>
> **Media type:** `application/vnd.primitivehub.bundle+json`
>
> **Version:** `0.1`
>
> **Authoring:** PrimitiveHub Labs / CyberOrca Labs.
>
> **Reference implementation:** the PrimitiveHub HTTP Trust API
> (`apps/api/registry/api.py`) and `@primitivehub/verify` library
> (Phase 5.5.4, planned). Per ADR-0020, the reference implementation
> is what defines spec semantics in disputes; the conformance suite
> (`docs/trust-contract/conformance/`) is the executable contract.
>
> **Companion specs:** [Context CI Top 10
> v0.1](./context-ci-top-10-v0.1.md) (taxonomy referenced by the
> attestation predicate), Context Policy Language v0.1 (forthcoming
> Phase 5.5 Week 6), CBOM v0.1 (forthcoming Phase 5.6).
>
> **Versioning + deprecation policy:** see ADR-0015. Breaking changes
> require an RFC + a major-version bump + a 12-month deprecation
> window for the prior version.

---

## 1. Purpose

The Trust Contract is the canonical, versioned, machine-verifiable
artifact that says: **"this primitive is who it claims to be, signed
by whom it claims, validated against the Context CI Top 10, and
verifiable offline against the Sigstore trust root."**

It is the wire format that lets PrimitiveHub be **infrastructure**, not
a destination. Any AI agent, IDE, CI system, or third-party registry
can:

- Pull a bundle and verify it without calling PrimitiveHub again.
- Cache a bundle indefinitely; verify offline; refuse to use the
  primitive if any check fails.
- Treat the bundle as a portable identity artifact that survives
  cross-registry redistribution.

If a surface needs trust logic that isn't in this contract, the
contract gets extended (with versioning discipline) — the surface does
not branch.

## 2. Conformance philosophy

This spec text is the **prescriptive** definition of the format. The
[conformance test suite](./trust-contract/conformance/) is the
**executable** definition — when text and tests disagree, the tests
win (and the text gets a clarifying PR).

A Trust Bundle producer MUST produce bundles that pass every test in
the conformance suite's `valid/` directory. A Trust Bundle consumer
MUST reject every bundle in the conformance suite's `invalid/`
directory with a clear, distinct error per failure mode.

Any implementation passing both halves of the suite may claim
**"PrimitiveHub Trust Contract v0.1 conformant"** in its documentation
and marketing. The phrase is reserved for implementations that pass
the suite; we will publicly correct claims that don't.

## 3. Media type

```
application/vnd.primitivehub.bundle+json
```

Servers serving Trust Bundles over HTTP MUST set this Content-Type
header. Consumers SHOULD content-negotiate it via `Accept:`.

A future revision of this spec MAY pursue IANA media-type registration
under RFC 6838 §3.1 ("vendor tree"). Until that lands, the type above
is the canonical vendor-tree identifier.

## 4. Bundle structure (informative overview)

A Trust Bundle is a JSON object with exactly five top-level keys plus
one optional convenience key:

```json
{
  "bundleVersion": "0.1",
  "subject":     { ... what's being attested ... },
  "content":     { ... the primitive bytes ... },
  "attestation": { ... the cryptographic proof + Context CI verdicts ... },
  "detailUrl":   "/primitive/<slug>?version=<semver>"
}
```

The five keys are **required** in any v0.1 bundle:
`bundleVersion`, `subject`, `content`, `attestation`. (`detailUrl` is
optional — it's a UX convenience back-link to the human-browseable page
on the issuing PrimitiveHub instance. Consumers MUST NOT depend on it
for verification.)

Per-field semantics are normative in §5; the JSON Schema in §6 is the
machine-checkable form.

## 5. Field semantics (normative)

### 5.1 `bundleVersion` (string, required)

The Trust Contract version this bundle conforms to. For this spec, the
value MUST be the string `"0.1"`. Future bundle versions will follow
semantic versioning per ADR-0015 — breaking changes bump the major
version, additive changes bump the minor.

Consumers MUST refuse bundles whose `bundleVersion` they don't
recognize, with a clear error. A consumer that supports v0.1 SHOULD
accept future v0.x bundles that don't use features unknown to it
(forward-compatible additive evolution); a consumer that supports v0.1
MUST refuse v1.x bundles.

### 5.2 `subject` (object, required)

What's being attested. Three fields, all required:

| Field | Type | Description |
|---|---|---|
| `slug` | string | The primitive's canonical slug (`^[a-z0-9][a-z0-9-]{0,127}$`). |
| `semver` | string | Semantic version per semver 2.0. |
| `contentDigest` | string | SHA-256 digest of `content.bytesB64` (decoded). Format: `"sha256:<64 lowercase hex chars>"`. |

The `contentDigest` is the **anchor**: every other field in the bundle
is meaningful only relative to it. A verifier MUST re-hash the
decoded content and refuse the bundle on mismatch (verification
procedure step 1, §7).

### 5.3 `content` (object, required)

The actual primitive bytes. Three fields:

| Field | Type | Description |
|---|---|---|
| `bytesB64` | string | Base64-encoded primitive content (RFC 4648). |
| `sizeBytes` | integer | Length of the decoded bytes in bytes. MUST match the actual decoded length. |
| `mediaType` | string | The primitive's content media type. Default and currently only value: `"text/markdown; charset=utf-8"`. |

`bytesB64` MUST decode to bytes whose SHA-256 equals
`subject.contentDigest` (with the `"sha256:"` prefix stripped).

### 5.4 `attestation` (object, required)

The cryptographic proof + Context CI verdicts. This is where the
trust lives.

| Field | Type | Description |
|---|---|---|
| `predicateType` | string | URI for the in-toto Statement's predicate type. For v0.1: `"https://primitivehub.ai/context-ci/v0.1/Attestation"`. |
| `predicate` | object | Context CI Attestation predicate payload. Schema: `docs/spec.md` § 5.3. MUST include a `validation[]` array of [Context CI Top 10](./context-ci-top-10-v0.1.md) verdicts. |
| `backendName` | string | Which `SigstoreBackend` produced this bundle: one of `"public"`, `"staging"`, `"self-hosted"`, `"noop"`. Per ADR-0011. |
| `certChainPem` | string | PEM-encoded leaf certificate from Fulcio (optionally with intermediates). MUST be valid PEM. |
| `signatureB64` | string | Base64-encoded raw signature over the in-toto Statement bytes. |
| `statementB64` | string | Base64-encoded in-toto Statement bytes (the exact bytes that the signature is over). Decoded, MUST be a valid in-toto Statement v1 whose subject digest matches `subject.contentDigest`. |
| `rekorLogIndex` | integer | Rekor transparency-log entry index (≥0). Stable across CT log restructurings. |
| `rekorLogId` | string | Hex SHA-256 of Rekor's public key (64 hex chars). Identifies WHICH Rekor instance signed this entry. |
| `rekorInclusionProofJson` | string | JSON-encoded inclusion proof. Decoded, MUST contain at minimum `logIndex`, `rootHash`, `treeSize`, `hashes[]`, and `checkpoint`. Lets a verifier confirm offline that the entry IS in the log. |
| `verifyUrl` | string (URL) | Human-readable URL to inspect the Rekor entry. For `backendName=public`: `https://search.sigstore.dev/?logIndex=<index>`. For `staging`: `https://search.sigstage.dev/?logIndex=<index>`. For `self-hosted`: operator-defined. For `noop`: `noop://entry/<log_index>`. Verification logic MUST NOT depend on this URL. |
| `signedAt` | string (RFC 3339) | UTC timestamp when the bundle was signed. |

### 5.5 `detailUrl` (string, optional)

A relative or absolute URL pointing to the issuing PrimitiveHub
instance's human-browseable page for this primitive. Consumers MAY
ignore it. Verification logic MUST NOT depend on it.

## 6. JSON Schema (machine-checkable)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://primitivehub.ai/schemas/trust-bundle/v0.1.json",
  "title": "PrimitiveHub Trust Bundle v0.1",
  "type": "object",
  "required": ["bundleVersion", "subject", "content", "attestation"],
  "additionalProperties": false,
  "properties": {
    "bundleVersion": { "const": "0.1" },
    "subject": {
      "type": "object",
      "required": ["slug", "semver", "contentDigest"],
      "additionalProperties": false,
      "properties": {
        "slug":          { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,127}$" },
        "semver":        { "type": "string", "minLength": 1 },
        "contentDigest": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" }
      }
    },
    "content": {
      "type": "object",
      "required": ["bytesB64", "sizeBytes", "mediaType"],
      "additionalProperties": false,
      "properties": {
        "bytesB64":  { "type": "string" },
        "sizeBytes": { "type": "integer", "minimum": 0 },
        "mediaType": { "type": "string", "minLength": 1 }
      }
    },
    "attestation": {
      "type": "object",
      "required": [
        "predicateType", "predicate", "backendName",
        "certChainPem", "signatureB64", "statementB64",
        "rekorLogIndex", "rekorLogId", "rekorInclusionProofJson",
        "verifyUrl", "signedAt"
      ],
      "additionalProperties": false,
      "properties": {
        "predicateType":           { "type": "string", "format": "uri" },
        "predicate":               { "type": "object" },
        "backendName":             { "enum": ["public", "staging", "self-hosted", "noop"] },
        "certChainPem":            { "type": "string", "minLength": 1 },
        "signatureB64":            { "type": "string", "minLength": 1 },
        "statementB64":            { "type": "string", "minLength": 1 },
        "rekorLogIndex":           { "type": "integer", "minimum": 0 },
        "rekorLogId":              { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "rekorInclusionProofJson": { "type": "string", "minLength": 1 },
        "verifyUrl":               { "type": "string", "format": "uri-reference" },
        "signedAt":                { "type": "string", "format": "date-time" }
      }
    },
    "detailUrl": { "type": "string", "format": "uri-reference" }
  }
}
```

A consumer SHOULD validate every received bundle against this schema
before doing any cryptographic work. The conformance suite's `invalid/`
directory contains bundles that fail this schema in specific ways;
implementations MUST reject all of them.

## 7. Verification procedure (normative)

A conformant consumer holding a Trust Bundle and the appropriate
Sigstore trust root performs these steps. All steps are offline; no
step requires calling back to PrimitiveHub. The procedure MUST be
performed in order; later steps depend on earlier ones.

1. **Schema validation.** Validate the bundle against the JSON Schema
   in §6. Reject with a clear, distinct error per failure.

2. **Re-hash the content.** Decode `content.bytesB64`. Verify
   `sizeBytes` matches the decoded length. Compute SHA-256 of the
   decoded bytes; verify it equals `subject.contentDigest` (after
   stripping the `"sha256:"` prefix). Reject on mismatch. (This is the
   T9 "Trust Drift" defense at the consumer — storage corruption
   surfaced immediately, before the cryptography is even consulted.)

3. **Parse the in-toto Statement.** Decode `attestation.statementB64`
   to bytes. Parse as an in-toto Statement v1. Confirm the Statement's
   subject digest matches `subject.contentDigest`. Confirm the
   Statement's `predicateType` matches `attestation.predicateType`.
   Confirm the Statement's predicate payload equals
   `attestation.predicate` after canonical comparison.

4. **Verify the signature over the Statement.** Using
   `attestation.certChainPem` and `attestation.signatureB64`, verify
   the signature is valid over the bytes from step 3. The leaf certificate's
   public key MUST be the verifying key.

5. **Verify the certificate chain.** Walk `attestation.certChainPem`
   to a Fulcio root certificate present in the consumer's bundled
   Sigstore trust root (selected by `attestation.backendName`).
   Confirm `notBefore <= signedAt <= notAfter` for the leaf. Confirm
   the leaf's OIDC subject claim matches the consumer's policy (if
   any). Reject on chain-of-trust failures.

6. **Verify the Rekor inclusion proof.** Parse
   `attestation.rekorInclusionProofJson`. Confirm the proof's
   `logIndex` matches `attestation.rekorLogIndex`. Reconstruct the
   leaf hash from the Statement + cert per Rekor's `hashedrekord` or
   `dsse` schema (matching `predicateType`'s implied envelope).
   Verify the Merkle inclusion proof against the bundled Rekor public
   key for `attestation.rekorLogId`. Reject on any mismatch.

7. **Apply Context CI policy.** Read the verdicts in
   `attestation.predicate.validation[]`. Apply the consumer's policy:
   the default policy refuses any bundle where any verdict has
   `severity == "fail"`. Advanced consumers may apply per-detector
   override rules; see the Context Policy Language spec (forthcoming).

If all seven steps pass, the bundle is **cryptographically and
semantically trusted** under v0.1.

## 8. HTTP Trust API endpoints

Servers implementing the Trust Contract over HTTP SHOULD expose:

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /api/v1/trust/{slug}/versions/{semver}` | By-slug lookup (human-readable) | Anonymous OK for primitives in registries with `visibility=public`; private primitives require auth + tenant scope per the issuing instance's policy. |
| `GET /api/v1/trust/by-digest/{digest_hex}` | By-digest lookup (canonical content-addressed) | Same. |

The by-digest endpoint is the **verification-overlay shape**: any
consumer holding a primitive's sha256 can ask the server "what do you
know about this hash?" without needing the slug. This is what lets
PrimitiveHub function as a verifier on top of any registry, not just
as a registry itself.

Behavior:
- `200` with `application/vnd.primitivehub.bundle+json` on success.
- `404` if no signed attestation exists for the requested primitive,
  or if the primitive exists but isn't visible to the caller (cross-
  tenant private). The 404 case does not distinguish "doesn't exist"
  from "exists but private" — no existence leak across visibility
  boundaries.
- `400` on malformed digest input (not 64 lowercase hex chars).
- `500` on digest mismatch between attestation and stored content
  (T9 — the registry MUST NOT serve a corrupt bundle; explicit
  failure beats silent corruption).

## 9. Cache discipline

Trust bundles for signed primitives are **immutable**:
`digest` ↔ `bundle` is a content-addressed mapping. Servers SHOULD
set:

- `Cache-Control: public, max-age=31536000, immutable` on by-digest
  responses.
- `Cache-Control: public, max-age=86400` on by-slug responses (the
  slug→digest mapping can change when a new version is released).

CDN edges and consumer-side caches MAY cache by-digest responses
permanently.

## 10. Service-level objectives (SLOs)

Issuing servers that wish to be deployed as production trust providers
SHOULD publish their SLOs alongside this spec's conformance status.
PrimitiveHub-the-canonical-instance commits to:

- **By-digest p50:** < 150ms (origin); < 20ms (CDN-cached).
- **By-digest p95:** < 500ms (origin); < 80ms (CDN-cached).
- **By-slug p50:** < 200ms (origin); < 50ms (CDN-cached).
- **Availability:** 99.9% rolling 30-day.
- **Bundle freshness after publish:** < 60 seconds median; < 5 minutes p99.

Numbers are commitments, not aspirations — enforced by a load test in
CI (Phase 5.5 Week 4, per `docs/execution-plan.md` gate G-B).

## 11. Open issues (v0.1)

Documented limitations of v0.1, tracked for v0.2 or later:

- **Differential attestations** — iterations from a prior version
  currently ship a fresh attestation; a `predecessor_digest` field is
  reserved for v0.2.
- **Bundle composition** — bundle-of-bundles for marketplace Bundles
  isn't formalized; v0.2 will define a composition predicate.
- **Attestation revocation** — v0.1 documents revocation as a
  registry-level state change but does not define a cryptographic
  revocation mechanism. v0.2 candidate: signed revocation list +
  short-lived bundle expiration.
- **Multi-tokenizer counts** — `tokens` is bound to a single declared
  tokenizer. v0.2 may carry multi-tokenizer counts in the predicate.
- **Internationalization** — predicate text fields are English-only in
  v0.1.
- **Policy attached to the bundle** — currently the consumer brings
  its own policy. A v0.2 candidate is `bundle.policyRefs` listing
  policies the publisher recommends.

## 12. References

- ADR-0011 — Sigstore backend abstraction
- ADR-0013 — Trust Bundle format (original decision; superseded by
  this spec's promotion to standalone but historically authoritative)
- ADR-0015 — Trust Contract v0.1 versioning + deprecation policy
- ADR-0020 — `@primitivehub/verify` as the reference implementation
- ADR-0021 — Conformance suite as the executable contract definition
- [Context CI Top 10 v0.1](./context-ci-top-10-v0.1.md) — taxonomy
  referenced by the attestation predicate's `validation[]` block
- [Primitive Spec v0.1](./spec.md) — frontmatter, body, content
  addressing, the in-toto Attestation predicate payload schema (§ 5.3)
- [Threat Model](./threat-model.md) — what Context CI defends against
- [in-toto Attestation Spec](https://github.com/in-toto/attestation)
- [Sigstore Bundle v0.3 protobuf
  spec](https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto)
- [RFC 4648 Base64](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6838 Media Type Specifications and Registration
  Procedures](https://www.rfc-editor.org/rfc/rfc6838)
