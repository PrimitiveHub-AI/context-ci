"""OIDC bearer-token validation middleware.

Behavior:
  - In DEV_AUTH_BYPASS mode: every request is treated as authenticated as
    DEV_OIDC_SUBJECT. The User row is auto-created if missing.
  - In normal mode: looks for `Authorization: Bearer <jwt>`, verifies signature
    via Authentik's JWKS, validates `iss` and (optionally) `aud`, stores the
    `sub` claim on `request.oidc_subject` and auto-creates / looks up the
    matching User row.

Does NOT reject unauthenticated requests outright — that decision belongs to
individual endpoints. Phase 4 will add a per-route `@requires_auth` decorator
that 401s when `request.oidc_subject is None`.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any
from urllib.parse import urljoin

import httpx
import jwt
from django.conf import settings
from django.http import HttpRequest, HttpResponse

from .models import User

logger = logging.getLogger("primitivehub.auth")


class _JwksCache:
    """In-process JWKS cache. Refreshes lazily after `OIDC_JWKS_CACHE_SECONDS`."""

    def __init__(self) -> None:
        self._keys: dict[str, Any] | None = None
        self._fetched_at: float = 0
        self._lock = threading.Lock()

    def _is_stale(self) -> bool:
        return (
            self._keys is None
            or time.time() - self._fetched_at > settings.OIDC_JWKS_CACHE_SECONDS
        )

    def get(self) -> dict[str, Any]:
        with self._lock:
            if self._is_stale():
                self._refresh()
            assert self._keys is not None
            return self._keys

    def _refresh(self) -> None:
        well_known = urljoin(settings.OIDC_ISSUER, ".well-known/openid-configuration")
        try:
            with httpx.Client(timeout=5.0) as client:
                discovery = client.get(well_known).raise_for_status().json()
                jwks_uri: str = discovery["jwks_uri"]
                jwks: dict[str, Any] = client.get(jwks_uri).raise_for_status().json()
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "JWKS refresh failed",
                extra={"issuer": settings.OIDC_ISSUER, "exc": str(exc)},
            )
            # Keep the stale keys rather than wiping them — better to authenticate
            # against slightly-old keys than to lock everyone out during an outage.
            if self._keys is None:
                self._keys = {"keys": []}
            return
        self._keys = jwks
        self._fetched_at = time.time()


_jwks_cache = _JwksCache()


def _ensure_user_for_subject(
    subject: str,
    email: str = "",
    display_name: str = "",
) -> User:
    """Get-or-create a User row for the given OIDC subject."""
    user, created = User.objects.get_or_create(
        subject=subject,
        defaults={"email": email, "display_name": display_name},
    )
    if created:
        logger.info(
            "Provisioned User from OIDC",
            extra={"subject": subject, "email": email},
        )
    return user


def _validate_jwt(token: str) -> dict[str, Any] | None:
    """Validate a JWT against Authentik's JWKS. Returns the decoded claims or None."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        return None

    kid = unverified_header.get("kid")
    if not kid:
        return None

    jwks = _jwks_cache.get()
    key_dict = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key_dict is None:
        return None

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_dict))

    options = {"verify_aud": settings.OIDC_VERIFY_AUDIENCE}
    audience = settings.OIDC_AUDIENCE if settings.OIDC_VERIFY_AUDIENCE else None

    try:
        return jwt.decode(
            token,
            public_key,
            algorithms=[key_dict.get("alg", "RS256")],
            audience=audience,
            issuer=settings.OIDC_ISSUER.rstrip("/"),
            options=options,
        )
    except jwt.InvalidTokenError as exc:
        logger.info("Token validation failed", extra={"reason": exc.__class__.__name__})
        return None


class OIDCAuthenticationMiddleware:
    """Attach `request.oidc_subject` and `request.user` based on Bearer token."""

    def __init__(self, get_response: Any) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request.oidc_subject = None  # type: ignore[attr-defined]

        if settings.DEV_AUTH_BYPASS:
            subject = settings.DEV_OIDC_SUBJECT
            user = _ensure_user_for_subject(
                subject=subject,
                email=settings.DEV_OIDC_EMAIL,
                display_name=settings.DEV_OIDC_NAME,
            )
            request.oidc_subject = subject  # type: ignore[attr-defined]
            request.user = user  # type: ignore[assignment]
            return self.get_response(request)

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.lower().startswith("bearer "):
            return self.get_response(request)

        token = auth_header.split(" ", 1)[1].strip()
        claims = _validate_jwt(token)
        if claims is None:
            return self.get_response(request)

        subject = claims.get("sub")
        if not subject:
            return self.get_response(request)

        user = _ensure_user_for_subject(
            subject=subject,
            email=claims.get("email", ""),
            display_name=claims.get("name", "") or claims.get("preferred_username", ""),
        )
        request.oidc_subject = subject  # type: ignore[attr-defined]
        request.user = user  # type: ignore[assignment]
        return self.get_response(request)
