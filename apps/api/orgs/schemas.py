"""Ninja Pydantic schemas for the orgs surface.

Shape mirrors the frontend's expectations — keys are camelCase on the wire
to match `apps/web/lib/types.ts` (TanStack Query in Step 4 will consume
these directly). Python field names stay snake_case; the
`alias_generator=to_camel` config emits camelCase JSON and
`populate_by_name=True` lets callers construct schemas with snake_case
kwargs (which mypy can typecheck strictly).
"""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — Pydantic needs runtime access
from typing import Any

from ninja import Schema
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel


class CamelSchema(Schema):
    """Base schema that emits camelCase JSON keys but accepts snake_case in code.

    Ninja's response serialization calls `model_dump()` without `by_alias=True`,
    so we override the method to force-emit aliases. The `populate_by_name=True`
    config lets callers construct schemas with snake_case kwargs.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        kwargs.setdefault("by_alias", True)
        return super().model_dump(**kwargs)

    def model_dump_json(self, **kwargs: Any) -> str:
        kwargs.setdefault("by_alias", True)
        return super().model_dump_json(**kwargs)


class OrganizationOut(CamelSchema):
    """Public org descriptor returned to authenticated members."""

    id: str
    slug: str
    name: str
    visibility: str
    created_at: datetime
    member_role_count: int


class OrganizationMembershipOut(CamelSchema):
    """A {org, roles} pair for the authenticated user."""

    organization: OrganizationOut
    roles: list[str]
    joined_at: datetime
