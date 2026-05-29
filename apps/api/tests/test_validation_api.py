"""Validation endpoint tests."""

from __future__ import annotations

import hashlib

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings

from orgs.models import Organization, OrganizationMember, Role
from registry.models import Primitive, PrimitiveVersion, Registry, Repository
from validation.models import PipelineStage, ReviewItem


def _digest(slug: str) -> str:
    return hashlib.sha256(f"{slug}:val-test".encode()).hexdigest()


@pytest.fixture
def alice_and_bob_with_reviews():
    User = get_user_model()
    alice = User.objects.create_user(
        subject="alice@example.com", email="alice@example.com", display_name="Alice"
    )
    bob = User.objects.create_user(
        subject="bob@example.com", email="bob@example.com", display_name="Bob"
    )
    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")
    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.MAINTAINER.value])

    def _make_pv(org, slug, user):
        registry = Registry.objects.create(organization=org, slug=slug, name=slug)
        repo = Repository.objects.create(organization=org, registry=registry, slug=slug, name=slug)
        primitive = Primitive.objects.create(
            organization=org,
            repository=repo,
            slug=slug,
            name=slug,
            description="x",
            category=Primitive.Category.SOFTWARE_ENGINEERING,
            risk_level=Primitive.RiskLevel.MEDIUM,
        )
        return PrimitiveVersion.objects.create(
            organization=org,
            primitive=primitive,
            semver="1.0.0",
            content_digest=_digest(slug),
            storage_key=f"sha256:{_digest(slug)}",
            tokens=1000,
            token_budget=2000,
            license="MIT",
            submitted_by=user,
            verdict=PrimitiveVersion.Verdict.SUBMITTED,
        )

    alice_pv = _make_pv(alice_org, "alice-prim", alice)
    bob_pv = _make_pv(bob_org, "bob-prim", bob)

    ReviewItem.objects.create(
        organization=alice_org,
        primitive_version=alice_pv,
        status=ReviewItem.Status.HUMAN_REVIEW_PENDING,
        comments_count=2,
    )
    ReviewItem.objects.create(
        organization=bob_org,
        primitive_version=bob_pv,
        status=ReviewItem.Status.APPROVED,
        comments_count=0,
    )

    PipelineStage.objects.create(
        organization=alice_org,
        primitive_version=alice_pv,
        name="Schema",
        position=0,
        status=PipelineStage.StageStatus.PASSED,
        score=95,
        duration_ms=850,
        log="ok",
        reviewer=alice,
    )
    PipelineStage.objects.create(
        organization=alice_org,
        primitive_version=alice_pv,
        name="Safety",
        position=1,
        status=PipelineStage.StageStatus.WARNING,
        score=72,
        duration_ms=12000,
        log="advisory",
    )

    return {"alice_pv": alice_pv, "bob_pv": bob_pv}


@pytest.mark.django_db
def test_reviews_require_auth(client: Client) -> None:
    with override_settings(DEV_AUTH_BYPASS=False):
        assert client.get("/api/v1/reviews").status_code == 401


@pytest.mark.django_db
def test_list_reviews_scoped(client: Client, alice_and_bob_with_reviews) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/reviews")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["primitive"] == "alice-prim"
    assert items[0]["status"] == "Human Review Pending"
    assert items[0]["version"] == "1.0.0"
    assert items[0]["riskLevel"] == "medium"


@pytest.mark.django_db
def test_list_pipeline_stages_ordered(client: Client, alice_and_bob_with_reviews) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/alice-prim/versions/1.0.0/pipeline-stages")
    assert response.status_code == 200
    stages = response.json()
    assert [s["name"] for s in stages] == ["Schema", "Safety"]
    assert stages[0]["status"] == "passed"
    assert stages[0]["duration"] == "850ms"
    assert stages[1]["duration"] == "12.0s"


@pytest.mark.django_db
def test_pipeline_stages_cross_tenant_404(client: Client, alice_and_bob_with_reviews) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/primitives/bob-prim/versions/1.0.0/pipeline-stages")
    assert response.status_code == 404
