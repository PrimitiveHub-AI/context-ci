"""Contributors endpoint tests."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings

from orgs.models import Organization, OrganizationMember, Role


@pytest.fixture
def alice_and_bob_with_contributors():
    User = get_user_model()
    alice = User.objects.create_user(
        subject="alice@example.com",
        email="alice@example.com",
        display_name="Alice Maintainer",
    )
    bob = User.objects.create_user(
        subject="bob@example.com",
        email="bob@example.com",
        display_name="Bob Author",
    )
    carol = User.objects.create_user(
        subject="carol@example.com",
        email="carol@example.com",
        display_name="Carol Reviewer",
    )

    alice_org = Organization.objects.create(slug="alice-org", name="Alice Org")
    bob_org = Organization.objects.create(slug="bob-org", name="Bob Org")

    OrganizationMember.objects.create(
        organization=alice_org, user=alice, roles=[Role.MAINTAINER.value]
    )
    OrganizationMember.objects.create(
        organization=alice_org, user=carol, roles=[Role.REVIEWER.value]
    )
    OrganizationMember.objects.create(organization=bob_org, user=bob, roles=[Role.AUTHOR.value])
    return {"alice": alice, "bob": bob, "carol": carol}


@pytest.mark.django_db
def test_contributors_require_auth(client: Client) -> None:
    with override_settings(DEV_AUTH_BYPASS=False):
        assert client.get("/api/v1/contributors").status_code == 401


@pytest.mark.django_db
def test_list_contributors_scoped(client: Client, alice_and_bob_with_contributors) -> None:
    with override_settings(DEV_OIDC_SUBJECT="alice@example.com"):
        response = client.get("/api/v1/contributors")
    assert response.status_code == 200
    contributors = response.json()
    names = sorted(c["name"] for c in contributors)
    assert names == ["Alice Maintainer", "Carol Reviewer"]
    # Bob is in bob-org only; not visible from Alice's view.
    roles_by_name = {c["name"]: c["role"] for c in contributors}
    assert roles_by_name["Alice Maintainer"] == "Maintainer"
    assert roles_by_name["Carol Reviewer"] == "Reviewer"
