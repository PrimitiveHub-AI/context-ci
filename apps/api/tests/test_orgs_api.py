"""Orgs endpoint tests.

Coverage:
  - 401 when unauthenticated
  - happy path: caller sees their own memberships
  - IDOR: caller does NOT see orgs they aren't a member of
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings

from orgs.models import Organization, OrganizationMember, Role


@pytest.fixture
def alice_and_bob():
    """Two users in separate orgs — used to drive IDOR assertions."""
    User = get_user_model()
    alice = User.objects.create_user(subject="alice@example.com", email="alice@example.com")
    bob = User.objects.create_user(subject="bob@example.com", email="bob@example.com")

    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")

    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.AUTHOR.value])
    return alice, bob, alice_org, bob_org


@pytest.mark.django_db
def test_list_organizations_unauthenticated_returns_401(client: Client) -> None:
    """With DEV_AUTH_BYPASS off, no Bearer token → 401."""
    with override_settings(DEV_AUTH_BYPASS=False):
        response = client.get("/api/v1/organizations")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_organizations_returns_own_memberships(client: Client, alice_and_bob) -> None:
    _alice, _bob, alice_org, _bob_org = alice_and_bob
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/organizations")
    assert response.status_code == 200
    body = response.json()
    slugs = [m["organization"]["slug"] for m in body]
    assert slugs == [alice_org.slug]
    assert body[0]["roles"] == [Role.MAINTAINER.value]


@pytest.mark.django_db
def test_list_organizations_excludes_other_orgs(client: Client, alice_and_bob) -> None:
    """IDOR: Alice never sees Bob's org."""
    _alice, _bob, _alice_org, bob_org = alice_and_bob
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/organizations")
    assert response.status_code == 200
    slugs = [m["organization"]["slug"] for m in response.json()]
    assert bob_org.slug not in slugs
