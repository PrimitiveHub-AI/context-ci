"""Ninja Pydantic schemas for the orgs surface.

Shape mirrors the frontend's expectations — keys are camelCase on the wire
to match `apps/web/lib/types.ts` (TanStack Query in Step 4 will consume
these directly). Field aliasing happens via `populate_by_name=True` so the
Python field names stay snake_case while the JSON output is camelCase.
"""

from __future__ import annotations

from datetime import datetime

from ninja import Schema
from pydantic import ConfigDict, Field


class CamelSchema(Schema):
    """Base schema that emits camelCase JSON keys but accepts snake_case in code."""

    model_config = ConfigDict(populate_by_name=True)


class OrganizationOut(CamelSchema):
    """Public org descriptor returned to authenticated members."""

    id: str
    slug: str
    name: str
    visibility: str
    created_at: datetime = Field(alias="createdAt")
    member_role_count: int = Field(alias="memberRoleCount")


class OrganizationMembershipOut(CamelSchema):
    """A {org, roles} pair for the authenticated user."""

    organization: OrganizationOut
    roles: list[str]
    joined_at: datetime = Field(alias="joinedAt")
