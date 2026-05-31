# ADR-0013: Trust Bundle format — `application/vnd.primitivehub.bundle+json`

**Status:** Accepted
**Date:** 2026-05-30
**Supersedes:** none
**Related:** ADR-0011 (Sigstore backend abstraction), ADR-0012
(Detector Protocol), `docs/spec.md` § 10

## Context

Phase 5.5 starts the **runtime trust API** — the layer that turns
PrimitiveHub from a destination (humans browse) into infrastructure
(agents query at runtime). The first piece is the wire format that
agents, CLIs, MCP servers, and OSS verifiers consume.

We need a contract for "what does a verified primitive look like on
the wire?" that:

1. Is **self-contained** — verifiable offline against bundled Sigstore
   trust roots, no network call back to PrimitiveHub required.
2. Is **stable** — third parties (Hugging Face, npm, internal
   registries) can adopt the format and produce conformant bundles.
3. Carries **everything** a consumer needs: content, signature, cert
   chain, Rekor inclusion proof, AND Context CI verdicts.
4. Distinguishes itself from existing media types so HTTP content
   negotiation works.
5. Doesn't lock us into PrimitiveHub-specific decoder libraries.

## Decision

A JSON document with media type
`application/vnd.primitivehub.bundle+json`, schema versioned via the
`bundleVersion` field. Initial version: `0.1`.

Five top-level keys:

- `bundleVersion` — schema version string
- `subject` — slug + semver + sha256 digest
- `content` — base64 bytes + size + media type
- `attestation` — Sigstore bundle fields (cert / sig / Rekor proof) +
  Context CI predicate
- `detailUrl` — convenience back-link to the issuer's UI

Full structure + per-field semantics live in `docs/spec.md` § 10.2.
Verification procedure in § 10.3.

The format is **content-addressed at the subject layer**
(`subject.contentDigest`) and **transparency-logged at the attestation
layer** (`attestation.rekorLogIndex` + inclusion proof). A consumer
who trusts (a) the Sigstore trust root and (b) PrimitiveHub-the-issuer
not to backdate signatures gets a complete proof chain offline.

## Alternatives considered

1. **Use the raw sigstore-bundle v0.3 protobuf JSON directly.**
   Rejected. The sigstore bundle is just signature + cert + Rekor
   entry — it doesn't carry the SUBJECT (content) or the CONTEXT CI
   PREDICATE. A consumer would need to fetch both separately + glue
   them together. Our wrapper packages all three so the agent makes
   one API call.

2. **DSSE envelope as the wire format.** Considered. DSSE
   (Dead-Simple Signing Envelope) is what in-toto Statements
   technically live inside. But DSSE alone doesn't carry the
   verification artifacts (Rekor inclusion proof, cert chain) — those
   live in the sigstore bundle. We'd end up with `DSSE-inside-sigstore-
   bundle-inside-our-bundle`, which is fine semantically but ugly on
   the wire. The flat structure is easier to verify and easier to
   document.

3. **Streaming binary format (CBOR / MessagePack / Protobuf).**
   Rejected for v0.1. JSON wins for:
   - Debuggability (you can `curl` it and read it)
   - Standard tooling in every language
   - HTTP caching headers + CDN compatibility (compression-friendly)
   - First-party + third-party adoption friction
   Bandwidth cost (~2× a binary equivalent for the cert chain + raw
   signature) is acceptable; primitives are KB-scale documents.

4. **Embed the content directly in the in-toto Statement's
   `predicate`.** Rejected. In-toto Statements bind a predicate to a
   subject via digest; embedding the content in the predicate
   violates that separation + bloats Rekor entries. Our model keeps
   in-toto orthodox: Statement says "I attest digest=X has these
   properties"; the wire bundle carries the bytes that hash to X.

5. **Multiple bundles per response (paginated).** Rejected for v0.1.
   Trust bundles are single-primitive; bulk queries are a future
   concern. A "manifest of bundles" type may ship in Phase 11
   federation, but it'd be a separate media type
   (`application/vnd.primitivehub.bundle-manifest+json`).

## Consequences

### Positive

- **Verification works offline.** Agents that pre-fetch bundles can
  validate them in air-gapped environments, on planes, in CI without
  network.
- **The format is open and copyable.** Any registry can produce a
  bundle in this shape; any verifier can consume it. We become the
  spec author, which is a stronger position than being the sole
  hoster.
- **Content-addressed lookup falls out for free.** `GET /trust/by-digest/
  <hash>` is the canonical lookup; any consumer that has the content
  can ask "what do you know about this?" — the **Snyk-overlay** play.
- **Immutable cache discipline.** By-digest responses cache forever
  (`max-age=31536000, immutable`). Edge networks (Cloudflare in
  front of our origin, Fastly in front of consumers' agents) absorb
  the read load.
- **Forward-compatible.** Adding fields to the bundle is non-breaking
  (consumers ignore unknown keys); removing or renaming is a
  bundleVersion bump.

### Negative

- **Bundle size.** Cert chain (~2 KB) + signature (~64 B) + Rekor
  inclusion proof (~1-3 KB depending on tree height) + base64 content
  overhead (33% inflation). A 5 KB primitive becomes a ~12 KB bundle.
  Acceptable for KB-scale primitives; revisit if MB-scale primitives
  land (currently capped at 1 MiB per PRIMITIVE_MAX_BYTES).
- **One trust root per bundle.** The `attestation.backendName` tells
  the consumer which Sigstore deployment signed (public / staging /
  self-hosted), and the consumer must have that trust root bundled.
  A verifier that only ships the public trust root will refuse
  staging-signed bundles. Acceptable: the noop backend's name
  signals "test only," real verifiers reject it; production verifiers
  ship the public trust root; enterprise verifiers ship the operator's.
- **`predicate` is opaque to the wire spec.** The Context CI
  predicate's schema lives in `docs/spec.md` § 5.3, not here. A
  bundle whose predicate violates that schema is still a valid
  bundle for the format's purposes; consumers MUST validate the
  predicate separately if they care about Context CI results.

### Neutral

- **bundleVersion is independent of spec.md version.** We can rev
  the wire format without revving the in-toto Statement; we can rev
  the predicate without revving the bundle.

## Implementation

- `apps/api/registry/schemas.py` — `TrustBundleOut`,
  `TrustBundleSubject`, `TrustBundleContent`, `TrustBundleAttestation`.
  Pydantic (via Django Ninja's CamelSchema base) — produces JSON in
  camelCase per our existing API conventions.
- `apps/api/registry/api.py`:
  - `GET /api/v1/trust/{slug}/versions/{semver}` — by-slug lookup
  - `GET /api/v1/trust/by-digest/{digest_hex}` — by-digest lookup
  - `_serialize_trust_bundle()` + `_trust_bundle_for_version()` —
    shared serializer
- `apps/api/tests/test_trust_endpoints.py` — 6 tests covering both
  endpoints, the IDOR shape, the digest validation, the "no signed
  attestation = 404" rule.
- `docs/spec.md` § 10 — the wire-contract documentation; the
  consumer-facing source of truth.

## What ships in subsequent Phase 5.5 PRs

- **PR 5.5.2** — `phub` CLI MVP (`fetch`, `verify`, `cache`). Reads
  bundles from the trust endpoints; verifies them locally; manages
  the on-disk cache. ALSO: public-anonymous bundle access for
  primitives in registries with `visibility=public` (the
  `public_read` Postgres role + visibility-gated query path).
- **PR 5.5.3** — `context-ci-verify` OSS library (Python + TypeScript).
  Free, MIT, no PrimitiveHub dependency at runtime. Verifies any
  bundle against any Sigstore trust root.
- **PR 5.5.4** — `@primitivehub/mcp-server`. Thin shim over the
  HTTP API; exposes `primitivehub.search` / `primitivehub.fetch` /
  `primitivehub.verify` tools to Claude Code / Cursor / any MCP-
  speaking agent.

## References

- `docs/spec.md` § 10 — Trust Bundle wire spec (canonical)
- `docs/innovation/runtime-trust-api.md` — original brainstorm
- ADR-0011 — the Sigstore backend that produces the bundle's
  attestation fields
- ADR-0012 — the Detector Protocol that produces the `predicate.
  validation[]` block
- Sigstore Bundle v0.3 spec:
  https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto
- in-toto Attestation Spec:
  https://github.com/in-toto/attestation
