# invalid/01-digest-mismatch

**Verification step expected to reject:** step 2 (re-hash the content).

**What's wrong:** `subject.contentDigest` is `sha256:000...000` (all zeros)
but `content.bytesB64` decodes to `# Minimal\n` whose actual SHA-256 is
`10af9d6bbf8461d5ef3b1dbf70d242c9e18b9f9a450168b0caaccdcbc916736e`.

**Expected consumer behavior:** reject the bundle with a clear error
identifying the mismatch. The bundle passes JSON Schema validation
(both fields are well-formed `sha256:<64-hex>`); the mismatch surfaces
only when the consumer re-hashes the decoded content.

**Why this matters:** T9 (Trust Drift) — a storage layer that
corrupts content or a registry that lies about what it serves. A
conformant verifier catches the lie before any cryptographic work.

**Schema validation:** passes.
**Semantic validation:** fails at step 2.
