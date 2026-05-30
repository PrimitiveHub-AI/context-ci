"""End-to-end tests for the sign-on-upload pipeline (Phase 4 PR #4).

What's covered
--------------

  1. Upload creates an Attestation in `pending` state with the right
     idempotency_key and predicate skeleton.
  2. defer() is invoked with the correct arguments.
  3. _sign_version_inner() with the noop backend transitions
     pending → signing → signed and populates every Sigstore field.
  4. Idempotency: calling sign on an already-signed attestation is a
     no-op (skipped); attempts not bumped.
  5. Failure path: when the backend raises SigningError, status
     becomes `failed`, failure_reason is set, attempts bumps.
  6. GET /attestation endpoint serializes the full new field set.

What's NOT covered here (out of scope for PR #4)
------------------------------------------------
  - Real cryptographic signing (covered by
    test_signing_integration.py against sigstage, gated marker).
  - OIDC token-refresh flow (Phase 4 polish; see jobs/sign_tasks.py
    docstring).
  - End-to-end with the LIVE worker container (integration test
    deferred to Phase 4 polish + Phase 9 paper-coordination tests).

The tests use the noop backend explicitly (override_settings) to keep
them deterministic and network-free.
"""

from __future__ import annotations

import hashlib
import io
import json
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings

from jobs.sign_tasks import _sign_version_inner
from orgs.models import Organization, OrganizationMember, Role
from registry.models import (
    Attestation,
    Primitive,
    PrimitiveVersion,
    Registry,
    Repository,
)
from signing.exceptions import SigningFailedError


@pytest.fixture
def alice_with_primitive():
    """Alice in alice-org owning `sample-primitive`. AUTHOR role lets her upload."""
    User = get_user_model()
    alice = User.objects.create_user(subject="alice@example.com", email="alice@example.com")
    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    OrganizationMember.objects.create(
        organization=alice_org,
        user=alice,
        roles=[Role.AUTHOR.value, Role.MAINTAINER.value],
    )
    registry = Registry.objects.create(organization=alice_org, slug="public", name="Public")
    repo = Repository.objects.create(
        organization=alice_org, registry=registry, slug="frontend", name="Frontend"
    )
    primitive = Primitive.objects.create(
        organization=alice_org,
        repository=repo,
        slug="sample-primitive",
        name="Sample",
        description="A primitive used in PR #4 sign-on-upload tests.",
        category=Primitive.Category.SOFTWARE_ENGINEERING,
        risk_level=Primitive.RiskLevel.LOW,
    )
    return alice, alice_org, primitive


def _upload_payload(body: bytes, *, semver: str = "1.0.0") -> dict:
    """Build a multipart payload Django's test client accepts. The file
    must be `io.BytesIO`, NOT a (name, bytes, type) tuple — Django's
    test client doesn't parse the tuple form."""
    return {
        "semver": semver,
        "license": "CC-BY-4.0",
        "token_budget": "1000",
        "compatible_agents": json.dumps(["Claude Code"]),
        "use_when": json.dumps(["When testing"]),
        "do_not_use_when": json.dumps(["Production"]),
        "content": io.BytesIO(body),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Upload wires Attestation + enqueues sign_version
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_upload_creates_pending_attestation(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    body = b"# Sample\nbody for attestation test\n"
    expected_digest = hashlib.sha256(body).hexdigest()

    # Patch defer so we don't actually queue against postgres (test DB
    # has the procrastinate schema but we want to assert the call args).
    with (
        override_settings(DEV_OIDC_SUBJECT="alice@example.com"),
        patch("jobs.sign_tasks.sign_version.defer") as mock_defer,
    ):
        response = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )

    assert response.status_code == 201, response.content
    version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
    assert version.content_digest == expected_digest

    # Attestation row exists in pending state
    attestation = Attestation.objects.get(primitive_version=version)
    assert attestation.status == Attestation.Status.PENDING
    assert attestation.attempts == 0
    assert attestation.idempotency_key == f"sign:{version.id}"
    # Predicate has the minimal placeholder fields
    assert attestation.predicate["version_digest"] == expected_digest
    assert attestation.predicate["spec_version"] == "0.1"
    # Sigstore fields all empty
    assert attestation.signed_at is None
    assert attestation.rekor_log_index is None
    assert attestation.cert_chain_pem == ""

    # defer() was called with the right shape. DEV_AUTH_BYPASS path
    # means there's no Authorization header in this test client request,
    # so identity_token is empty — the bearer-extraction unit test
    # covers the non-empty path.
    mock_defer.assert_called_once()
    kwargs = mock_defer.call_args.kwargs
    assert kwargs["organization_id"] == str(primitive.organization.id)
    assert kwargs["primitive_version_id"] == str(version.id)
    assert kwargs["identity_token"] == ""
    assert kwargs["idempotency_key"] == f"sign:{version.id}"


def test_extract_bearer_token_pulls_jwt_from_authorization_header() -> None:
    """Unit-test the bearer-extraction helper directly. Avoids the test
    client's multipart-vs-headers interaction that complicates passing
    Authorization through client.post."""
    from unittest.mock import MagicMock

    from registry.api import _extract_bearer_token

    req = MagicMock()
    req.headers = {"Authorization": "Bearer abc.def.ghi"}
    assert _extract_bearer_token(req) == "abc.def.ghi"

    # No header → empty
    req.headers = {}
    assert _extract_bearer_token(req) == ""

    # Wrong scheme → empty (we don't accept Basic / Digest / etc.)
    req.headers = {"Authorization": "Basic dXNlcjpwYXNz"}
    assert _extract_bearer_token(req) == ""

    # Lowercase "bearer" still works (some clients lowercase)
    req.headers = {"Authorization": "bearer lower.case.token"}
    assert _extract_bearer_token(req) == "lower.case.token"


# ─────────────────────────────────────────────────────────────────────────────
# sign_version task — happy path via noop backend
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_sign_version_inner_signs_with_noop_backend(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    body = b"# Sign me\n"

    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            SIGSTORE_BACKEND="noop",
        ),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )
        version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
        attestation = Attestation.objects.get(primitive_version=version)

        result = _sign_version_inner(
            primitive_version_id=str(version.id),
            identity_token="noop-doesnt-care",
            idempotency_key=attestation.idempotency_key,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )

    assert result["ok"] is True
    assert result["skipped"] is False
    assert result["backend_name"] == "noop"

    attestation.refresh_from_db()
    assert attestation.status == Attestation.Status.SIGNED
    assert attestation.attempts == 1
    assert attestation.backend_name == "noop"
    assert "BEGIN CERTIFICATE" in attestation.cert_chain_pem
    assert attestation.signature_b64
    assert attestation.statement_b64
    assert attestation.rekor_log_index is not None
    assert attestation.rekor_log_index > 0
    assert attestation.rekor_log_id
    assert attestation.rekor_inclusion_proof_json
    assert attestation.verify_url.startswith("noop://")
    assert attestation.signed_at is not None
    assert attestation.failure_reason == ""


# ─────────────────────────────────────────────────────────────────────────────
# Idempotency — re-running sign on a signed attestation is a no-op
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_sign_version_inner_idempotent_when_already_signed(
    client: Client, alice_with_primitive
) -> None:
    _alice, _org, primitive = alice_with_primitive

    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            SIGSTORE_BACKEND="noop",
        ),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"first", semver="1.0.0"),
        )
        version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
        attestation = Attestation.objects.get(primitive_version=version)
        idem = attestation.idempotency_key

        _sign_version_inner(
            primitive_version_id=str(version.id),
            identity_token="t",
            idempotency_key=idem,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )
        first_state = Attestation.objects.get(idempotency_key=idem)

        # Re-run
        result = _sign_version_inner(
            primitive_version_id=str(version.id),
            identity_token="t",
            idempotency_key=idem,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )

    assert result["skipped"] is True
    assert result["reason"] == "already_signed"
    second_state = Attestation.objects.get(idempotency_key=idem)
    # Sigstore fields unchanged + attempts NOT bumped
    assert second_state.attempts == first_state.attempts
    assert second_state.rekor_log_index == first_state.rekor_log_index
    assert second_state.signed_at == first_state.signed_at


# ─────────────────────────────────────────────────────────────────────────────
# Failure path — backend raises SigningFailedError → status=failed
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_sign_version_inner_failure_transitions_to_failed(
    client: Client, alice_with_primitive
) -> None:
    _alice, _org, primitive = alice_with_primitive

    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            SIGSTORE_BACKEND="noop",
        ),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"will fail", semver="1.0.0"),
        )
        version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
        attestation = Attestation.objects.get(primitive_version=version)

        # Force the backend's sign() to raise
        with patch("jobs.sign_tasks.get_backend") as mock_get_backend:
            mock_backend = mock_get_backend.return_value
            mock_backend.sign.side_effect = SigningFailedError(
                "Fulcio refused the OIDC token: unsupported issuer"
            )
            result = _sign_version_inner(
                primitive_version_id=str(version.id),
                identity_token="bad",
                idempotency_key=attestation.idempotency_key,
                attestation_cls=Attestation,
                version_cls=PrimitiveVersion,
            )

    assert result["ok"] is False
    assert result["reason"] == "signing_failed"
    attestation.refresh_from_db()
    assert attestation.status == Attestation.Status.FAILED
    assert attestation.attempts == 1
    assert "Fulcio refused" in attestation.failure_reason
    assert attestation.signed_at is None  # never set
    assert attestation.cert_chain_pem == ""


# ─────────────────────────────────────────────────────────────────────────────
# GET endpoint serializes the new fields
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_get_attestation_endpoint_serializes_pending_state(
    client: Client, alice_with_primitive
) -> None:
    _alice, _org, primitive = alice_with_primitive

    with (
        override_settings(DEV_OIDC_SUBJECT="alice@example.com"),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"x", semver="1.0.0"),
        )
        response = client.get(f"/api/v1/primitives/{primitive.slug}/versions/1.0.0/attestation")

    assert response.status_code == 200, response.content
    body = response.json()
    assert body["status"] == "pending"
    assert body["attempts"] == 0
    assert body["failureReason"] is None
    assert body["backendName"] is None
    assert body["rekorLogIndex"] is None
    assert body["signedAt"] is None


@pytest.mark.django_db
def test_get_attestation_endpoint_serializes_signed_state(
    client: Client, alice_with_primitive
) -> None:
    _alice, _org, primitive = alice_with_primitive

    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            SIGSTORE_BACKEND="noop",
        ),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"x", semver="1.0.0"),
        )
        version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
        attestation = Attestation.objects.get(primitive_version=version)
        _sign_version_inner(
            primitive_version_id=str(version.id),
            identity_token="t",
            idempotency_key=attestation.idempotency_key,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )

        response = client.get(f"/api/v1/primitives/{primitive.slug}/versions/1.0.0/attestation")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "signed"
    assert body["attempts"] == 1
    assert body["backendName"] == "noop"
    assert body["rekorLogIndex"] > 0
    assert body["signedAt"] is not None
    assert "BEGIN CERTIFICATE" in body["certChainPem"]
    assert body["verifyUrl"].startswith("noop://")
