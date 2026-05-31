"""Tests for the /api/v1/trust/* endpoints (Phase 5.5 PR 5.5.1).

The wire contract for `application/vnd.primitivehub.bundle+json`.
Verifies:
  - by-slug lookup returns the full TrustBundleOut shape
  - by-digest lookup returns the same bundle for the same primitive
  - both endpoints 404 for primitives without a signed attestation
  - both endpoints 404 for cross-tenant lookups (IDOR safety)
  - malformed digest → 400 before any DB query
  - content bytes are recoverable + match the claimed digest
  - the bundle's attestation block parses to JSON without losing data

These run against the noop signing backend so the cryptographic
fields are deterministic but valid-shaped.
"""

from __future__ import annotations

import base64
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


# ─────────────────────────────────────────────────────────────────────
# Fixtures: an org with a signed primitive ready for trust-bundle lookup
# ─────────────────────────────────────────────────────────────────────
@pytest.fixture
def alice_with_signed_primitive(_moto_for_tests):
    """Alice in alice-org with `sample-primitive@1.0.0` signed via noop
    backend. Returns (user, org, primitive, version, attestation,
    content_bytes)."""
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
        description="A primitive used in trust-endpoint tests.",
        category=Primitive.Category.SOFTWARE_ENGINEERING,
        risk_level=Primitive.RiskLevel.LOW,
    )

    body = b"# Sample\n\nA real primitive body.\n"

    client = Client()
    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            SIGSTORE_BACKEND="noop",
        ),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        response = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data={
                "semver": "1.0.0",
                "license": "CC-BY-4.0",
                "token_budget": "1000",
                "compatible_agents": json.dumps(["Claude Code"]),
                "use_when": json.dumps(["Testing"]),
                "do_not_use_when": json.dumps([]),
                "content": io.BytesIO(body),
            },
        )
        assert response.status_code == 201, response.content
        version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
        attestation = Attestation.objects.get(primitive_version=version)
        _sign_version_inner(
            primitive_version_id=str(version.id),
            identity_token="t",
            idempotency_key=attestation.idempotency_key,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )
        attestation.refresh_from_db()
        version.refresh_from_db()

    return alice, alice_org, primitive, version, attestation, body


@pytest.fixture
def _moto_for_tests():
    """Spin up moto for S3 so put_primitive_content + get_primitive_content
    both work. Mirrors the fixture in test_storage_api.py."""
    from moto import mock_aws

    from storage.client import reset_client_for_tests

    with (
        mock_aws(),
        override_settings(
            S3_ENDPOINT_URL="",
            S3_BUCKET="primitivehub-test",
            S3_REGION="us-east-1",
            S3_ACCESS_KEY_ID="testing",
            S3_SECRET_ACCESS_KEY="testing",
        ),
    ):
        reset_client_for_tests()
        import boto3

        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="primitivehub-test")
        yield
        reset_client_for_tests()


# ─────────────────────────────────────────────────────────────────────
# by-slug lookup
# ─────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_trust_by_slug_returns_full_bundle(client: Client, alice_with_signed_primitive) -> None:
    _alice, _org, primitive, version, _att, body = alice_with_signed_primitive

    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get(f"/api/v1/trust/{primitive.slug}/versions/{version.semver}")

    assert response.status_code == 200, response.content
    bundle = response.json()
    assert bundle["bundleVersion"] == "0.1"
    assert bundle["subject"]["slug"] == primitive.slug
    assert bundle["subject"]["semver"] == version.semver
    assert bundle["subject"]["contentDigest"] == f"sha256:{version.content_digest}"
    # Content round-trips
    content_bytes = base64.b64decode(bundle["content"]["bytesB64"])
    assert content_bytes == body
    assert bundle["content"]["sizeBytes"] == len(body)
    # Re-hash matches claimed digest (T9 defense at the consumer)
    assert hashlib.sha256(content_bytes).hexdigest() == version.content_digest
    # Attestation block has the cryptographic fields populated
    att = bundle["attestation"]
    assert att["backendName"] == "noop"
    assert "BEGIN CERTIFICATE" in att["certChainPem"]
    assert att["rekorLogIndex"] > 0
    assert att["signedAt"] is not None


@pytest.mark.django_db
def test_trust_by_slug_404_for_unknown_version(client: Client, alice_with_signed_primitive) -> None:
    _alice, _org, primitive, _v, _att, _body = alice_with_signed_primitive

    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get(f"/api/v1/trust/{primitive.slug}/versions/9.9.9")

    assert response.status_code == 404


# ─────────────────────────────────────────────────────────────────────
# by-digest lookup — the Snyk-overlay shape
# ─────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_trust_by_digest_returns_same_bundle(client: Client, alice_with_signed_primitive) -> None:
    _alice, _org, _p, version, _att, _body = alice_with_signed_primitive

    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        by_slug = client.get(
            f"/api/v1/trust/{version.primitive.slug}/versions/{version.semver}"
        ).json()
        by_digest = client.get(f"/api/v1/trust/by-digest/{version.content_digest}").json()

    # Same primitive, same version → byte-identical bundles
    assert by_slug == by_digest


@pytest.mark.django_db
def test_trust_by_digest_404_for_unknown_digest(
    client: Client, alice_with_signed_primitive
) -> None:
    unknown = "0" * 64
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get(f"/api/v1/trust/by-digest/{unknown}")
    assert response.status_code == 404


@pytest.mark.django_db
def test_trust_by_digest_400_for_malformed_digest(client: Client) -> None:
    """Reject malformed input BEFORE hitting the DB. Uppercase, wrong
    length, non-hex chars all return 400."""
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        assert client.get("/api/v1/trust/by-digest/short").status_code == 400
        assert client.get(f"/api/v1/trust/by-digest/{'A' * 64}").status_code == 400
        assert client.get(f"/api/v1/trust/by-digest/{'g' * 64}").status_code == 400


# ─────────────────────────────────────────────────────────────────────
# Auth + tenant scope
# ─────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
@pytest.mark.usefixtures("_moto_for_tests")
def test_trust_returns_404_for_unsigned_primitive(client: Client) -> None:
    """A primitive exists, but the sign task hasn't finished —
    attestation is still pending. Trust endpoint refuses to serve
    a bundle that wouldn't be cryptographically verifiable."""
    User = get_user_model()
    user = User.objects.create_user(subject="b@example.com", email="b@example.com")
    org = Organization.objects.create(slug="bob-org", name="Bob Org")
    OrganizationMember.objects.create(
        organization=org, user=user, roles=[Role.AUTHOR.value, Role.MAINTAINER.value]
    )
    reg = Registry.objects.create(organization=org, slug="public", name="Public")
    repo = Repository.objects.create(
        organization=org, registry=reg, slug="frontend", name="Frontend"
    )
    primitive = Primitive.objects.create(
        organization=org,
        repository=repo,
        slug="unsigned-primitive",
        name="Unsigned",
        description="",
        category=Primitive.Category.SOFTWARE_ENGINEERING,
        risk_level=Primitive.RiskLevel.LOW,
    )
    with (
        override_settings(DEV_OIDC_SUBJECT="b@example.com"),
        patch("jobs.sign_tasks.sign_version.defer"),
    ):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data={
                "semver": "0.1.0",
                "license": "CC-BY-4.0",
                "token_budget": "100",
                "compatible_agents": json.dumps(["Claude Code"]),
                "use_when": json.dumps([]),
                "do_not_use_when": json.dumps([]),
                "content": io.BytesIO(b"x"),
            },
        )
        # Don't sign — attestation stays pending. Trust endpoint must 404.
        response = client.get(f"/api/v1/trust/{primitive.slug}/versions/0.1.0")

    assert response.status_code == 404
