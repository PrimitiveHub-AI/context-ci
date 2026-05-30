"""Unit tests for the real Sigstore backends' sign() path.

These tests mock `SigningContext.from_trust_config()` and the resulting
`Signer`/`Bundle` so we can verify our extraction logic
(`_bundle.bundle_to_signing_result`) end-to-end without hitting the
network. The integration test in `test_signing_integration.py` covers
the real-network path against sigstage (gated behind a pytest marker).

What we're proving here:

1. Bundle JSON parsing extracts log_index, log_id, inclusion_proof
   correctly into SigningResult.
2. Signature + cert PEM are pulled from the right Bundle attributes.
3. verify_url is constructed using the extracted log_index.
4. SigningFailedError wraps every underlying failure mode (token
   construction, signer raise, malformed bundle).
5. Exception cause chains are preserved (`__cause__` is set), so
   PR #4's Procrastinate retry policy can inspect them.
"""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from signing.backends import (
    PublicSigstoreBackend,
    SelfHostedSigstoreBackend,
    SigstageBackend,
)
from signing.exceptions import SigningFailedError


def _fake_cert_pem_bytes() -> bytes:
    """Synthetic but valid-PEM-shaped cert for mock bundles."""
    return (
        b"-----BEGIN CERTIFICATE-----\n"
        b"MOCK-FAKE-CERT-FOR-UNIT-TEST-ONLY-NOT-A-REAL-CERT\n"
        b"-----END CERTIFICATE-----\n"
    )


def _build_mock_bundle(
    *,
    log_index: int = 1234567,
    log_id_hex: str = "a" * 64,
    inclusion_proof: dict[str, Any] | None = None,
    signature: bytes = b"\x00\x01\x02\x03",
) -> MagicMock:
    """Construct a MagicMock that quacks like sigstore.models.Bundle.

    Only the attributes our extraction code touches are populated;
    everything else stays as MagicMock auto-attrs so we'd notice if
    the extraction started reaching into new fields.
    """
    if inclusion_proof is None:
        inclusion_proof = {
            "logIndex": str(log_index),
            "rootHash": "deadbeef",
            "treeSize": "100",
            "hashes": ["hash1", "hash2"],
            "checkpoint": {"envelope": "checkpoint-data"},
        }

    bundle_json_dict = {
        "verificationMaterial": {
            "tlogEntries": [
                {
                    "logIndex": str(log_index),
                    "logId": {
                        "keyId": base64.b64encode(binascii.unhexlify(log_id_hex)).decode("ascii"),
                    },
                    "inclusionProof": inclusion_proof,
                }
            ]
        }
    }

    bundle = MagicMock()
    bundle.to_json = MagicMock(return_value=json.dumps(bundle_json_dict))
    bundle.signature = signature

    # signing_certificate is a cryptography x509.Certificate. We only
    # call .public_bytes(Encoding.PEM) on it — mock that.
    cert = MagicMock()
    cert.public_bytes = MagicMock(return_value=_fake_cert_pem_bytes())
    bundle.signing_certificate = cert

    return bundle


def _patch_signing_context(bundle: MagicMock) -> Any:
    """Patch the sigstore.sign.SigningContext.signer context manager
    on the backend's _signing_context() to yield a mock signer whose
    sign_artifact() returns our `bundle`.
    """
    mock_signer = MagicMock()
    mock_signer.sign_artifact = MagicMock(return_value=bundle)

    mock_signer_cm = MagicMock()
    mock_signer_cm.__enter__ = MagicMock(return_value=mock_signer)
    mock_signer_cm.__exit__ = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.signer = MagicMock(return_value=mock_signer_cm)

    return mock_context, mock_signer


# ─────────────────────────────────────────────────────────────────────────────
# Happy path: every real backend signs a statement and returns the
# expected SigningResult shape.
# ─────────────────────────────────────────────────────────────────────────────
class TestRealBackendsHappyPath:
    @pytest.mark.parametrize(
        ("backend_class", "expected_name", "verify_substring"),
        [
            (PublicSigstoreBackend, "public", "search.sigstore.dev"),
            (SigstageBackend, "staging", "search.sigstage.dev"),
        ],
    )
    def test_sign_returns_populated_signing_result(
        self,
        backend_class: type,
        expected_name: str,
        verify_substring: str,
    ) -> None:
        backend = backend_class()
        bundle = _build_mock_bundle(log_index=999_999)
        mock_context, _ = _patch_signing_context(bundle)

        with (
            patch.object(backend, "_signing_context", return_value=mock_context),
            patch("sigstore.oidc.IdentityToken") as mock_id_token,
        ):
            mock_id_token.return_value = MagicMock()
            result = backend.sign(b"statement-bytes", identity_token="fake-jwt")

        assert result.backend_name == expected_name
        assert result.rekor_log_index == 999_999
        assert "MOCK-FAKE-CERT" in result.cert_chain_pem
        # signature was b"\x00\x01\x02\x03" → base64 "AAECAw=="
        assert result.signature_b64 == "AAECAw=="
        # log_id was 'a' * 64 (64 hex chars = 32 bytes) → round-trips
        assert result.rekor_log_id == "a" * 64
        # inclusion proof is JSON-serialized
        proof = json.loads(result.rekor_inclusion_proof_json)
        assert proof["treeSize"] == "100"
        # statement bytes preserved
        assert base64.b64decode(result.statement_b64) == b"statement-bytes"
        # verify_url incorporates log_index AND backend's search domain
        assert "logIndex=999999" in result.verify_url
        assert verify_substring in result.verify_url

    def test_self_hosted_sign_uses_template_verify_url(self, tmp_path) -> None:
        trust_file = tmp_path / "trust.json"
        trust_file.write_text("{}")
        backend = SelfHostedSigstoreBackend(
            trust_config_path=trust_file,
            rekor_url="https://rekor.example.com",
            verify_url_template="https://audit.example.com/entry/{log_index}",
        )

        bundle = _build_mock_bundle(log_index=42)
        mock_context, _ = _patch_signing_context(bundle)

        with (
            patch.object(backend, "_signing_context", return_value=mock_context),
            patch("sigstore.oidc.IdentityToken") as mock_id_token,
        ):
            mock_id_token.return_value = MagicMock()
            result = backend.sign(b"x", identity_token="fake-jwt")

        assert result.backend_name == "self-hosted"
        assert result.verify_url == "https://audit.example.com/entry/42"


# ─────────────────────────────────────────────────────────────────────────────
# Failure modes: every underlying exception becomes a SigningFailedError
# with the original preserved as __cause__.
# ─────────────────────────────────────────────────────────────────────────────
class TestRealBackendsFailureModes:
    def test_invalid_oidc_token_raises_signing_failed_with_cause(self) -> None:
        backend = SigstageBackend()
        with (
            patch.object(backend, "_signing_context"),
            patch(
                "sigstore.oidc.IdentityToken",
                side_effect=ValueError("token expired"),
            ),
            pytest.raises(SigningFailedError, match="OIDC identity token") as exc_info,
        ):
            backend.sign(b"x", identity_token="bad-jwt")
        assert isinstance(exc_info.value.__cause__, ValueError)

    def test_signer_raise_becomes_signing_failed(self) -> None:
        backend = SigstageBackend()
        mock_context = MagicMock()
        # signer() as a context manager that raises on __enter__
        mock_signer_cm = MagicMock()
        mock_signer_cm.__enter__ = MagicMock(side_effect=RuntimeError("rekor down"))
        mock_signer_cm.__exit__ = MagicMock(return_value=False)
        mock_context.signer = MagicMock(return_value=mock_signer_cm)

        with (
            patch.object(backend, "_signing_context", return_value=mock_context),
            patch("sigstore.oidc.IdentityToken") as mock_id_token,
        ):
            mock_id_token.return_value = MagicMock()
            with pytest.raises(SigningFailedError, match="sign_artifact failed") as exc_info:
                backend.sign(b"x", identity_token="jwt")
        assert isinstance(exc_info.value.__cause__, RuntimeError)

    def test_malformed_bundle_missing_tlog_raises(self) -> None:
        """If sigstore-python ever returns a bundle without tlogEntries
        (would be a bug in their code), we fail loudly rather than
        store a SigningResult with garbage Rekor fields."""
        backend = SigstageBackend()
        bundle = MagicMock()
        bundle.to_json = MagicMock(
            return_value=json.dumps({"verificationMaterial": {"tlogEntries": []}})
        )
        mock_context, _ = _patch_signing_context(bundle)
        # Override the helper since the bundle is intentionally bad
        mock_signer = mock_context.signer.return_value.__enter__.return_value
        mock_signer.sign_artifact.return_value = bundle

        with (
            patch.object(backend, "_signing_context", return_value=mock_context),
            patch("sigstore.oidc.IdentityToken") as mock_id_token,
        ):
            mock_id_token.return_value = MagicMock()
            with pytest.raises(SigningFailedError, match="log_index"):
                backend.sign(b"x", identity_token="jwt")
