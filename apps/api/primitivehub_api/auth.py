"""Authentication decorators for Ninja endpoints.

The OIDC middleware (`apps.accounts.middleware`) populates `request.oidc_subject`
when a Bearer token validates (or when `DEV_AUTH_BYPASS=True`). It does NOT
reject unauthenticated requests — that decision belongs here, per-endpoint.

Pre-launch posture: every read endpoint requires authentication. Anonymous
browsing of the marketplace opens in Phase 6 behind a feature flag.
"""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from django.http import HttpRequest
from ninja.errors import HttpError

F = TypeVar("F", bound=Callable[..., Any])


def requires_auth(view: F) -> F:
    """Reject unauthenticated requests with 401.

    Authenticated = `request.oidc_subject is not None`, i.e. the OIDC
    middleware accepted a valid Bearer token (or DEV_AUTH_BYPASS provisioned
    a synthetic subject for local dev).

    A 401 response carries no body that could leak existence of protected
    resources — IDOR defense in depth.
    """

    @wraps(view)
    def wrapper(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:
        if getattr(request, "oidc_subject", None) is None:
            raise HttpError(401, "Authentication required")
        return view(request, *args, **kwargs)

    return wrapper  # type: ignore[return-value]
