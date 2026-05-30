"""Shared types for the signing pipeline.

`SigningResult` is the contract between the backend and the storage
layer. Every field corresponds to a column the `Attestation` model
will gain in Phase 4 PR #3 (`feat/api-sign-on-upload`).

These are intentionally plain dataclasses, not Pydantic / Django
models — they cross the backend boundary and we want the type to be
trivially serializable, picklable (Procrastinate stores task results
as JSON), and inspectable in shell sessions.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SigningResult:
    """The outcome of a successful sign+log operation.

    Attributes
    ----------
    backend_name
        Which backend produced this result (`public` / `staging` /
        `self-hosted` / `noop`). Stored alongside the cert so a later
        verifier knows which trust root to use.
    cert_chain_pem
        PEM-encoded leaf cert + intermediates from Fulcio. The leaf
        binds the signer's OIDC identity (email, issuer) to the
        ephemeral signing key.
    signature_b64
        Base64-encoded raw signature over the Statement.
    rekor_log_index
        The integer index of the entry in Rekor's transparency log.
        Stable across CT log restructurings.
    rekor_log_id
        SHA-256 of the public key Rekor used to sign the entry. With
        `rekor_log_index`, this uniquely identifies the entry.
    rekor_inclusion_proof_json
        JSON-serialized inclusion proof. Lets any third party verify
        offline that the entry IS in the log (no need to query Rekor).
    statement_b64
        The base64-encoded in-toto Statement that was signed. Stored so
        we can re-verify offline without re-fetching from the registry.
    verify_url
        Backend-specific HTTPS URL that displays the Rekor entry in
        the appropriate search UI. Mostly UX — verification logic uses
        `rekor_log_index` + `rekor_log_id`, not this URL.
    """

    backend_name: str
    cert_chain_pem: str
    signature_b64: str
    rekor_log_index: int
    rekor_log_id: str
    rekor_inclusion_proof_json: str
    statement_b64: str
    verify_url: str
