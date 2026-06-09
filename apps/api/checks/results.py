"""Valkey-backed handoff + result store for the async `/check` flow.

ADR-0034 (async amendment). Two short-lived keys per request, both in
the default cache (Valkey):

  phub-check:input:{id}   the raw input, handed from the web tier to
                          the worker. SCRUBBED by the worker the moment
                          the scan finishes (`pop_input`). Never written
                          to Postgres — the durable truth DB never sees
                          user-submitted content (ADR-0034 § 5).
  phub-check:status:{id}  the poll record: pending → done | error.

Why the input lives in Valkey and NOT in the Procrastinate job args:
job args are stored in `procrastinate_jobs` (Postgres) until the job
is pruned, which would persist the input in the durable DB. Valkey is
the ephemeral cache; the input is deleted immediately post-scan and
otherwise expires on a short TTL.
"""

from __future__ import annotations

from typing import Any

from django.core.cache import cache

# Input must outlive the queue wait + the worst-case scan runtime
# (github: 2x30s fetch + 30s extraction + scan). 10 min is comfortable
# headroom; the worker deletes the key as soon as the scan returns.
INPUT_TTL_SECONDS = 10 * 60
# Verdict results stay pollable for an hour after completion.
RESULT_TTL_SECONDS = 60 * 60


def _input_key(request_id: str) -> str:
    return f"phub-check:input:{request_id}"


def _status_key(request_id: str) -> str:
    return f"phub-check:status:{request_id}"


def stash_input(request_id: str, raw_input: str) -> None:
    """Store the input for worker pickup, with a short TTL."""
    cache.set(_input_key(request_id), raw_input, timeout=INPUT_TTL_SECONDS)


def pop_input(request_id: str) -> str | None:
    """Read the input and delete it in the same breath (scrub-on-read)."""
    key = _input_key(request_id)
    value = cache.get(key)
    cache.delete(key)
    return value if isinstance(value, str) else None


def mark_pending(request_id: str, mode: str) -> None:
    cache.set(
        _status_key(request_id),
        {"status": "pending", "requestId": request_id, "mode": mode},
        timeout=RESULT_TTL_SECONDS,
    )


def mark_done(request_id: str, result: dict[str, Any]) -> None:
    cache.set(
        _status_key(request_id),
        {"status": "done", "requestId": request_id, "result": result},
        timeout=RESULT_TTL_SECONDS,
    )


def mark_error(request_id: str, code: str, message: str) -> None:
    cache.set(
        _status_key(request_id),
        {
            "status": "error",
            "requestId": request_id,
            "error": {"code": code, "message": message},
        },
        timeout=RESULT_TTL_SECONDS,
    )


def read_status(request_id: str) -> dict[str, Any] | None:
    """Return the poll record, or None if unknown/expired."""
    value = cache.get(_status_key(request_id))
    return value if isinstance(value, dict) else None
