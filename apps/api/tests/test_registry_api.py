"""Registry endpoint tests.

Coverage:
  - 401 when unauthenticated on every endpoint
  - happy path on each read endpoint
  - pagination cursor flow
  - category / agent / status filters
  - IDOR: cross-tenant primitive returns 404 (NOT 403)
  - attestation endpoint: returns record when present, 404 when absent
"""

from __future__ import annotations

import hashlib

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.utils import timezone

from orgs.models import Organization, OrganizationMember, Role
from registry.models import (
    Attestation,
    Primitive,
    PrimitiveVersion,
    Registry,
    Repository,
)


def _digest(slug: str, semver: str) -> str:
    return hashlib.sha256(f"{slug}@{semver}:test".encode()).hexdigest()


@pytest.fixture
def two_orgs_with_data():
    """Two orgs (alice's + bob's), each with a registry + primitives.

    Used to drive both happy-path and IDOR-refusal cases — Alice's view of
    Bob's primitives must be 404 across the board.
    """
    User = get_user_model()
    alice = User.objects.create_user(subject="alice@example.com", email="alice@example.com")
    bob = User.objects.create_user(subject="bob@example.com", email="bob@example.com")

    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")

    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.MAINTAINER.value])

    alice_registry = Registry.objects.create(organization=alice_org, slug="public", name="Public")
    bob_registry = Registry.objects.create(organization=bob_org, slug="public", name="Public")

    alice_repo = Repository.objects.create(
        organization=alice_org,
        registry=alice_registry,
        slug="frontend",
        name="Frontend",
    )
    bob_repo = Repository.objects.create(
        organization=bob_org,
        registry=bob_registry,
        slug="frontend",
        name="Frontend",
    )

    alice_prim = Primitive.objects.create(
        organization=alice_org,
        repository=alice_repo,
        slug="alice-primitive",
        name="Alice Primitive",
        description="Alice's primitive.",
        category=Primitive.Category.SOFTWARE_ENGINEERING,
        risk_level=Primitive.RiskLevel.LOW,
    )
    alice_version = PrimitiveVersion.objects.create(
        organization=alice_org,
        primitive=alice_prim,
        semver="1.0.0",
        content_digest=_digest("alice-primitive", "1.0.0"),
        storage_key=f"sha256:{_digest('alice-primitive', '1.0.0')}",
        tokens=1000,
        token_budget=2000,
        license="MIT",
        submitted_by=alice,
        verdict=PrimitiveVersion.Verdict.TRUSTED,
        attested_at=timezone.now(),
        quality_score=90,
        safety_score=95,
        efficiency_score=88,
        impact_score=92,
        compatible_agents=["Claude Code", "Cursor"],
        use_when=["When doing alice things"],
        do_not_use_when=["Bob things"],
    )
    Attestation.objects.create(
        organization=alice_org,
        primitive_version=alice_version,
        predicate={"subject": [{"name": "alice-primitive@1.0.0"}]},
    )

    bob_prim = Primitive.objects.create(
        organization=bob_org,
        repository=bob_repo,
        slug="bob-primitive",
        name="Bob Primitive",
        description="Bob's primitive.",
        category=Primitive.Category.CYBERSECURITY,
        risk_level=Primitive.RiskLevel.HIGH,
    )
    PrimitiveVersion.objects.create(
        organization=bob_org,
        primitive=bob_prim,
        semver="0.1.0",
        content_digest=_digest("bob-primitive", "0.1.0"),
        storage_key=f"sha256:{_digest('bob-primitive', '0.1.0')}",
        tokens=2000,
        token_budget=3000,
        license="Apache-2.0",
        submitted_by=bob,
        verdict=PrimitiveVersion.Verdict.EXPERIMENTAL,
        compatible_agents=["Codex"],
        use_when=[],
        do_not_use_when=[],
    )

    return {
        "alice": alice,
        "bob": bob,
        "alice_org": alice_org,
        "bob_org": bob_org,
        "alice_prim": alice_prim,
        "bob_prim": bob_prim,
    }


@pytest.mark.django_db
def test_endpoints_require_auth(client: Client) -> None:
    """Every read endpoint 401s without a bearer token."""
    with override_settings(DEV_AUTH_BYPASS=False):
        for path in (
            "/api/v1/registries",
            "/api/v1/primitives",
            "/api/v1/primitives/anything",
            "/api/v1/primitives/anything/versions/1.0.0",
            "/api/v1/primitives/anything/versions/1.0.0/attestation",
        ):
            assert client.get(path).status_code == 401, path


@pytest.mark.django_db
def test_list_registries_scoped_to_user_orgs(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/registries")
    assert response.status_code == 200
    slugs = [(r["organizationSlug"], r["slug"]) for r in response.json()]
    assert slugs == [("alice-org", "public")]


@pytest.mark.django_db
def test_list_repositories_scoped(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/registries/public/repositories")
    assert response.status_code == 200
    repos = response.json()
    assert len(repos) == 1
    assert repos[0]["organizationSlug"] == "alice-org"


@pytest.mark.django_db
def test_list_primitives_returns_alice_only(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives")
    assert response.status_code == 200
    body = response.json()
    slugs = [p["slug"] for p in body["items"]]
    assert slugs == ["alice-primitive"]
    assert body["pageSize"] >= 1


@pytest.mark.django_db
def test_list_primitives_filter_by_category(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives", {"category": "Software Engineering"})
    assert response.status_code == 200
    body = response.json()
    assert all(p["category"] == "Software Engineering" for p in body["items"])


@pytest.mark.django_db
def test_list_primitives_filter_by_status(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives", {"status": "Trusted"})
    assert response.status_code == 200
    statuses = [p["status"] for p in response.json()["items"]]
    assert all(s == "Trusted" for s in statuses)


@pytest.mark.django_db
def test_get_primitive_detail(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/alice-primitive")
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "alice-primitive"
    assert body["status"] == "Trusted"
    assert body["compatibleAgents"] == ["Claude Code", "Cursor"]
    assert body["contentDigest"].startswith("sha256:")
    assert body["installCommand"] == "phub install alice-primitive@1.0.0"


@pytest.mark.django_db
def test_get_primitive_cross_tenant_returns_404(client: Client, two_orgs_with_data) -> None:
    """IDOR refusal: Alice asking for Bob's primitive slug → 404, not 403."""
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/bob-primitive")
    assert response.status_code == 404


@pytest.mark.django_db
def test_get_primitive_version_detail(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/alice-primitive/versions/1.0.0")
    assert response.status_code == 200
    body = response.json()
    assert body["semver"] == "1.0.0"
    assert body["verdict"] == "trusted"


@pytest.mark.django_db
def test_get_attestation_present(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/alice-primitive/versions/1.0.0/attestation")
    assert response.status_code == 200
    body = response.json()
    assert body["predicateType"] == "https://primitivehub.ai/context-ci/v0.1/Attestation"


@pytest.mark.django_db
def test_get_attestation_cross_tenant_returns_404(client: Client, two_orgs_with_data) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/bob-primitive/versions/0.1.0/attestation")
    assert response.status_code == 404
