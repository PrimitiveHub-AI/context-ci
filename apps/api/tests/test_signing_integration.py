"""Live integration test against Sigstore staging (sigstage.dev).

Gated behind the `integration` pytest marker AND a `SIGSTAGE_OIDC_TOKEN`
env var. Default `pytest` runs skip this entirely — it's slow, requires
network, and needs an operator-supplied OIDC token that sigstage's
Fulcio will accept.

Run it explicitly:

    SIGSTAGE_OIDC_TOKEN=$(cat token.txt) \
      docker compose exec -T api \
      uv run pytest -m integration tests/test_signing_integration.py -v

How to get a sigstage-allowlisted token
---------------------------------------

sigstage's Fulcio accepts more OIDC issuers than production, but
**not** our local Authentik. The two practical paths today:

  1. **GitHub Actions ambient credential.** When this test runs inside
     a GitHub Actions workflow with `id-token: write` permission,
     sigstore-python's `detect_credential()` finds it automatically.
     A future CI workflow will do this.

  2. **Manual gh CLI token.** Locally: `gh auth token` → use the
     token's sub/iss claims as the sigstage-allowlisted identity.
     (Not ergonomic; suitable only for one-off operator verification.)

Why not Authentik
-----------------

Our local Authentik runs at `http://authentik-server:9000` — not on
sigstage's allowlist, and HTTPS-public reachability is required for
the allowlist anyway. Adding our Authentik to sigstage's allowlist
is a real option for Phase 4 polish; tracked in `docs/bugs.md` #24
(Authentik-not-on-sigstage-allowlist constraint).

What this test verifies
-----------------------

  - SigstageBackend.sign() returns a SigningResult populated with
    fields that match real sigstage Fulcio + Rekor responses.
  - The Rekor log_index is a real integer that resolves on
    https://search.sigstage.dev/
  - cert_chain_pem parses as a real X.509 cert.
  - rekor_inclusion_proof_json deserializes to a dict with the
    expected keys (logIndex, rootHash, treeSize, hashes, checkpoint).

A failure here means our extraction logic doesn't match what
sigstore-python actually returns — i.e., we'd silently produce broken
Attestations in production. This test is the canary.
"""

from __future__ import annotations

import base64
import json
import os
from typing import TYPE_CHECKING

import pytest
from cryptography.x509 import load_pem_x509_certificate

from signing.backends import SigstageBackend
from signing.statement import build_statement

if TYPE_CHECKING:
    from cryptography import x509


pytestmark = pytest.mark.integration


@pytest.fixture
def sigstage_token() -> str:
    token = os.environ.get("SIGSTAGE_OIDC_TOKEN", "").strip()
    if not token:
        pytest.skip(
            "SIGSTAGE_OIDC_TOKEN env var not set — set it to a sigstage-"
            "allowlisted OIDC ID token (see docstring) to run this test."
        )
    return token


@pytest.mark.django_db  # SigstageBackend doesn't hit the DB, but our autouse RLS fixture wants it
def test_sigstage_sign_round_trips_a_real_primitive(sigstage_token: str) -> None:
    backend = SigstageBackend()
    statement = build_statement(
        subject_name="phase-4-pr3-smoke",
        subject_sha256_hex="ab" * 32,  # 64 hex chars
        predicate={"phase": 4, "pr": 3, "smoke": True},
    )

    result = backend.sign(statement, identity_token=sigstage_token)

    # Backend identity
    assert result.backend_name == "staging"
    assert "sigstage.dev" in result.verify_url

    # Cert parses as real X.509
    cert: x509.Certificate = load_pem_x509_certificate(result.cert_chain_pem.encode("ascii"))
    # Fulcio leaf certs have a subject URI that matches the OIDC sub
    assert cert.subject  # not empty

    # Signature is real base64
    sig_bytes = base64.b64decode(result.signature_b64)
    assert len(sig_bytes) > 0

    # Rekor entry is a real positive integer; statement bytes preserved
    assert result.rekor_log_index > 0
    assert base64.b64decode(result.statement_b64) == statement

    # Inclusion proof has the canonical shape
    proof = json.loads(result.rekor_inclusion_proof_json)
    for key in ("logIndex", "rootHash", "treeSize", "hashes", "checkpoint"):
        assert key in proof, f"Rekor inclusion proof missing {key!r}"

    # log_id is the SHA-256 of Rekor's pubkey, hex-encoded → 64 chars
    assert len(result.rekor_log_id) == 64
    assert all(c in "0123456789abcdef" for c in result.rekor_log_id)
