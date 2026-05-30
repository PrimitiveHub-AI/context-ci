"""signing — Sigstore-backed attestation pipeline.

This package is the **backend-agnostic** signing layer. The pipeline is:

    primitive content (bytes)
        → in-toto Statement (statement.py)
        → SigstoreBackend.sign(statement, identity_token)
        → SigningResult (cert chain + signature + Rekor inclusion proof)

The `SigstoreBackend` Protocol (backends.py) has three production
implementations selected by the `SIGSTORE_BACKEND` env var:

    public       — public Sigstore (Fulcio + Rekor at sigstore.dev).
                   Production posture for the public registry.

    staging      — Sigstore staging (sigstage.dev). Same code path, but
                   doesn't write to the public transparency log. Default
                   for dev so we can iterate without polluting Rekor or
                   needing a public Authentik issuer on Fulcio's allowlist.

    self-hosted  — operator-supplied Fulcio + Rekor URLs + trust root.
                   Phase 7 enterprise path: private registries whose
                   author identities must NOT appear in the public log.

A fourth `noop` backend exists for tests — produces a fixed deterministic
SigningResult without calling out anywhere.

This abstraction is THE category-creator commitment. Most signing
integrations bind to a single Sigstore instance and pay the cost when
they need to swap. We pay the cost once, here, so Phase 7 isn't a
panic project.

See ADR-0011 for the full rationale.
"""
