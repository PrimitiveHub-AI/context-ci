"""Content-addressed storage endpoint tests.

Coverage
  - 401 when unauthenticated
  - POST upload happy path → 201, returns version with correct digest
  - POST re-upload of identical content under SAME semver → 409
  - POST upload exceeding PRIMITIVE_MAX_BYTES → 413
  - POST upload by a viewer (non-author) → 403
  - POST upload to a primitive in another org → 404 (IDOR)
  - GET content happy path → 200 + bytes + X-Content-Digest header
  - GET content when storage returns tampered bytes → 500 (T9 refusal)
  - GET content cross-tenant → 404 (IDOR)

We use moto's `mock_aws` to mock R2/S3 in-process — no network, no R2 ops
burned, tests stay deterministic.
"""

from __future__ import annotations

import hashlib
import io
import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from moto import mock_aws

from orgs.models import Organization, OrganizationMember, Role
from registry.models import Primitive, PrimitiveVersion, Registry, Repository
from storage.client import reset_client_for_tests

_TEST_BUCKET = "primitivehub-test-bucket"
_TEST_REGION = "us-east-1"
_TEST_KEY_ID = "test-access-key-id"
_TEST_SECRET = "test-secret-access-key"


@pytest.fixture(autouse=True)
def _moto_s3():
    """Spin up an in-process S3 mock + override Django settings to use it.

    `autouse=True` so every test in this module runs against the mock.
    `reset_client_for_tests()` clears the boto3 module-level cache that
    otherwise persists across tests with stale credentials.
    """
    with (
        mock_aws(),
        override_settings(
            S3_ENDPOINT_URL="",
            S3_BUCKET=_TEST_BUCKET,
            S3_REGION=_TEST_REGION,
            S3_ACCESS_KEY_ID=_TEST_KEY_ID,
            S3_SECRET_ACCESS_KEY=_TEST_SECRET,
        ),
    ):
        reset_client_for_tests()
        # Create the bucket inside the mock
        import boto3

        boto3.client("s3", region_name=_TEST_REGION).create_bucket(Bucket=_TEST_BUCKET)
        yield
        reset_client_for_tests()


@pytest.fixture
def alice_with_primitive():
    """Alice in alice-org with author rights, owning a `sample-primitive`."""
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
        description="A primitive used in upload/download tests.",
        category=Primitive.Category.SOFTWARE_ENGINEERING,
        risk_level=Primitive.RiskLevel.LOW,
    )
    return alice, alice_org, primitive


@pytest.fixture
def bob_with_primitive():
    """Bob in bob-org owning `bob-primitive` — used for cross-tenant tests."""
    User = get_user_model()
    bob = User.objects.create_user(subject="bob@example.com", email="bob@example.com")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")
    OrganizationMember.objects.create(
        organization=bob_org, user=bob, roles=[Role.MAINTAINER.value, Role.AUTHOR.value]
    )
    registry = Registry.objects.create(organization=bob_org, slug="public", name="Public")
    repo = Repository.objects.create(
        organization=bob_org, registry=registry, slug="frontend", name="Frontend"
    )
    primitive = Primitive.objects.create(
        organization=bob_org,
        repository=repo,
        slug="bob-primitive",
        name="Bob Primitive",
        description="Bob's primitive.",
        category=Primitive.Category.CYBERSECURITY,
        risk_level=Primitive.RiskLevel.HIGH,
    )
    return bob, bob_org, primitive


def _upload_payload(body: bytes, *, semver: str = "1.0.0") -> dict:
    """Build a multipart payload that the Django test client accepts."""
    return {
        "semver": semver,
        "license": "CC-BY-4.0",
        "token_budget": "1000",
        "compatible_agents": json.dumps(["Claude Code"]),
        "use_when": json.dumps(["When doing X"]),
        "do_not_use_when": json.dumps([]),
        "content": io.BytesIO(body),
    }


# ─── 401 path ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_unauthenticated_returns_401(client: Client) -> None:
    with override_settings(DEV_AUTH_BYPASS=False):
        response = client.post(
            "/api/v1/primitives/anything/versions",
            data=_upload_payload(b"hello"),
        )
    assert response.status_code == 401


@pytest.mark.django_db
def test_content_get_unauthenticated_returns_401(client: Client) -> None:
    with override_settings(DEV_AUTH_BYPASS=False):
        response = client.get("/api/v1/primitives/anything/versions/1.0.0/content")
    assert response.status_code == 401


# ─── Upload happy path ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_happy_path(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    body = b"# Sample Primitive\n\nHello PrimitiveHub.\n"
    expected_digest = hashlib.sha256(body).hexdigest()

    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )

    assert response.status_code == 201, response.content
    body_json = response.json()
    assert body_json["semver"] == "1.0.0"
    assert body_json["contentDigest"] == f"sha256:{expected_digest}"
    assert body_json["storageKey"] == f"sha256:{expected_digest}"
    assert body_json["compatibleAgents"] == ["Claude Code"]
    assert body_json["tokens"] == len(body)

    # Row landed
    version = PrimitiveVersion.objects.get(primitive=primitive, semver="1.0.0")
    assert version.content_digest == expected_digest


# ─── Re-upload same semver → 409 ─────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_duplicate_semver_returns_409(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    body = b"content\n"
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        first = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )
        assert first.status_code == 201
        second = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )
    assert second.status_code == 409


# ─── Size guard ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_oversized_returns_413(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    with (
        override_settings(
            DEV_OIDC_SUBJECT="alice@example.com",
            PRIMITIVE_MAX_BYTES=16,
        ),
    ):
        response = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"this body is definitely longer than 16 bytes"),
        )
    assert response.status_code == 413


# ─── Role check ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_by_reviewer_only_returns_403(client: Client, alice_with_primitive) -> None:
    """A member with only the REVIEWER role (no AUTHOR/MAINTAINER) → 403."""
    _alice, alice_org, primitive = alice_with_primitive
    User = get_user_model()
    carol = User.objects.create_user(subject="carol@example.com", email="carol@example.com")
    OrganizationMember.objects.create(
        organization=alice_org, user=carol, roles=[Role.REVIEWER.value]
    )

    with override_settings(DEV_OIDC_SUBJECT="carol@example.com"):
        response = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(b"content"),
        )
    assert response.status_code == 403


# ─── IDOR: upload across tenants ─────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_to_other_orgs_primitive_returns_404(
    client: Client, alice_with_primitive, bob_with_primitive
) -> None:
    _alice, _alice_org, _alice_prim = alice_with_primitive
    _bob, _bob_org, bob_prim = bob_with_primitive

    # Alice attempts to upload to bob-primitive. Should look as if it
    # doesn't exist — 404, never 403.
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.post(
            f"/api/v1/primitives/{bob_prim.slug}/versions",
            data=_upload_payload(b"content"),
        )
    assert response.status_code == 404


# ─── GET content happy path ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_content_get_happy_path(client: Client, alice_with_primitive) -> None:
    _alice, _org, primitive = alice_with_primitive
    body = b"# Hello\n"
    expected_digest = hashlib.sha256(body).hexdigest()

    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        upload = client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )
        assert upload.status_code == 201
        response = client.get(f"/api/v1/primitives/{primitive.slug}/versions/1.0.0/content")

    assert response.status_code == 200
    assert response.content == body
    assert response["Content-Type"].startswith("text/markdown")
    assert response["X-Content-Digest"] == f"sha256:{expected_digest}"


# ─── GET content: tampered bytes → 500 ───────────────────────────────────────


@pytest.mark.django_db
def test_content_get_with_tampered_storage_returns_500(
    client: Client, alice_with_primitive
) -> None:
    """T9 (Trust Drift) detection: if storage bytes don't hash to the
    expected digest, the endpoint refuses to serve."""
    _alice, _org, primitive = alice_with_primitive
    body = b"original\n"
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        client.post(
            f"/api/v1/primitives/{primitive.slug}/versions",
            data=_upload_payload(body, semver="1.0.0"),
        )

        # Tamper: overwrite the object at the storage key with different bytes.
        # The PrimitiveVersion row still claims the original digest.
        digest = hashlib.sha256(body).hexdigest()
        import boto3

        boto3.client("s3", region_name=_TEST_REGION).put_object(
            Bucket=_TEST_BUCKET,
            Key=f"sha256:{digest}",
            Body=b"tampered\n",
        )

        response = client.get(f"/api/v1/primitives/{primitive.slug}/versions/1.0.0/content")

    assert response.status_code == 500


# ─── GET content: cross-tenant → 404 ─────────────────────────────────────────


@pytest.mark.django_db
def test_content_get_cross_tenant_returns_404(
    client: Client, alice_with_primitive, bob_with_primitive
) -> None:
    _bob, _bob_org, bob_prim = bob_with_primitive
    # Bob uploads a version. Alice then tries to read it via the URL.
    body = b"bob's content\n"
    with override_settings(DEV_OIDC_SUBJECT="bob@example.com"):
        client.post(
            f"/api/v1/primitives/{bob_prim.slug}/versions",
            data=_upload_payload(body, semver="0.1.0"),
        )
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get(f"/api/v1/primitives/{bob_prim.slug}/versions/0.1.0/content")
    assert response.status_code == 404
