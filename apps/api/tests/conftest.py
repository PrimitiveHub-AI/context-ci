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

import os

import pytest
from django.db import connection
from django.test import Client

# ADR-0047: registry/publish/storage/auth/signing surfaces are deferred (dormant, flag-off).
# CI gates only the live firewall surface (scanner/detectors/check); these modules need
# object storage, multi-tenant RLS, or signing backends, so they're deselected when
# PRIMITIVEHUB_CI_LIVE_ONLY=1. They stay runnable locally with the storage stack up.
if os.environ.get("PRIMITIVEHUB_CI_LIVE_ONLY") == "1":
    collect_ignore = [
        "test_registry_api.py",
        "test_storage_api.py",
        "test_trust_endpoints.py",
        "test_trust_contract_conformance.py",
        "test_bundles_api.py",
        "test_contributors_api.py",
        "test_orgs_api.py",
        "test_rls_actually_isolates.py",
        "test_sign_on_upload.py",
        "test_signing_abstraction.py",
        "test_signing_integration.py",
        "test_signing_real_backends.py",
        "test_validation_api.py",
    ]


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
