"""Contributors endpoint.

GET /api/v1/contributors

Contributors are a *view* over User + OrganizationMember + denormalized
counts. No new model. The endpoint enumerates members of the caller's
orgs, computes per-user counts of primitives authored and reviews
performed, and projects to the web's Contributor shape.

IDOR trace
  ID source:  none — endpoint returns only the caller's org members.
  Fetch:      OrganizationMember filtered by `organization__in=_user_orgs`.
  Ownership:  Tenant scope alone is sufficient; admin-only contributor
              visibility (insider threat) is a separate gate added in
              Phase 5+ if needed.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from django.contrib.auth import get_user_model
from django.db.models import Count, QuerySet
from ninja import Router

from accounts.models import User  # noqa: TC001 — used by cast() at runtime
from accounts.schemas import ContributorOut, web_role_for
from orgs.models import Organization, OrganizationMember
from primitivehub_api.auth import requires_auth

if TYPE_CHECKING:
    from django.http import HttpRequest

router = Router(tags=["contributors"], by_alias=True)


def _user(request: HttpRequest) -> User:
    return cast("User", request.user)


def _user_orgs(user: User) -> QuerySet[Organization]:
    return Organization.objects.filter(members__user=user)


def _first_role(roles: list[str] | None) -> str:
    """Pick the most-senior role the user holds (web shows one role per row)."""
    if not roles:
        return "Author"
    priority = [
        "maintainer",
        "security_reviewer",
        "verified_expert",
        "reviewer",
        "author",
    ]
    for candidate in priority:
        if candidate in roles:
            return web_role_for(candidate)
    return web_role_for(roles[0])


@router.get("/contributors", response=list[ContributorOut])
@requires_auth
def list_contributors(request: HttpRequest) -> list[ContributorOut]:
    """Return contributors visible to the caller (members of their orgs)."""
    UserModel = get_user_model()
    orgs = _user_orgs(_user(request))

    # Annotate per-user counts of versions authored + reviews performed.
    qs = (
        UserModel.objects.filter(memberships__organization__in=orgs)
        .annotate(
            primitives_count=Count("submitted_versions", distinct=True),
            reviews_count=Count("reviews_assigned", distinct=True),
        )
        .distinct()
        .order_by("display_name", "email", "subject")
    )

    memberships_by_user = {
        m.user_id: m for m in OrganizationMember.objects.filter(organization__in=orgs)
    }

    out: list[ContributorOut] = []
    for user in qs:
        membership = memberships_by_user.get(user.id)
        role = _first_role(membership.roles if membership else None)
        display = user.display_name or user.email or user.subject
        out.append(
            ContributorOut(
                name=display,
                role=role,
                primitives=int(user.primitives_count),
                reviews=int(user.reviews_count),
                # Reputation is computed-state in v1: 60 base + 5 per
                # primitive + 2 per review, capped at 100. Replaced with a
                # real signal (peer-validated quality + decay) in Phase 5+.
                reputation=min(
                    100,
                    60 + 5 * int(user.primitives_count) + 2 * int(user.reviews_count),
                ),
                avatar="",  # Phase 5+ — Authentik picture claim
                joined_at=user.created_at,
                specialization="",  # Phase 5+ — derived from primitive categories
            )
        )
    return out
