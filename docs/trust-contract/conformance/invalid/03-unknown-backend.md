# invalid/03-unknown-backend

**Verification step expected to reject:** step 1 (schema validation).

**What's wrong:** `attestation.backendName` is `"bogus"`, not one of
the four legal values: `public`, `staging`, `self-hosted`, `noop`.

**Expected consumer behavior:** reject with a clear "unknown backend"
error. A conformant verifier maps `backendName` to a specific Sigstore
trust root (per ADR-0011); an unknown backend has no trust root and
therefore no path to cryptographic verification.

**Why this matters:** prevents a malicious or buggy producer from
synthesizing a bundle that pretends to be signed by a backend the
consumer doesn't ship trust for. The schema's enum is the
gate; per ADR-0015, adding a backend is a major version bump.

**Schema validation:** fails (JSON Schema enum constraint unmet).
**Semantic validation:** not reached.
