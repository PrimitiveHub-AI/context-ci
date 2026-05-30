# ADR-0008: Object key IS the content digest

**Status:** Accepted
**Date:** 2026-05-29

## Context

Primitive versions are immutable artifacts. They need an object-storage
identity. Conventional patterns:

1. UUID per version. Key = `<uuid>`. Content lives at that key forever.
2. Path-based. Key = `<org>/<registry>/<primitive>/<semver>.md`.
3. Content-addressed. Key = some hash of the content.

The choice ripples through verification, deduplication, attestation
predicates, immutability guarantees, and what "T9 Trust Drift via
mutation" actually means.

## Decision

Content-addressed: **object key = `sha256:<hex-digest-of-canonical-content>`**.

The digest is computed server-side at upload. The client never declares
the digest. Re-hashing the bytes from storage on every read MUST match
the digest in the key — otherwise the endpoint refuses to serve (T9
detection). This is the runtime defense the spec promises.

## Alternatives considered

1. **UUID per version** — Conventional. Rejected because:
   - Loses the verification property. The bytes at a UUID key could
     be anything; you can only verify by also storing the digest
     separately and comparing.
   - Loses deduplication. Two authors uploading the same primitive
     content produce two storage objects, not one.
   - Mutation isn't detectable: if someone replaces the bytes at
     `uuid-X`, the database still says "this version is uuid-X" and
     consumers see the new content silently.

2. **Path-based key** — Same critique as UUID, plus the additional
   problem that path-based keys are MUTABLE (renaming or republishing
   reuses the path). Mutation is the threat we're defending against.

3. **Content-addressed BUT separate the digest from the key** —
   (Sigstore stores artifact content + the signed digest separately).
   Rejected because the key-is-the-digest property is what enables
   the re-hash-on-read verification to be trivial: download by key,
   hash the bytes, compare to the key. No metadata lookup needed.

## Consequences

**Positive:**
- Self-verifying. `get_primitive_content(digest)` re-hashes the bytes
  and asserts they match `digest`. Tampered storage → DigestMismatchError
  → endpoint refuses. T9 detection is automatic, not a separate code
  path.
- Deduplication. Same content uploaded twice produces the same key;
  R2 PUT is idempotent on conflict.
- Spec-clean. The Primitive Spec v0.1 §4 says "object key = sha256:
  <hex>". The implementation matches the spec exactly.
- Attestation predicate references the digest as the subject — same
  string the storage key uses. No double-bookkeeping.

**Negative:**
- A primitive content change requires a new version with a new key.
  This is the desired behavior (immutability) but requires authors to
  understand they can't "edit in place".
- No human-readable storage paths. Debugging "what's at
  `sha256:cf95...`" requires a Postgres lookup. Mitigation: the api
  responds to `GET /primitives/{slug}/versions/{semver}/content` with
  the bytes + `X-Content-Digest` header; users never type raw keys.
- Storage costs (in theory) are higher than path-based because no
  natural pruning. In practice, primitive content is small (~10 KB
  typical), so this is invisible.

## References

- `docs/spec.md` §4 — canonical content-addressing definition.
- `apps/api/storage/digest.py` — `compute_digest`, `storage_key_for_digest`,
  `read_with_digest`.
- `apps/api/storage/client.py` — `put_primitive_content`,
  `get_primitive_content` (with re-hash + DigestMismatchError).
- `apps/api/tests/test_storage_api.py::test_content_get_with_tampered_storage_returns_500`
  — the T9 integration test.
- `docs/threat-model.md` — full threat model with T-numbers.
- `apps/web/content/primitives/security-engineering-supplychain.md`
  § Cryptographic decisions — never invent crypto; use SHA-256
  consistently.
