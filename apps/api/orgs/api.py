"""Orgs read endpoints.

Endpoints
---------
GET /organizations             — orgs the JWT subject belongs to (memberships)

IDOR trace
----------
ID source:  request.user (set by OIDCAuthenticationMiddleware from the JWT
            `sub` claim — never client-controllable).
Fetch:      OrganizationMember.objects.filter(user=request.user).
Ownership:  Membership is the ownership relation; queryset is scoped to it
            by construction. No path parameter accepts an org id, so no
            cross-tenant pivot is possible from this endpoint.

Postgres RLS adds a third layer of defense: even if the queryset filter were
wrong, the `SET LOCAL primitivehub.current_organization` boundary would still
limit row visibility to the active org context.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Count, QuerySet
from django.http import HttpRequest
from ninja import Router

from apps.orgs.models import Organization, OrganizationMember
from apps.orgs.schemas import OrganizationMembershipOut, OrganizationOut
from primitivehub_api.auth import requires_auth

router = Router(tags=["orgs"])


def _org_queryset_for_user(user: Any) -> QuerySet[Organization]:
    """Return orgs the user is a member of, annotated with member_role_count."""
    return (
        Organization.objects.filter(members__user=user)
        .annotate(member_role_count=Count("members"))
        .distinct()
        .order_by("slug")
    )


@router.get("/organizations", response=list[OrganizationMembershipOut])
@requires_auth
def list_organizations(request: HttpRequest) -> list[OrganizationMembershipOut]:
    """List the authenticated user's organization memberships, with roles."""
    memberships = (
        OrganizationMember.objects.filter(user=request.user)
        .select_related("organization")
        .annotate(member_role_count=Count("organization__members"))
        .order_by("organization__slug")
    )

    out: list[OrganizationMembershipOut] = []
    for m in memberships:
        org = m.organization
        out.append(
            OrganizationMembershipOut(
                organization=OrganizationOut(
                    id=str(org.id),
                    slug=org.slug,
                    name=org.name,
                    visibility=org.visibility,
                    created_at=org.created_at,
                    member_role_count=m.member_role_count,
                ),
                roles=list(m.roles or []),
                joined_at=m.joined_at,
            )
        )
    return out
