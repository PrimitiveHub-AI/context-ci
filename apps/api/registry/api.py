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

import json
from typing import TYPE_CHECKING, cast

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from accounts.models import User  # noqa: TC001 — used by cast() at runtime
from orgs.models import Organization, OrganizationMember, Role
from primitivehub_api.auth import requires_auth
from primitivehub_api.pagination import paginate
from registry.models import (
    Attestation,
    Bundle,
    Primitive,
    PrimitiveVersion,
    Registry,
    Repository,
)
from registry.schemas import (
    AttestationOut,
    PrimitiveOut,
    PrimitivePage,
    PrimitiveVersionOut,
    RegistryOut,
    RepositoryOut,
)
from storage.client import get_primitive_content, put_primitive_content
from storage.digest import read_with_digest
from storage.exceptions import (
    ContentNotFoundError,
    DigestMismatchError,
    SizeLimitExceededError,
    StorageUnavailableError,
)

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from django.http import HttpRequest

router = Router(tags=["registry"], by_alias=True)


# ─────────────────────────────────────────────────────────────────────────────
# Tenant-scoping helpers — every queryset goes through these.
# ─────────────────────────────────────────────────────────────────────────────


def _user_orgs(user: User) -> QuerySet[Organization]:
    """Orgs the user is a member of. Single source of tenant scope."""
    return Organization.objects.filter(members__user=user)


def _scoped_registries(user: User) -> QuerySet[Registry]:
    return Registry.objects.filter(organization__in=_user_orgs(user))


def _scoped_repositories(user: User) -> QuerySet[Repository]:
    return Repository.objects.filter(organization__in=_user_orgs(user))


def _scoped_primitives(user: User) -> QuerySet[Primitive]:
    return Primitive.objects.filter(organization__in=_user_orgs(user))


def _scoped_versions(user: User) -> QuerySet[PrimitiveVersion]:
    return PrimitiveVersion.objects.filter(organization__in=_user_orgs(user))


def _user(request: HttpRequest) -> User:
    """Narrow request.user — requires_auth guarantees it's a real User row."""
    return cast("User", request.user)


# ─────────────────────────────────────────────────────────────────────────────
# Serializers — pure functions that take a model row + computed context
# and return the camelCase Pydantic schema.
# ─────────────────────────────────────────────────────────────────────────────


_TRUST_STATUS_BY_VERDICT: dict[str, str] = {
    PrimitiveVersion.Verdict.TRUSTED.value: "Trusted",
    PrimitiveVersion.Verdict.IN_REVIEW.value: "In Review",
    PrimitiveVersion.Verdict.SUBMITTED.value: "In Review",
    PrimitiveVersion.Verdict.EXPERIMENTAL.value: "Experimental",
    PrimitiveVersion.Verdict.DEPRECATED.value: "Deprecated",
    PrimitiveVersion.Verdict.REJECTED.value: "Deprecated",
    PrimitiveVersion.Verdict.DRAFT.value: "Experimental",
}


def _status_for_verdict(verdict: str) -> str:
    """Map a stored Verdict string to a web TrustStatus literal."""
    return _TRUST_STATUS_BY_VERDICT.get(verdict, "Experimental")


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
        category=_CATEGORY_LABEL_BY_VALUE.get(
            cast("Primitive.Category", primitive.category), primitive.category
        ),
        description=primitive.description,
        author=org_slug,
        version=semver,
        tokens=version.tokens if version else 0,
        token_budget=version.token_budget if version else 0,
        quality_score=version.quality_score or 0 if version else 0,
        safety_score=version.safety_score or 0 if version else 0,
        context_efficiency=version.efficiency_score or 0 if version else 0,
        agent_impact=version.impact_score or 0 if version else 0,
        status=_status_for_verdict(version.verdict) if version else "Experimental",
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
    qs = _scoped_registries(_user(request)).select_related("organization").order_by("slug")
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
def list_repositories(request: HttpRequest, registry_slug: str) -> list[RepositoryOut]:
    """List repositories within a registry the caller can see."""
    registry = get_object_or_404(_scoped_registries(_user(request)), slug=registry_slug)
    qs = (
        _scoped_repositories(_user(request))
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
    category: str | None = None,
    agent: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> PrimitivePage:
    """Cursor-paginated, filterable primitive list."""
    qs = (
        _scoped_primitives(_user(request))
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
        _scoped_primitives(_user(request)).select_related("organization", "repository"),
        slug=slug,
    )
    return _serialize_primitive(primitive)


@router.get(
    "/primitives/{slug}/versions/{semver}",
    response=PrimitiveVersionOut,
)
@requires_auth
def get_primitive_version(request: HttpRequest, slug: str, semver: str) -> PrimitiveVersionOut:
    """Per-version detail."""
    version = get_object_or_404(
        _scoped_versions(_user(request)).select_related("primitive"),
        primitive__slug=slug,
        semver=semver,
    )
    return _serialize_version(version)


@router.get(
    "/primitives/{slug}/versions/{semver}/attestation",
    response=AttestationOut,
)
@requires_auth
def get_attestation(request: HttpRequest, slug: str, semver: str) -> AttestationOut:
    """Context CI attestation record for a version (in-toto Statement)."""
    version = get_object_or_404(
        _scoped_versions(_user(request)),
        primitive__slug=slug,
        semver=semver,
    )
    attestation = get_object_or_404(Attestation, primitive_version=version)
    return _serialize_attestation(attestation)


def _serialize_attestation(attestation: Attestation) -> AttestationOut:
    """Pack an Attestation model into the wire schema. Empty signing
    fields surface as `null` per AttestationOut's defaults — the web
    app reads `status` to decide which UI affordance to show."""
    return AttestationOut(
        id=str(attestation.id),
        status=attestation.status,
        attempts=attestation.attempts,
        failure_reason=attestation.failure_reason or None,
        predicate_type=attestation.predicate_type,
        predicate=attestation.predicate,
        threat_model_version=attestation.threat_model_version,
        spec_version=attestation.spec_version,
        backend_name=attestation.backend_name or None,
        cert_chain_pem=attestation.cert_chain_pem or None,
        signature_b64=attestation.signature_b64 or None,
        statement_b64=attestation.statement_b64 or None,
        rekor_log_index=attestation.rekor_log_index,
        rekor_log_id=attestation.rekor_log_id or None,
        rekor_inclusion_proof_json=attestation.rekor_inclusion_proof_json or None,
        verify_url=attestation.verify_url or None,
        rekor_entry_id=attestation.rekor_entry_id or None,
        signed_at=attestation.signed_at,
        recorded_at=attestation.recorded_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Content-addressed write + read
#
# Security goal triplet (per security-engineering-supplychain primitive)
#   Asset:      Primitive content bytes + the (slug, semver) → digest binding
#   Opponent:   (a) Compromised author w/ stolen OIDC token, (b) Storage
#               compromise / silent corruption (T9), (c) Cross-tenant
#               attempted pivot (T2).
#   Assumption: SHA-256 collision-resistance holds; R2 ACL + bucket-scoped
#               credentials honored; Postgres durability.
#
# Controls
#   - Server computes digest from received bytes (never trust client claim)
#   - Object key IS the digest (sha256:<hex>) — no mutable path
#   - Re-hash on every read (`get_primitive_content`); mismatch → refuse
#   - Tenant scope via `_scoped_primitives`/`_scoped_versions`
#   - Role check: only members with AUTHOR or MAINTAINER can upload
#   - Per-request size guard via `read_with_digest` (PRIMITIVE_MAX_BYTES)
#   - Postgres txn wraps the row insert; R2 upload runs FIRST (idempotent
#     on digest collisions, so a failed row insert + retry is safe)
# ─────────────────────────────────────────────────────────────────────────────


_UPLOAD_ROLES: frozenset[str] = frozenset(
    {Role.AUTHOR.value, Role.MAINTAINER.value, Role.REGISTRY_ADMIN.value}
)


def _membership_for(user: User, organization: Organization) -> OrganizationMember | None:
    return OrganizationMember.objects.filter(user=user, organization=organization).first()


def _parse_json_list(field_name: str, raw: str) -> list[str]:
    """Parse a JSON string into a list[str]. Raises 400 on malformed input."""
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HttpError(400, f"{field_name} must be a JSON array of strings") from exc
    if not isinstance(value, list) or not all(isinstance(s, str) for s in value):
        raise HttpError(400, f"{field_name} must be a JSON array of strings")
    return value


def _require_form_field(request: HttpRequest, name: str) -> str:
    value = request.POST.get(name)
    if not value:
        raise HttpError(400, f"missing form field: {name}")
    return value


@router.post(
    "/primitives/{slug}/versions",
    response={201: PrimitiveVersionOut},
)
@requires_auth
def upload_primitive_version(request: HttpRequest, slug: str) -> tuple[int, PrimitiveVersionOut]:
    """Upload a new immutable, content-addressed version of a primitive.

    Multipart form with fields:
      semver, license, token_budget (int),
      compatible_agents (JSON array str), use_when (JSON array str),
      do_not_use_when (JSON array str), content (file).

    Server hashes the bytes; the storage key is `sha256:<hex>`. Re-upload
    of identical content is a no-op at the storage layer (same digest →
    same key); the row insert enforces (primitive, semver) uniqueness, so
    a re-publish under the same semver returns 409.

    We read the multipart directly via `request.POST` / `request.FILES`
    rather than Ninja's `Form()`/`File()` params — Ninja 1.3 + Pydantic
    2.13 has a forward-ref issue with `UploadedFile` annotations under
    `from __future__ import annotations`.
    """
    user = _user(request)

    primitive = get_object_or_404(
        _scoped_primitives(user).select_related("organization"),
        slug=slug,
    )

    # Role check — only authors+ within the primitive's org can upload.
    membership = _membership_for(user, primitive.organization)
    if membership is None or not (set(membership.roles or []) & _UPLOAD_ROLES):
        # 403 here, not 404, because the caller already proved org membership
        # by reading the primitive via _scoped_primitives. Refusing with 403
        # is honest about "you're a member, just not authorized for this".
        raise HttpError(403, "Author role required to publish a primitive version")

    semver = _require_form_field(request, "semver")
    license_val = _require_form_field(request, "license")
    token_budget_str = _require_form_field(request, "token_budget")
    try:
        token_budget = int(token_budget_str)
    except ValueError as exc:
        raise HttpError(400, "token_budget must be an integer") from exc

    content_file = request.FILES.get("content")
    if content_file is None:
        raise HttpError(400, "missing file field: content")

    if PrimitiveVersion.objects.filter(primitive=primitive, semver=semver).exists():
        raise HttpError(409, f"version {semver} already exists for {slug}")

    try:
        content_bytes, digest_hex = read_with_digest(
            content_file, max_bytes=settings.PRIMITIVE_MAX_BYTES
        )
    except SizeLimitExceededError as exc:
        raise HttpError(413, str(exc)) from exc

    agents_list = _parse_json_list(
        "compatible_agents", _require_form_field(request, "compatible_agents")
    )
    use_when_list = _parse_json_list("use_when", _require_form_field(request, "use_when"))
    do_not_use_when_list = _parse_json_list(
        "do_not_use_when", request.POST.get("do_not_use_when") or "[]"
    )

    try:
        storage_key = put_primitive_content(content_bytes, digest_hex=digest_hex)
    except StorageUnavailableError as exc:
        raise HttpError(503, "storage temporarily unavailable") from exc

    # Bearer access token forwards to the signing task — Fulcio binds
    # the resulting cert to the user's OIDC identity (Option A from the
    # PR #4 plan: individual attribution over service-account signing).
    # Empty in DEV_AUTH_BYPASS mode; the noop backend doesn't need it.
    identity_token = _extract_bearer_token(request)

    with transaction.atomic():
        version = PrimitiveVersion.objects.create(
            organization=primitive.organization,
            primitive=primitive,
            semver=semver,
            content_digest=digest_hex,
            storage_key=storage_key,
            tokens=len(content_bytes),
            token_budget=token_budget,
            license=license_val,
            spec_version="0.1",
            submitted_by=user,
            verdict=PrimitiveVersion.Verdict.SUBMITTED,
            compatible_agents=agents_list,
            use_when=use_when_list,
            do_not_use_when=do_not_use_when_list,
        )

        # Create Attestation row in pending state. The Procrastinate
        # task fills in the signing fields when it picks up the job.
        # idempotency_key binds task → row so re-enqueues are no-ops
        # at the task layer (see jobs/sign_tasks.py).
        idempotency_key = f"sign:{version.id}"
        Attestation.objects.create(
            organization=primitive.organization,
            primitive_version=version,
            predicate={
                # Phase 5 fills the real Context CI predicate. For now,
                # a minimal placeholder so the in-toto Statement validates.
                "version_digest": digest_hex,
                "spec_version": "0.1",
                "submitted_at": version.submitted_at.isoformat(),
            },
            status=Attestation.Status.PENDING,
            idempotency_key=idempotency_key,
        )

    # Enqueue OUTSIDE the transaction — defer() commits immediately to
    # the procrastinate_jobs table; if the outer txn rolls back, we'd
    # leave a phantom job. (Procrastinate has a Django-aware connector
    # that handles this automatically, but explicit ordering is safer.)
    from jobs.sign_tasks import sign_version

    sign_version.defer(
        organization_id=str(primitive.organization.id),
        primitive_version_id=str(version.id),
        identity_token=identity_token,
        idempotency_key=idempotency_key,
    )

    return 201, _serialize_version(version)


def _extract_bearer_token(request: HttpRequest) -> str:
    """Pull the bearer access token out of the Authorization header.

    Empty string when there's no header (e.g. DEV_AUTH_BYPASS mode); the
    noop backend doesn't need it, and real backends will fail loudly with
    a SigningFailedError that the user sees as `failure_reason`.
    """
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return ""
    return header.split(" ", 1)[1].strip()


@router.get("/primitives/{slug}/versions/{semver}/content")
@requires_auth
def get_primitive_version_content(request: HttpRequest, slug: str, semver: str) -> HttpResponse:
    """Stream the content bytes for a version, after server-side digest verify.

    Re-hashes the bytes from storage and refuses to serve if they don't
    match the stored `content_digest`. This is the runtime T9 (Trust Drift)
    defense the spec promises — a tampered or corrupted object never
    reaches the caller.
    """
    user = _user(request)
    version = get_object_or_404(
        _scoped_versions(user).select_related("primitive"),
        primitive__slug=slug,
        semver=semver,
    )

    try:
        content = get_primitive_content(digest_hex=version.content_digest)
    except ContentNotFoundError as exc:
        raise HttpError(404, "content missing from storage") from exc
    except DigestMismatchError as exc:
        # Integrity violation — log + refuse. 500 over 502 because we own
        # the storage; the user can't fix the upstream.
        raise HttpError(500, "content integrity check failed") from exc
    except StorageUnavailableError as exc:
        raise HttpError(503, "storage temporarily unavailable") from exc

    response = HttpResponse(content, content_type="text/markdown; charset=utf-8")
    response["X-Content-Digest"] = f"sha256:{version.content_digest}"
    response["Content-Length"] = str(len(content))
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Bundles — curated collections of primitives. Same tenant-scoping rules as
# the primitive endpoints; same IDOR posture.
# ─────────────────────────────────────────────────────────────────────────────


from registry.bundle_schemas import BundleOut  # noqa: E402


def _scoped_bundles(user: User) -> QuerySet[Bundle]:
    return Bundle.objects.filter(organization__in=_user_orgs(user))


def _serialize_bundle(bundle: Bundle) -> BundleOut:
    # Eager-loaded by the caller via prefetch_related("primitives__versions").
    primitives = list(bundle.primitives.all())
    primitive_slugs = [p.slug for p in primitives]

    # Roll up version-derived totals across the bundle's primitives.
    versions: list[PrimitiveVersion] = [
        v for v in (_latest_version(p) for p in primitives) if v is not None
    ]
    total_tokens = sum(v.tokens for v in versions)
    total_budget = sum(v.token_budget for v in versions)
    quality_avg = (
        round(sum((v.quality_score or 0) for v in versions) / len(versions)) if versions else 0
    )
    agent_union: list[str] = []
    seen: set[str] = set()
    for v in versions:
        for agent in v.compatible_agents or []:
            if agent not in seen:
                agent_union.append(agent)
                seen.add(agent)

    return BundleOut(
        slug=bundle.slug,
        name=bundle.name,
        description=bundle.description,
        primitives=primitive_slugs,
        total_tokens=total_tokens,
        total_budget=total_budget,
        compatible_agents=agent_union,
        quality_average=quality_avg,
        use_case=bundle.use_case,
        install_command=f"phub install --bundle {bundle.slug}",
        downloads=0,
        created_at=bundle.created_at,
    )


@router.get("/bundles", response=list[BundleOut])
@requires_auth
def list_bundles(request: HttpRequest) -> list[BundleOut]:
    """List bundles in the caller's orgs."""
    qs = (
        _scoped_bundles(_user(request))
        .select_related("organization")
        .prefetch_related("primitives__versions")
        .order_by("slug")
    )
    return [_serialize_bundle(b) for b in qs]


@router.get("/bundles/{slug}", response=BundleOut)
@requires_auth
def get_bundle(request: HttpRequest, slug: str) -> BundleOut:
    """Single bundle detail."""
    bundle = get_object_or_404(
        _scoped_bundles(_user(request))
        .select_related("organization")
        .prefetch_related("primitives__versions"),
        slug=slug,
    )
    return _serialize_bundle(bundle)
