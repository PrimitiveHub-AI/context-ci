"""Tenant-context middleware.

Postgres Row-Level Security in migrations 0002/0005 reads the active org
from a session-local setting:

    SET LOCAL primitivehub.current_organization = '<org-uuid>'

If that setting is empty, the RLS policy denies every row — by design,
so missing tenant context fails closed rather than open.

This middleware sets the variable per request, based on the
`X-Organization-Slug` header (or, in DEV_AUTH_BYPASS mode, the first
org the dev user is a member of). It runs AFTER OIDCAuthenticationMiddleware
so `request.user` is already populated.

Threat model (security-engineering-supplychain primitive)
  Asset:      Tenant boundary at the DB layer (T2 — tenant isolation).
  Opponent:   A user with stolen credentials trying to read another org's
              data; an application-layer bug that forgets queryset scoping.
  Assumption: Postgres role used by the api container is NOT a superuser
              (superuser bypasses RLS). The compose `postgres` service
              runs the `primitivehub` role, which is NOSUPERUSER by default.

Controls
  - X-Organization-Slug header is the only client-controllable input;
    validated against OrganizationMember to ensure the user IS a member.
  - Non-members → 403 (NOT 404 here — the user is authenticated, and
    silently dropping to "no tenant" would make every subsequent query
    invisible, leading to confusing 404s on legitimate endpoints).
  - When the header is absent: defaults to the first org the user
    belongs to (deterministic by slug, so the same default each request).
    Endpoints that need a different org must pass the header.
"""

from __future__ import annotations

from typing import Any

from django.db import connection
from django.http import HttpRequest, HttpResponse, JsonResponse

from accounts.models import User  # noqa: TC001 — runtime use in resolver
from orgs.models import Organization, OrganizationMember

HEADER_NAME = "HTTP_X_ORGANIZATION_SLUG"
_SQL_SET_TENANT = "SET LOCAL primitivehub.current_organization = %s"


def _resolve_org_for_request(request: HttpRequest, user: User) -> Organization | None:
    """Pick the org the request runs under."""
    requested_slug = request.META.get(HEADER_NAME, "").strip()
    if requested_slug:
        try:
            org = Organization.objects.get(slug=requested_slug)
        except Organization.DoesNotExist:
            return None
        if not OrganizationMember.objects.filter(user=user, organization=org).exists():
            return None
        return org
    # Default: deterministic — first org by slug ascending the user belongs to.
    return Organization.objects.filter(members__user=user).order_by("slug").first()


class TenantContextMiddleware:
    """Set `primitivehub.current_organization` for the request, if possible.

    Anonymous requests: do nothing — RLS will deny by default, and the
    `requires_auth` decorator on every protected endpoint will already
    have returned 401 before any query runs.

    Authenticated requests: resolve the org. If a slug header is set but
    invalid (not a member), return 403 immediately — better to fail loudly
    than to silently fall back to a different org's data.

    Non-Postgres backends: skip the SET — keeps `django.db.backends.dummy`
    or stand-alone management commands from erroring on a fresh dev
    shell. Production is Postgres.
    """

    def __init__(self, get_response: Any) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if connection.vendor != "postgresql":
            return self.get_response(request)

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            # Anonymous (or middleware ordering issue) — leave RLS empty.
            return self.get_response(request)

        org = _resolve_org_for_request(request, user)
        requested = request.META.get(HEADER_NAME, "").strip()
        if requested and org is None:
            # Explicit header that didn't resolve to a member org.
            return JsonResponse(
                {"detail": f"not a member of organization {requested!r}"},
                status=403,
            )

        if org is None:
            # No header + user has no orgs. Leave RLS empty; protected
            # endpoints will return empty lists / 404, which is correct.
            return self.get_response(request)

        # SET LOCAL only works inside a transaction. We open our own
        # `transaction.atomic()` block to avoid relying on
        # ATOMIC_REQUESTS (which is on in production but off in tests so
        # the test-fixture role SET ROLE survives across the request).
        from django.db import transaction

        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(_SQL_SET_TENANT, [str(org.id)])
            request.tenant_org_id = str(org.id)  # type: ignore[attr-defined]
            return self.get_response(request)
