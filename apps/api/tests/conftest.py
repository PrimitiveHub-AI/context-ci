"""Pytest fixtures shared across the API test suite.

RLS bypass for general tests
----------------------------
Most tests verify application-level tenant scoping: that querysets like
`Model.objects.filter(organization__in=user_orgs)` return only the right
rows. These tests insert cross-org fixture data — alice-org primitives
+ bob-org primitives — so they can assert Alice's view doesn't see
Bob's data.

With Postgres RLS active (migrations 0002/0005, validation 0002), those
cross-org inserts would fail: the row's `organization_id` doesn't match
the request's tenant context, so the policy's WITH CHECK clause rejects
the INSERT.

The fix: an autouse autouse session+function fixture sets the database
session to a `test_bypass_rls` role (NOLOGIN, BYPASSRLS). All ordinary
tests run with RLS bypassed at the role level — they exercise
application scoping, NOT RLS.

The dedicated RLS test (`test_rls_actually_isolates.py`) calls
`reset_to_app_role()` inside its body to revert and prove RLS enforces.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.test import Client


def reset_to_app_role() -> None:
    """Drop back to the application role so RLS actually applies.

    Used by RLS integration tests after they've set up fixture data
    (which runs under the bypass role) and want the assertions to hit
    the real policy path.
    """
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute("RESET ROLE")


@pytest.fixture(autouse=True)
def _set_bypass_rls_role(db, request) -> None:
    """Default to BYPASSRLS for tests. Skipped for tests in the RLS module."""
    if connection.vendor != "postgresql":
        return
    if request.module.__name__.endswith("test_rls_actually_isolates"):
        # Let the RLS test control its own role setup.
        return
    with connection.cursor() as cursor:
        cursor.execute("SET ROLE test_bypass_rls")


@pytest.fixture
def client() -> Client:
    """A vanilla Django test client. DEV_AUTH_BYPASS is on in settings_test."""
    return Client()
