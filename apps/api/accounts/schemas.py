"""Contributor view schemas.

Contributor is a *view* on User + OrganizationMember + denormalized counts;
not a stored entity. The endpoint computes the fields from queries — no
new model.
"""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — Pydantic needs runtime access

from registry.schemas import CamelSchema

# Map an OrganizationMember role to the web's ContributorRole literal.
# The web's ContributorRole is a narrower set than the full Role enum —
# REGISTRY_ADMIN is not exposed on the contributors surface, for example.
_WEB_ROLE_BY_DB: dict[str, str] = {
    "maintainer": "Maintainer",
    "verified_expert": "Verified Expert",
    "author": "Author",
    "reviewer": "Reviewer",
    "security_reviewer": "Security Reviewer",
}


def web_role_for(db_role: str) -> str:
    return _WEB_ROLE_BY_DB.get(db_role, db_role)


class ContributorOut(CamelSchema):
    """Mirrors `apps/web/lib/types.ts:Contributor`."""

    name: str
    role: str
    primitives: int
    reviews: int
    reputation: int
    avatar: str
    joined_at: datetime
    specialization: str
