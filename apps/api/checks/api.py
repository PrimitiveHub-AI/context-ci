"""Public `/check` paste-and-verdict endpoint — ADR-0034 (async amendment).

  POST /api/v1/check          enqueue a scan
    Request:  { mode: "content"|"url"|"npx"|"github"|"auto", input: str }
    Response: 202 { requestId, status: "pending", mode } | { error }

  GET  /api/v1/check/{id}     poll for the verdict
    Response: 200 { status: "pending" }
              200 { status: "done",  result: {...} }
              200 { status: "error", error: {...} }
              404 { error }  (unknown / expired requestId)

The scan itself — outbound fetch + tarball extraction + the Top 10 over
every file — runs on the Procrastinate `checks` queue, NOT in this web
request (ADR-0034 async amendment). A single slow scan can no longer
starve the web process or its health check. The web tier only enqueues
and reads the cached poll record.

This endpoint is ANONYMOUS by design. Abuse is bounded by per-IP rate
limits on the POST (rate_limit.py). The input bytes are never written
to Postgres — they live transiently in Valkey and are scrubbed the
moment the scan finishes (results.py).
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

# These imports look type-only but Ninja inspects the runtime annotations to
# build the Pydantic param model — moving them into a TYPE_CHECKING block
# triggers `QueryParams is not fully defined` at request time.
from django.http import HttpRequest, HttpResponse, JsonResponse
from ninja import Router, Schema
from pydantic import Field

from .github_resolver import looks_like_github
from .pipeline import MAX_CONTENT_BYTES
from .rate_limit import (
    LONG_WINDOW_LIMIT,
    SHORT_WINDOW_LIMIT,
    check_rate_limit,
    client_ip,
)
from .results import mark_pending, read_status, stash_input
from .tasks import run_check

router = Router(tags=["checks"])

_RL_HEADERS = (
    "X-RateLimit-Short-Limit",
    "X-RateLimit-Short-Remaining",
    "X-RateLimit-Long-Limit",
    "X-RateLimit-Long-Remaining",
    "Retry-After",
)


CheckMode = Literal["content", "url", "npx", "github", "auto"]


def _sniff_mode(raw: str) -> Literal["content", "url", "npx", "github"]:
    """Decide which pipeline to run for a `mode=auto` request.

    The order matters: GitHub coordinates are detected BEFORE generic
    URLs because `https://github.com/owner/repo` is useful as a
    tarball, not as a fetched HTML page. npm coordinates are matched
    by command-prefix or scoped-name heuristics.
    """
    stripped = raw.strip()
    lowered = stripped.lower()
    # GitHub: claude-skill-install, github.com URL, git@github.com, bare owner/repo.
    if looks_like_github(stripped):
        return "github"
    # npm coordinate by command prefix or by `npx ` / `pnpm dlx ` etc.
    if lowered.startswith(
        (
            "npx ",
            "pnpx ",
            "bunx ",
            "yarn dlx ",
            "pnpm dlx ",
            "npm install ",
            "npm i ",
            "npm add ",
            "pnpm install ",
            "pnpm add ",
            "yarn add ",
            "bun add ",
        )
    ):
        return "npx"
    # Bare URL → fetch.
    if lowered.startswith(("http://", "https://")):
        return "url"
    # Scoped-package shape like `@scope/name@1.0.0` (no command prefix).
    if stripped.startswith("@") and "/" in stripped and " " not in stripped:
        return "npx"
    # Single-token without spaces and with no whitespace-separated text:
    # could be a bare package name. Conservative — only treat as npx
    # when there's no newline.
    if "\n" not in stripped and " " not in stripped and len(stripped) <= 214 and "@" in stripped:
        # `name@version` shape, no slash → bare npm coord.
        return "npx"
    # Default: treat as raw content.
    return "content"


class CheckRequest(Schema):
    """Request payload — mode dispatches to one of three pipelines."""

    mode: CheckMode = Field(
        ...,
        description="What kind of input is being submitted.",
    )
    input: str = Field(
        ...,
        description="The pasted content / URL / npx coordinate.",
        min_length=1,
        max_length=MAX_CONTENT_BYTES,
    )


def _copy_rl_headers(out: JsonResponse, source: HttpResponse) -> JsonResponse:
    """Copy any rate-limit headers already set on `source` onto `out`."""
    for header in _RL_HEADERS:
        value = source.get(header)
        if value is not None:
            out[header] = value
    return out


def _error(
    response: HttpResponse,
    code: str,
    message: str,
    status: int = 400,
    *,
    request_id: str | None = None,
) -> JsonResponse:
    """Return a `JsonResponse` with the named error code + rate-limit headers."""
    body = {
        "error": {"code": code, "message": message},
        "requestId": request_id or str(uuid.uuid4()),
    }
    return _copy_rl_headers(JsonResponse(body, status=status), response)


@router.post("/check", tags=["checks"])
def check(
    request: HttpRequest,
    response: HttpResponse,
    payload: CheckRequest,
) -> JsonResponse:
    """Enqueue a paste / URL / npx / GitHub scan; returns 202 + a requestId.

    Anonymous. Rate-limited per-IP (30/5min, 500/24h) on this POST.
    The scan runs on the `checks` worker queue; poll
    `GET /api/v1/check/{requestId}` for the verdict. The input bytes
    are never persisted to Postgres — only verdict metadata is logged.

    `mode=auto` is the default for the public UI: the input is sniffed
    and dispatched to the right pipeline (`github` for repo URLs and
    `claude skill install` commands; `npx` for npm coordinates; `url`
    for bare `https://` URLs; `content` for everything else).
    """
    request_id = str(uuid.uuid4())

    # Rate limit first. Increment regardless of outcome so we count
    # malformed-payload spam against the bucket.
    ip = client_ip(request)
    decision = check_rate_limit(ip)
    response["X-RateLimit-Short-Limit"] = str(SHORT_WINDOW_LIMIT)
    response["X-RateLimit-Short-Remaining"] = str(decision.short_remaining)
    response["X-RateLimit-Long-Limit"] = str(LONG_WINDOW_LIMIT)
    response["X-RateLimit-Long-Remaining"] = str(decision.long_remaining)
    if not decision.allowed:
        response["Retry-After"] = str(decision.retry_after_seconds)
        bucket = decision.bucket
        msg = (
            f"Rate limit hit ({bucket}-window). Retry in "
            f"{decision.retry_after_seconds // 60 or 1} minute(s)."
        )
        return _error(response, "rate-limit", msg, status=429, request_id=request_id)

    raw_input = payload.input
    mode: Literal["content", "url", "npx", "github"] = (
        _sniff_mode(raw_input) if payload.mode == "auto" else payload.mode
    )

    # Hand the input to the worker via Valkey (NOT via job args — those
    # land in Postgres). Seed the poll record as pending, then defer.
    stash_input(request_id, raw_input)
    mark_pending(request_id, mode)
    run_check.defer(request_id=request_id, mode=mode)

    out = JsonResponse(
        {"requestId": request_id, "status": "pending", "mode": mode},
        status=202,
    )
    return _copy_rl_headers(out, response)


@router.get("/check/{request_id}", tags=["checks"])
def check_status(request: HttpRequest, request_id: str) -> dict[str, Any] | JsonResponse:
    """Poll a queued check. Cheap cache read — not rate-limited.

    Returns the poll record (`pending` / `done` / `error`) at 200, or
    404 if the requestId is unknown or its result has expired.
    """
    record = read_status(request_id)
    if record is None:
        return JsonResponse(
            {
                "error": {
                    "code": "check:not-found",
                    "message": "No check with that id — it may have expired. Run it again.",
                },
                "requestId": request_id,
            },
            status=404,
        )
    return record
