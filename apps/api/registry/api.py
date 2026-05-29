"""Registry read endpoints.

Endpoints
---------
GET /registries
GET /registries/{registry_slug}/repositories
GET /primitives                                  (cursor-paginated, filterable)
GET /primitives/{slug}                           (latest version composite)
GET /primitives/{slug}/versions/{semver}
GET /primitives/{slug}/versions/{semver}/attestation

IDOR trace (applies to every endpoint here)
-------------------------------------------
ID source:  path/query.
Fetch:      All querysets start from `Model.objects.filter(organization__in=
            <orgs the JWT subject is a member of>)`. The `slug` lookup is
            applied AFTER the tenant scope, so a slug that exists in another
            org returns 404 (not 403 — avoids leaking existence).
Ownership:  Tenant scoping + RLS (defense in depth via
            `SET LOCAL primitivehub.current_organization`, added in
            migration 0002).
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from ninja import Query, Router

from apps.orgs.models import Organization
from apps.registry.models import (
    Attestation,
    Primitive,
    PrimitiveVersion,
    Registry,
    Repository,
)
from apps.registry.schemas import (
    AttestationOut,
    PrimitiveOut,
    PrimitivePage,
    PrimitiveVersionOut,
    RegistryOut,
    RepositoryOut,
)
from primitivehub_api.auth import requires_auth
from primitivehub_api.pagination import paginate

router = Router(tags=["registry"])


# ─────────────────────────────────────────────────────────────────────────────
# Tenant-scoping helpers — every queryset goes through these.
# ─────────────────────────────────────────────────────────────────────────────


def _user_orgs(user: Any) -> QuerySet[Organization]:
    """Orgs the user is a member of. Single source of tenant scope."""
    return Organization.objects.filter(members__user=user)


def _scoped_registries(user: Any) -> QuerySet[Registry]:
    return Registry.objects.filter(organization__in=_user_orgs(user))


def _scoped_repositories(user: Any) -> QuerySet[Repository]:
    return Repository.objects.filter(organization__in=_user_orgs(user))


def _scoped_primitives(user: Any) -> QuerySet[Primitive]:
    return Primitive.objects.filter(organization__in=_user_orgs(user))


def _scoped_versions(user: Any) -> QuerySet[PrimitiveVersion]:
    return PrimitiveVersion.objects.filter(organization__in=_user_orgs(user))


# ─────────────────────────────────────────────────────────────────────────────
# Serializers — pure functions that take a model row + computed context
# and return the camelCase Pydantic schema.
# ─────────────────────────────────────────────────────────────────────────────


_TRUST_STATUS_BY_VERDICT = {
    PrimitiveVersion.Verdict.TRUSTED: "Trusted",
    PrimitiveVersion.Verdict.IN_REVIEW: "In Review",
    PrimitiveVersion.Verdict.SUBMITTED: "In Review",
    PrimitiveVersion.Verdict.EXPERIMENTAL: "Experimental",
    PrimitiveVersion.Verdict.DEPRECATED: "Deprecated",
    PrimitiveVersion.Verdict.REJECTED: "Deprecated",
    PrimitiveVersion.Verdict.DRAFT: "Experimental",
}

_CATEGORY_LABEL_BY_VALUE = {
    Primitive.Category.SOFTWARE_ENGINEERING: "Software Engineering",
    Primitive.Category.PRODUCT_DESIGN: "Product Design",
    Primitive.Category.CYBERSECURITY: "Cybersecurity",
    Primitive.Category.RESEARCH_WRITING: "Research & Writing",
    Primitive.Category.ARCHITECTURE: "Architecture",
    Primitive.Category.PERFORMANCE: "Performance",
    Primitive.Category.AGENT_BEHAVIOR: "Agent Behavior",
    Primitive.Category.DOMAIN_EXPERTISE: "Domain Expertise",
}


def _latest_version(primitive: Primitive) -> PrimitiveVersion | None:
    """The most recently submitted version of a primitive. Prefer Trusted."""
    trusted = (
        primitive.versions.filter(verdict=PrimitiveVersion.Verdict.TRUSTED)
        .order_by("-submitted_at")
        .first()
    )
    if trusted is not None:
        return trusted
    return primitive.versions.order_by("-submitted_at").first()


def _serialize_primitive(primitive: Primitive) -> PrimitiveOut:
    version = _latest_version(primitive)
    org_slug = primitive.organization.slug
    name = primitive.name
    semver = version.semver if version else "0.0.0"
    last_updated = (
        (version.attested_at or version.submitted_at).date().isoformat()
        if version
        else primitive.updated_at.date().isoformat()
    )
    return PrimitiveOut(
        slug=primitive.slug,
        name=name,
        file_name=f"{primitive.slug}.md",
        category=_CATEGORY_LABEL_BY_VALUE.get(primitive.category, primitive.category),
        description=primitive.description,
        author=org_slug,
        version=semver,
        tokens=version.tokens if version else 0,
        token_budget=version.token_budget if version else 0,
        quality_score=version.quality_score or 0 if version else 0,
        safety_score=version.safety_score or 0 if version else 0,
        context_efficiency=version.efficiency_score or 0 if version else 0,
        agent_impact=version.impact_score or 0 if version else 0,
        status=_TRUST_STATUS_BY_VERDICT.get(version.verdict, "Experimental")
        if version
        else "Experimental",
        compatible_agents=list(version.compatible_agents) if version else [],
        license=version.license if version else "",
        last_updated=last_updated,
        use_when=list(version.use_when) if version else [],
        do_not_use_when=list(version.do_not_use_when) if version else [],
        risk_level=primitive.risk_level,
        content_digest=f"sha256:{version.content_digest}" if version else "",
        install_command=f"phub install {primitive.slug}@{semver}",
        downloads=0,
        reviewer_badge=None,
    )


def _serialize_version(version: PrimitiveVersion) -> PrimitiveVersionOut:
    return PrimitiveVersionOut(
        semver=version.semver,
        content_digest=f"sha256:{version.content_digest}",
        storage_key=version.storage_key,
        tokens=version.tokens,
        token_budget=version.token_budget,
        license=version.license,
        spec_version=version.spec_version,
        verdict=version.verdict,
        submitted_at=version.submitted_at,
        attested_at=version.attested_at,
        quality_score=version.quality_score,
        safety_score=version.safety_score,
        efficiency_score=version.efficiency_score,
        impact_score=version.impact_score,
        compatible_agents=list(version.compatible_agents),
        use_when=list(version.use_when),
        do_not_use_when=list(version.do_not_use_when),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/registries", response=list[RegistryOut])
@requires_auth
def list_registries(request: HttpRequest) -> list[RegistryOut]:
    """List registries the caller's orgs own."""
    qs = _scoped_registries(request.user).select_related("organization").order_by("slug")
    return [
        RegistryOut(
            id=str(r.id),
            slug=r.slug,
            name=r.name,
            visibility=r.visibility,
            organization_slug=r.organization.slug,
            created_at=r.created_at,
        )
        for r in qs
    ]


@router.get(
    "/registries/{registry_slug}/repositories",
    response=list[RepositoryOut],
)
@requires_auth
def list_repositories(
    request: HttpRequest, registry_slug: str
) -> list[RepositoryOut]:
    """List repositories within a registry the caller can see."""
    registry = get_object_or_404(_scoped_registries(request.user), slug=registry_slug)
    qs = (
        _scoped_repositories(request.user)
        .filter(registry=registry)
        .select_related("registry", "organization")
        .order_by("slug")
    )
    return [
        RepositoryOut(
            id=str(r.id),
            slug=r.slug,
            name=r.name,
            description=r.description,
            registry_slug=r.registry.slug,
            organization_slug=r.organization.slug,
            created_at=r.created_at,
        )
        for r in qs
    ]


@router.get("/primitives", response=PrimitivePage)
@requires_auth
def list_primitives(
    request: HttpRequest,
    cursor: str | None = None,
    page_size: int | None = None,
    category: str | None = Query(None),
    agent: str | None = Query(None, description="Filter by compatible_agent token"),
    status: str | None = Query(None, description="TrustStatus literal"),
    search: str | None = Query(None, description="Substring match on name/description"),
) -> PrimitivePage:
    """Cursor-paginated, filterable primitive list."""
    qs = (
        _scoped_primitives(request.user)
        .select_related("organization", "repository")
        .prefetch_related("versions")
    )

    if category:
        # Accept either machine value ("software-engineering") or label ("Software Engineering").
        machine = category
        for value, label in _CATEGORY_LABEL_BY_VALUE.items():
            if category in (value, label):
                machine = value
                break
        qs = qs.filter(category=machine)

    if search:
        qs = qs.filter(name__icontains=search) | qs.filter(description__icontains=search)

    items, next_cursor, size = paginate(qs, cursor=cursor, page_size=page_size)
    serialized = [_serialize_primitive(p) for p in items]

    # Post-serialization filters (agent + status) — applied after `_serialize_primitive`
    # so they read from the resolved-version's fields. This keeps the queryset
    # filter logic narrow to indexed columns.
    if agent:
        serialized = [p for p in serialized if agent in p.compatible_agents]
    if status:
        serialized = [p for p in serialized if p.status == status]

    return PrimitivePage(items=serialized, next_cursor=next_cursor, page_size=size)


@router.get("/primitives/{slug}", response=PrimitiveOut)
@requires_auth
def get_primitive(request: HttpRequest, slug: str) -> PrimitiveOut:
    """Single-primitive detail (latest version composite)."""
    primitive = get_object_or_404(
        _scoped_primitives(request.user).select_related("organization", "repository"),
        slug=slug,
    )
    return _serialize_primitive(primitive)


@router.get(
    "/primitives/{slug}/versions/{semver}",
    response=PrimitiveVersionOut,
)
@requires_auth
def get_primitive_version(
    request: HttpRequest, slug: str, semver: str
) -> PrimitiveVersionOut:
    """Per-version detail."""
    version = get_object_or_404(
        _scoped_versions(request.user).select_related("primitive"),
        primitive__slug=slug,
        semver=semver,
    )
    return _serialize_version(version)


@router.get(
    "/primitives/{slug}/versions/{semver}/attestation",
    response=AttestationOut,
)
@requires_auth
def get_attestation(
    request: HttpRequest, slug: str, semver: str
) -> AttestationOut:
    """Context CI attestation record for a version (in-toto Statement)."""
    version = get_object_or_404(
        _scoped_versions(request.user),
        primitive__slug=slug,
        semver=semver,
    )
    attestation = get_object_or_404(Attestation, primitive_version=version)
    return AttestationOut(
        id=str(attestation.id),
        predicate_type=attestation.predicate_type,
        predicate=attestation.predicate,
        threat_model_version=attestation.threat_model_version,
        spec_version=attestation.spec_version,
        rekor_entry_id=attestation.rekor_entry_id or None,
        signed_at=attestation.signed_at,
        recorded_at=attestation.recorded_at,
    )
