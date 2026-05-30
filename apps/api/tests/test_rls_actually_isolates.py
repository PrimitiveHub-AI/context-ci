"""Postgres RLS integration test.

These tests prove that Row-Level Security in `registry/migrations/0002`,
`registry/migrations/0005`, and `validation/migrations/0002` actually
isolates tenants at the DATABASE layer — not just at the application
queryset filter. They bypass the Django ORM filter entirely and run
raw SQL against the connection, asserting that:

  1. With no `primitivehub.current_organization` set, no rows are visible.
  2. With org A's UUID set, only org A's rows are visible.
  3. Switching the setting reveals only the new org's rows.

If RLS regresses (policy dropped, role becomes superuser, migrations
skip on the current vendor), these tests fail loudly. Without them,
the application queryset would mask the regression silently.

Skipped if the test DB is not Postgres — those settings would skip the
RLS migrations and the assertions below would be meaningless.
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from orgs.models import Organization, OrganizationMember, Role
from registry.models import Primitive, PrimitiveVersion, Registry, Repository
from tests.conftest import reset_to_app_role

pytestmark = pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="RLS only applies on Postgres",
)


def _set_tenant(org_id: str | None) -> None:
    with connection.cursor() as cursor:
        if org_id is None:
            cursor.execute("RESET primitivehub.current_organization")
        else:
            cursor.execute("SET LOCAL primitivehub.current_organization = %s", [org_id])


@pytest.fixture
def two_orgs_with_primitives(db):
    # Setup runs under the BYPASSRLS role so cross-org inserts succeed.
    # The test body calls reset_to_app_role() to drop back to
    # `primitivehub_app` (NOSUPERUSER, NOBYPASSRLS) before asserting.
    with connection.cursor() as cursor:
        cursor.execute("SET ROLE test_bypass_rls")

    User = get_user_model()
    alice = User.objects.create_user(subject="alice@example.com", email="alice@example.com")
    bob = User.objects.create_user(subject="bob@example.com", email="bob@example.com")

    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")
    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.MAINTAINER.value])

    def _make(org, slug):
        import hashlib

        digest = hashlib.sha256(slug.encode()).hexdigest()
        registry = Registry.objects.create(organization=org, slug=slug, name=slug)
        repo = Repository.objects.create(organization=org, registry=registry, slug=slug, name=slug)
        primitive = Primitive.objects.create(
            organization=org,
            repository=repo,
            slug=slug,
            name=slug,
            description="",
            category=Primitive.Category.SOFTWARE_ENGINEERING,
            risk_level=Primitive.RiskLevel.LOW,
        )
        PrimitiveVersion.objects.create(
            organization=org,
            primitive=primitive,
            semver="1.0.0",
            content_digest=digest,
            storage_key=f"sha256:{digest}",
            tokens=10,
            token_budget=20,
            license="MIT",
            submitted_by=alice if org == alice_org else bob,
            verdict=PrimitiveVersion.Verdict.TRUSTED,
        )
        return primitive

    alice_prim = _make(alice_org, "alice-prim")
    bob_prim = _make(bob_org, "bob-prim")
    return {
        "alice_org": alice_org,
        "bob_org": bob_org,
        "alice_prim": alice_prim,
        "bob_prim": bob_prim,
    }


def _count_primitives() -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM registry_primitive")
        row = cursor.fetchone()
        return int(row[0])


@pytest.mark.django_db
def test_no_tenant_set_no_rows_visible(two_orgs_with_primitives) -> None:
    """With `primitivehub.current_organization` unset, RLS hides everything."""
    reset_to_app_role()
    _set_tenant(None)
    assert _count_primitives() == 0


@pytest.mark.django_db
def test_alice_context_sees_only_alice(two_orgs_with_primitives) -> None:
    alice_org_id = str(two_orgs_with_primitives["alice_org"].id)
    reset_to_app_role()
    _set_tenant(alice_org_id)
    with connection.cursor() as cursor:
        cursor.execute("SELECT slug FROM registry_primitive ORDER BY slug")
        slugs = [r[0] for r in cursor.fetchall()]
    assert slugs == ["alice-prim"]


@pytest.mark.django_db
def test_bob_context_sees_only_bob(two_orgs_with_primitives) -> None:
    bob_org_id = str(two_orgs_with_primitives["bob_org"].id)
    reset_to_app_role()
    _set_tenant(bob_org_id)
    with connection.cursor() as cursor:
        cursor.execute("SELECT slug FROM registry_primitive ORDER BY slug")
        slugs = [r[0] for r in cursor.fetchall()]
    assert slugs == ["bob-prim"]


@pytest.mark.django_db
def test_garbage_tenant_uuid_no_rows_visible(two_orgs_with_primitives) -> None:
    """An attacker who guesses a UUID still sees nothing (the UUID isn't a
    membership claim — the application checks membership before SET LOCAL).
    But even if the SET LOCAL ran with a wrong UUID, RLS would still
    only match rows whose organization_id equals that UUID — which won't."""
    reset_to_app_role()
    _set_tenant("00000000-0000-0000-0000-000000000000")
    assert _count_primitives() == 0
