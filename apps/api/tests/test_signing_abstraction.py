"""Tests for the Sigstore backend abstraction (Phase 4 PR #2).

Scope: the abstraction layer only. The real backends (public, staging,
self-hosted) raise on sign() because the cryptography call ships in
PR #3; the noop backend is fully implemented and tests verify its
contract. The statement builder is tested in full — that's the part
that has to be correct for the Rekor entry to be valid.

These tests run without network access. PR #5 will add integration
tests that hit sigstage.dev with a real OIDC token.
"""

from __future__ import annotations

import base64
import json

import pytest
from django.test import override_settings

from signing.backends import (
    ALL_BACKEND_NAMES,
    NoopSigstoreBackend,
    PublicSigstoreBackend,
    SelfHostedSigstoreBackend,
    SigstageBackend,
    get_backend,
)
from signing.exceptions import (
    BackendConfigurationError,
    SigningFailedError,
    StatementValidationError,
    UnknownBackendError,
)
from signing.statement import (
    IN_TOTO_STATEMENT_TYPE,
    PRIMITIVEHUB_PREDICATE_TYPE,
    build_statement,
    serialize_for_storage,
)
from signing.types import SigningResult


# ─────────────────────────────────────────────────────────────────────────────
# Statement builder
# ─────────────────────────────────────────────────────────────────────────────
class TestBuildStatement:
    def test_returns_canonical_bytes_with_expected_subject_and_predicate(self) -> None:
        digest = "a" * 64
        bytes_out = build_statement(
            subject_name="elite-mobile-design",
            subject_sha256_hex=digest,
            predicate={"validations_passed": True, "reviewer_count": 3},
        )

        # Round-trip via protobuf to validate structure without re-coding it
        from in_toto_attestation.v1 import statement_pb2

        parsed = statement_pb2.Statement.FromString(bytes_out)
        assert parsed.type == IN_TOTO_STATEMENT_TYPE
        assert parsed.predicate_type == PRIMITIVEHUB_PREDICATE_TYPE
        assert len(parsed.subject) == 1
        assert parsed.subject[0].name == "elite-mobile-design"
        assert dict(parsed.subject[0].digest) == {"sha256": digest}
        # Predicate is a google.protobuf.Struct → convert to plain dict
        from google.protobuf.json_format import MessageToDict

        predicate = MessageToDict(parsed.predicate)
        assert predicate == {"validations_passed": True, "reviewer_count": 3}

    def test_empty_predicate_is_legal(self) -> None:
        bytes_out = build_statement(
            subject_name="x",
            subject_sha256_hex="b" * 64,
            predicate={},
        )
        assert bytes_out  # non-empty

    @pytest.mark.parametrize(
        "bad_slug",
        ["", "UPPERCASE", "has space", "-leading-dash", "a" * 200],
    )
    def test_rejects_invalid_subject_name(self, bad_slug: str) -> None:
        with pytest.raises(StatementValidationError, match="not a valid primitive slug"):
            build_statement(
                subject_name=bad_slug,
                subject_sha256_hex="c" * 64,
                predicate={},
            )

    @pytest.mark.parametrize(
        "bad_digest",
        [
            "short",
            "g" * 64,  # 'g' is not hex
            "A" * 64,  # uppercase rejected (must be lowercase per convention)
            "f" * 63,  # one short
            "f" * 65,  # one long
        ],
    )
    def test_rejects_invalid_digest(self, bad_digest: str) -> None:
        with pytest.raises(StatementValidationError, match="64 lowercase hex chars"):
            build_statement(
                subject_name="ok-slug",
                subject_sha256_hex=bad_digest,
                predicate={},
            )

    def test_serialize_for_storage_is_b64_round_trip(self) -> None:
        statement_bytes = build_statement(
            subject_name="x",
            subject_sha256_hex="d" * 64,
            predicate={"k": "v"},
        )
        encoded = serialize_for_storage(statement_bytes)
        assert base64.b64decode(encoded) == statement_bytes


# ─────────────────────────────────────────────────────────────────────────────
# Noop backend — full contract
# ─────────────────────────────────────────────────────────────────────────────
class TestNoopBackend:
    def test_sign_returns_fully_populated_signing_result(self) -> None:
        backend = NoopSigstoreBackend()
        statement = build_statement(
            subject_name="elite-mobile-design",
            subject_sha256_hex="e" * 64,
            predicate={},
        )

        result = backend.sign(statement, identity_token="fake-token-irrelevant")

        assert isinstance(result, SigningResult)
        assert result.backend_name == "noop"
        assert "BEGIN CERTIFICATE" in result.cert_chain_pem
        assert "END CERTIFICATE" in result.cert_chain_pem
        assert result.signature_b64  # non-empty
        assert result.rekor_log_index > 0
        assert result.rekor_log_id
        # inclusion proof should parse as JSON
        proof = json.loads(result.rekor_inclusion_proof_json)
        assert proof["backend"] == "noop"
        assert proof["verified"] is True
        # statement bytes are preserved
        assert base64.b64decode(result.statement_b64) == statement
        # verify_url uses the noop template
        assert result.verify_url.startswith("noop://entry/")

    def test_sign_is_deterministic_for_same_statement(self) -> None:
        """Idempotent fixtures: same input → same SigningResult."""
        backend = NoopSigstoreBackend()
        statement = build_statement(
            subject_name="foo",
            subject_sha256_hex="1" * 64,
            predicate={"a": 1},
        )

        r1 = backend.sign(statement, identity_token="t1")
        r2 = backend.sign(statement, identity_token="t2")  # token doesn't matter

        assert r1 == r2

    def test_different_statements_produce_different_results(self) -> None:
        backend = NoopSigstoreBackend()
        s1 = build_statement(
            subject_name="foo",
            subject_sha256_hex="1" * 64,
            predicate={},
        )
        s2 = build_statement(
            subject_name="bar",
            subject_sha256_hex="2" * 64,
            predicate={},
        )
        r1 = backend.sign(s1, identity_token="t")
        r2 = backend.sign(s2, identity_token="t")
        assert r1 != r2
        assert r1.rekor_log_index != r2.rekor_log_index


# ─────────────────────────────────────────────────────────────────────────────
# Real backends — sign() is not wired yet, construction must succeed
# ─────────────────────────────────────────────────────────────────────────────
class TestRealBackends:
    """These tests prove the abstraction composes against the real
    sigstore-python library. They don't make network calls — they
    only verify the SigningContext can be CONSTRUCTED. If any of
    these fail, the API-shape assumption in backends.py is wrong
    and PR #3 will not be able to wire sign()."""

    def test_public_backend_signer_raises_with_pr3_pointer(self) -> None:
        backend = PublicSigstoreBackend()
        assert backend.name == "public"
        assert "sigstore.dev" in backend.rekor_url
        with pytest.raises(SigningFailedError, match="PR #3"):
            backend.sign(b"x", identity_token="t")

    def test_staging_backend_signer_raises_with_pr3_pointer(self) -> None:
        backend = SigstageBackend()
        assert backend.name == "staging"
        assert "sigstage.dev" in backend.rekor_url
        with pytest.raises(SigningFailedError, match="PR #3"):
            backend.sign(b"x", identity_token="t")

    def test_verify_url_uses_log_index(self) -> None:
        public = PublicSigstoreBackend()
        staging = SigstageBackend()
        assert "logIndex=42" in public.verify_url_for_rekor_entry(42)
        assert "logIndex=42" in staging.verify_url_for_rekor_entry(42)
        # sigstore.dev vs sigstage.dev must differ
        assert public.verify_url_for_rekor_entry(1) != staging.verify_url_for_rekor_entry(1)


# ─────────────────────────────────────────────────────────────────────────────
# Factory — env-driven selection + fail-loud on misconfig
# ─────────────────────────────────────────────────────────────────────────────
class TestGetBackend:
    @pytest.mark.parametrize(
        ("backend_name", "expected_class"),
        [
            ("public", PublicSigstoreBackend),
            ("staging", SigstageBackend),
            ("noop", NoopSigstoreBackend),
        ],
    )
    def test_resolves_known_backends(self, backend_name: str, expected_class: type) -> None:
        with override_settings(SIGSTORE_BACKEND=backend_name):
            backend = get_backend()
            assert isinstance(backend, expected_class)
            assert backend.name == backend_name

    def test_unknown_backend_raises_loudly(self) -> None:
        with (
            override_settings(SIGSTORE_BACKEND="cosmic-rays"),
            pytest.raises(UnknownBackendError, match="cosmic-rays"),
        ):
            get_backend()

    def test_self_hosted_requires_all_three_vars(self, tmp_path) -> None:
        # Missing all three — first config check trips.
        with (
            override_settings(
                SIGSTORE_BACKEND="self-hosted",
                SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH="",
                SIGSTORE_SELF_HOSTED_REKOR_URL="",
                SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE="",
            ),
            pytest.raises(BackendConfigurationError, match="requires"),
        ):
            get_backend()

    def test_self_hosted_rejects_missing_trust_file(self, tmp_path) -> None:
        missing = tmp_path / "does-not-exist.json"
        with (
            override_settings(
                SIGSTORE_BACKEND="self-hosted",
                SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH=str(missing),
                SIGSTORE_SELF_HOSTED_REKOR_URL="https://rekor.example.com",
                SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE="https://search.example.com/?logIndex={log_index}",
            ),
            pytest.raises(BackendConfigurationError, match="does not exist"),
        ):
            get_backend()

    def test_self_hosted_constructs_with_valid_config(self, tmp_path) -> None:
        # Trust config file just needs to EXIST for construction; the contents
        # are only parsed if sign() is called (deferred to PR #3).
        trust_file = tmp_path / "trust.json"
        trust_file.write_text("{}")
        with override_settings(
            SIGSTORE_BACKEND="self-hosted",
            SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH=str(trust_file),
            SIGSTORE_SELF_HOSTED_REKOR_URL="https://rekor.example.com",
            SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE="https://search.example.com/?logIndex={log_index}",
        ):
            backend = get_backend()
            assert isinstance(backend, SelfHostedSigstoreBackend)
            assert backend.name == "self-hosted"
            assert backend.rekor_url == "https://rekor.example.com"
            assert backend.verify_url_for_rekor_entry(42) == (
                "https://search.example.com/?logIndex=42"
            )


# ─────────────────────────────────────────────────────────────────────────────
# Invariants the abstraction must preserve
# ─────────────────────────────────────────────────────────────────────────────
def test_all_backend_names_are_distinct() -> None:
    """Catch typos in the constants — every name must be unique."""
    assert len(set(ALL_BACKEND_NAMES)) == len(ALL_BACKEND_NAMES)


def test_all_backends_share_the_signing_result_shape() -> None:
    """The Protocol is structural — verify every backend's sign()
    return value (where it's wired) matches SigningResult. Real
    backends raise; noop returns. So we only check noop here.
    The real backends will need to satisfy this in PR #3 — that's
    where the equivalent test will assert against a sigstage call.
    """
    statement = build_statement(subject_name="x", subject_sha256_hex="9" * 64, predicate={})
    result = NoopSigstoreBackend().sign(statement, identity_token="t")
    expected_fields = {
        "backend_name",
        "cert_chain_pem",
        "signature_b64",
        "rekor_log_index",
        "rekor_log_id",
        "rekor_inclusion_proof_json",
        "statement_b64",
        "verify_url",
    }
    actual_fields = set(result.__dataclass_fields__.keys())
    assert actual_fields == expected_fields
