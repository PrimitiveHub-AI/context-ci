"""Bundles endpoint tests."""

from __future__ import annotations

import hashlib

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.utils import timezone

from orgs.models import Organization, OrganizationMember, Role
from registry.models import Bundle, Primitive, PrimitiveVersion, Registry, Repository


def _digest(slug: str) -> str:
    return hashlib.sha256(f"{slug}:bundle-test".encode()).hexdigest()


@pytest.fixture
def two_bundles():
    User = get_user_model()
    alice = User.objects.create_user(subject="alice@example.com", email="alice@example.com")
    bob = User.objects.create_user(subject="bob@example.com", email="bob@example.com")
    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")
    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.MAINTAINER.value])

    def _make_primitive(org, repo_slug, prim_slug, *, agents):
        registry = Registry.objects.create(organization=org, slug=repo_slug, name=repo_slug)
        repo = Repository.objects.create(
            organization=org, registry=registry, slug=repo_slug, name=repo_slug
        )
        primitive = Primitive.objects.create(
            organization=org,
            repository=repo,
            slug=prim_slug,
            name=prim_slug,
            description="x",
            category=Primitive.Category.SOFTWARE_ENGINEERING,
            risk_level=Primitive.RiskLevel.LOW,
        )
        PrimitiveVersion.objects.create(
            organization=org,
            primitive=primitive,
            semver="1.0.0",
            content_digest=_digest(prim_slug),
            storage_key=f"sha256:{_digest(prim_slug)}",
            tokens=1000,
            token_budget=2000,
            license="MIT",
            submitted_by=alice if org == alice_org else bob,
            verdict=PrimitiveVersion.Verdict.TRUSTED,
            attested_at=timezone.now(),
            quality_score=90,
            compatible_agents=agents,
        )
        return primitive

    alice_prim = _make_primitive(alice_org, "alice-public", "alice-prim", agents=["Claude Code"])
    bob_prim = _make_primitive(bob_org, "bob-public", "bob-prim", agents=["Cursor"])

    alice_bundle = Bundle.objects.create(
        organization=alice_org,
        slug="alice-bundle",
        name="Alice Bundle",
        description="d",
        use_case="testing",
    )
    alice_bundle.primitives.add(alice_prim)

    Bundle.objects.create(
        organization=bob_org,
        slug="bob-bundle",
        name="Bob Bundle",
        description="d",
        use_case="testing",
    ).primitives.add(bob_prim)

    return {"alice_bundle": alice_bundle}


@pytest.mark.django_db
def test_bundles_require_auth(client: Client) -> None:
    with override_settings(DEV_AUTH_BYPASS=False):
        assert client.get("/api/v1/bundles").status_code == 401
        assert client.get("/api/v1/bundles/anything").status_code == 401


@pytest.mark.django_db
def test_list_bundles_scoped(client: Client, two_bundles) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/bundles")
    assert response.status_code == 200
    slugs = [b["slug"] for b in response.json()]
    assert slugs == ["alice-bundle"]


@pytest.mark.django_db
def test_get_bundle_detail(client: Client, two_bundles) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/bundles/alice-bundle")
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "alice-bundle"
    assert body["primitives"] == ["alice-prim"]
    assert body["compatibleAgents"] == ["Claude Code"]
    assert body["totalTokens"] == 1000


@pytest.mark.django_db
def test_get_bundle_cross_tenant_404(client: Client, two_bundles) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/bundles/bob-bundle")
    assert response.status_code == 404
