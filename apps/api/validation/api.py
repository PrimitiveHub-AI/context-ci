"""Validation endpoints.

GET /api/v1/reviews                                  — review queue
GET /api/v1/primitives/{slug}/versions/{semver}/pipeline-stages
                                                      — stages for one version

IDOR trace
  ID source:  path / query (user-controllable).
  Fetch:      Queryset scoped to `organization__in=_user_orgs(request.user)`.
              Slug lookups apply after the tenant scope so cross-tenant
              access returns 404 (no existence leak).
  Ownership:  Tenant scope + Postgres RLS (validation 0002 migration).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from django.shortcuts import get_object_or_404
from ninja import Router

from accounts.models import User  # noqa: TC001 — used by cast() at runtime
from orgs.models import Organization
from primitivehub_api.auth import requires_auth
from registry.models import PrimitiveVersion
from validation.models import PipelineStage, ReviewItem
from validation.schemas import PipelineStageOut, ReviewItemOut, web_status_for

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from django.http import HttpRequest

router = Router(tags=["validation"], by_alias=True)


def _user(request: HttpRequest) -> User:
    return cast("User", request.user)


def _user_orgs(user: User) -> QuerySet[Organization]:
    return Organization.objects.filter(members__user=user)


def _format_duration(ms: int | None) -> str:
    if ms is None:
        return "—"
    if ms < 1000:
        return f"{ms}ms"
    seconds = ms / 1000
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = seconds / 60
    return f"{minutes:.1f}m"


@router.get("/reviews", response=list[ReviewItemOut])
@requires_auth
def list_reviews(request: HttpRequest) -> list[ReviewItemOut]:
    """Return the review queue for orgs the caller belongs to.

    Ordered by submitted_at DESC (newest first). No pagination yet —
    review queues are small in practice (Phase 5+ adds cursor pagination
    when a real volume justifies it).
    """
    user = _user(request)
    items = (
        ReviewItem.objects.filter(organization__in=_user_orgs(user))
        .select_related(
            "primitive_version",
            "primitive_version__primitive",
            "primitive_version__submitted_by",
            "reviewer",
        )
        .order_by("-submitted_at")
    )
    out: list[ReviewItemOut] = []
    for item in items:
        version = item.primitive_version
        primitive = version.primitive
        out.append(
            ReviewItemOut(
                primitive=primitive.slug,
                author=getattr(version.submitted_by, "display_name", "")
                or getattr(version.submitted_by, "email", "")
                or version.submitted_by.subject,
                status=web_status_for(item.status),
                reviewer=(
                    getattr(item.reviewer, "display_name", None)
                    or getattr(item.reviewer, "email", None)
                    if item.reviewer
                    else None
                ),
                submitted_at=item.submitted_at,
                comments=item.comments_count,
                version=version.semver,
                risk_level=primitive.risk_level,
            )
        )
    return out


@router.get(
    "/primitives/{slug}/versions/{semver}/pipeline-stages",
    response=list[PipelineStageOut],
)
@requires_auth
def list_pipeline_stages(request: HttpRequest, slug: str, semver: str) -> list[PipelineStageOut]:
    """Stages for one primitive version, ordered by `position` ascending."""
    user = _user(request)
    version = get_object_or_404(
        PrimitiveVersion.objects.filter(organization__in=_user_orgs(user)),
        primitive__slug=slug,
        semver=semver,
    )
    stages = (
        PipelineStage.objects.filter(primitive_version=version)
        .select_related("reviewer")
        .order_by("position")
    )
    return [
        PipelineStageOut(
            name=s.name,
            status=s.status,
            score=s.score or 0,
            duration=_format_duration(s.duration_ms),
            log=s.log,
            reviewer=(
                getattr(s.reviewer, "display_name", "") or getattr(s.reviewer, "email", "") or "—"
                if s.reviewer
                else "—"
            ),
        )
        for s in stages
    ]
