"""Top-level Django Ninja API surface.

Mounted at `/api/v1/`. OpenAPI auto-generated at `/api/v1/openapi.json`.
This file is the single composition point — sub-routers from each app are
registered here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from django.conf import settings
from django.db import connection
from django.core.cache import cache
from ninja import NinjaAPI, Schema

# Future: from apps.orgs.api import router as orgs_router
# Future: from apps.registry.api import router as registry_router


class HealthResponse(Schema):
    """Lightweight liveness + dependency-reachability check."""

    status: str
    service: str
    version: str
    timestamp: str
    checks: dict[str, str]


api = NinjaAPI(
    title="PrimitiveHub API",
    version="0.1.0",
    description=(
        "PrimitiveHub registry backend — the trust layer for AI Context Primitives. "
        "Bound to the Primitive Spec v0.1 and the Context CI Attestation predicate "
        "(https://primitivehub.ai/context-ci/v0.1/Attestation)."
    ),
    docs_url="/docs",
    openapi_url="/openapi.json",
)


@api.get("/healthz", response=HealthResponse, tags=["meta"])
def healthz(request: Any) -> HealthResponse:
    """Return `{ status: "ok", checks: { db, cache } }` if all deps respond."""
    checks: dict[str, str] = {}

    # Database — `SELECT 1` against Postgres
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["db"] = "ok"
    except Exception as exc:  # noqa: BLE001 — surface any DB problem to the response
        checks["db"] = f"error: {exc.__class__.__name__}"

    # Cache (Valkey) — set + get a probe key
    try:
        cache.set("healthz:probe", "ok", timeout=10)
        cached_value = cache.get("healthz:probe")
        checks["cache"] = "ok" if cached_value == "ok" else "degraded"
    except Exception as exc:  # noqa: BLE001
        checks["cache"] = f"error: {exc.__class__.__name__}"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"

    return HealthResponse(
        status=overall,
        service="primitivehub-api",
        version="0.1.0",
        timestamp=datetime.now(tz=UTC).isoformat(),
        checks=checks,
    )


@api.get("/whoami", tags=["meta"])
def whoami(request: Any) -> dict[str, Any]:
    """Return the OIDC subject the request carries, or null if unauthenticated.

    Useful in Phase 3 for confirming the auth middleware + Authentik wiring
    actually work end-to-end without needing a real protected endpoint yet.
    """
    subject = getattr(request, "oidc_subject", None)
    return {
        "subject": subject,
        "authenticated": subject is not None,
        "dev_bypass": bool(settings.DEV_AUTH_BYPASS),
    }


# Phase 4+ sub-routers register here:
# api.add_router("/orgs", orgs_router)
# api.add_router("/primitives", registry_router)
