"""Top-level Django Ninja API surface.

Mounted at `/api/v1/`. OpenAPI auto-generated at `/api/v1/openapi.json`.
This file is the single composition point — sub-routers from each app are
registered here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from ninja import NinjaAPI, Schema
from ninja.renderers import JSONRenderer

from accounts.api import router as accounts_router
from orgs.api import router as orgs_router
from registry.api import router as registry_router
from validation.api import router as validation_router


class CamelJSONRenderer(JSONRenderer):
    """JSON renderer that dumps Pydantic Schema instances by_alias=True.

    Schemas defined with `alias_generator=to_camel` emit camelCase keys on
    the wire while keeping snake_case in Python. The default Ninja renderer
    ignores the alias config, so we override it here.
    """

    def render(self, request: Any, data: Any, *, response_status: int) -> bytes:
        if hasattr(data, "model_dump"):
            data = data.model_dump(by_alias=True)
        elif isinstance(data, list):
            data = [
                item.model_dump(by_alias=True) if hasattr(item, "model_dump") else item
                for item in data
            ]
        result: bytes = super().render(request, data, response_status=response_status)
        return result


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
    renderer=CamelJSONRenderer(),
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
    except Exception as exc:
        checks["db"] = f"error: {exc.__class__.__name__}"

    # Cache (Valkey) — set + get a probe key
    try:
        cache.set("healthz:probe", "ok", timeout=10)
        cached_value = cache.get("healthz:probe")
        checks["cache"] = "ok" if cached_value == "ok" else "degraded"
    except Exception as exc:
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
    """Return the active session — subject, profile, and any active tenant.

    The frontend calls this on bootstrap to learn (a) whether a session is
    active and (b) display details to render the navbar. Returns
    `authenticated: false` for anonymous requests instead of 401 so the
    frontend can call it speculatively without setting up auth headers.
    """
    subject = getattr(request, "oidc_subject", None)
    user = getattr(request, "user", None) if subject else None
    profile: dict[str, Any] | None = None
    if user is not None:
        profile = {
            "id": str(user.id),
            "subject": subject,
            "email": user.email or "",
            "displayName": user.display_name or user.email or subject or "",
        }
    return {
        "subject": subject,
        "authenticated": subject is not None,
        "devBypass": bool(settings.DEV_AUTH_BYPASS),
        "user": profile,
        "activeOrganization": getattr(request, "tenant_org_id", None),
    }


api.add_router("", orgs_router)
api.add_router("", registry_router)
api.add_router("", validation_router)
api.add_router("", accounts_router)
