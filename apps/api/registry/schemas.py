"""Ninja Pydantic schemas for the registry surface.

These schemas are the contract the frontend (Step 4) will read against. Keys
are camelCase on the wire to match `apps/web/lib/types.ts`. The frontend's
existing `Primitive` interface dictates what fields must appear; this file
is the single point where API ↔ frontend types stay aligned.

Deferred fields (return defaults until later phases):
  - downloads     → 0      (Phase 6: append-event counter per DDIA)
  - reviewerBadge → null   (Phase 4: human-review workflow)
"""

from __future__ import annotations

from datetime import datetime

from ninja import Schema
from pydantic import ConfigDict, Field


class CamelSchema(Schema):
    model_config = ConfigDict(populate_by_name=True)


class RegistryOut(CamelSchema):
    id: str
    slug: str
    name: str
    visibility: str
    organization_slug: str = Field(alias="organizationSlug")
    created_at: datetime = Field(alias="createdAt")


class RepositoryOut(CamelSchema):
    id: str
    slug: str
    name: str
    description: str
    registry_slug: str = Field(alias="registrySlug")
    organization_slug: str = Field(alias="organizationSlug")
    created_at: datetime = Field(alias="createdAt")


class PrimitiveOut(CamelSchema):
    """Shape mirrors `apps/web/lib/types.ts:Primitive`. Field-by-field parity
    is enforced by `tests/test_parity.py`."""

    slug: str
    name: str
    file_name: str = Field(alias="fileName")
    category: str
    description: str
    author: str
    version: str
    tokens: int
    token_budget: int = Field(alias="tokenBudget")
    quality_score: int = Field(alias="qualityScore")
    safety_score: int = Field(alias="safetyScore")
    context_efficiency: int = Field(alias="contextEfficiency")
    agent_impact: int = Field(alias="agentImpact")
    status: str
    compatible_agents: list[str] = Field(alias="compatibleAgents")
    license: str
    last_updated: str = Field(alias="lastUpdated")
    use_when: list[str] = Field(alias="useWhen")
    do_not_use_when: list[str] = Field(alias="doNotUseWhen")
    risk_level: str = Field(alias="riskLevel")
    content_digest: str = Field(alias="contentDigest")
    install_command: str = Field(alias="installCommand")
    downloads: int = 0
    reviewer_badge: str | None = Field(default=None, alias="reviewerBadge")


class PrimitiveVersionOut(CamelSchema):
    """Per-version detail. Used by /primitives/{slug}/versions/{semver}."""

    semver: str
    content_digest: str = Field(alias="contentDigest")
    storage_key: str = Field(alias="storageKey")
    tokens: int
    token_budget: int = Field(alias="tokenBudget")
    license: str
    spec_version: str = Field(alias="specVersion")
    verdict: str
    submitted_at: datetime = Field(alias="submittedAt")
    attested_at: datetime | None = Field(default=None, alias="attestedAt")
    quality_score: int | None = Field(default=None, alias="qualityScore")
    safety_score: int | None = Field(default=None, alias="safetyScore")
    efficiency_score: int | None = Field(default=None, alias="efficiencyScore")
    impact_score: int | None = Field(default=None, alias="impactScore")
    compatible_agents: list[str] = Field(alias="compatibleAgents")
    use_when: list[str] = Field(alias="useWhen")
    do_not_use_when: list[str] = Field(alias="doNotUseWhen")


class AttestationOut(CamelSchema):
    """Context CI attestation record (in-toto Statement)."""

    id: str
    predicate_type: str = Field(alias="predicateType")
    predicate: dict
    threat_model_version: str = Field(alias="threatModelVersion")
    spec_version: str = Field(alias="specVersion")
    rekor_entry_id: str | None = Field(default=None, alias="rekorEntryId")
    signed_at: datetime | None = Field(default=None, alias="signedAt")
    recorded_at: datetime = Field(alias="recordedAt")


class PrimitivePage(CamelSchema):
    """A cursor-paginated page of primitives."""

    items: list[PrimitiveOut]
    next_cursor: str | None = Field(default=None, alias="nextCursor")
    page_size: int = Field(alias="pageSize")
