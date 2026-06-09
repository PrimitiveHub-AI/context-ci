"""Procrastinate task for the async `/check` flow — ADR-0034 (async amendment).

Auto-discovered by `procrastinate.contrib.django` because `checks` is in
INSTALLED_APPS and this module is named `tasks`. The task runs on a
DEDICATED `checks` queue so a flood of public scans queues up instead of
fanning out and starving the box; `--concurrency` on the worker is the
hard ceiling on parallel scans (and therefore on scan memory).

The web tier never runs the scan: `POST /check` stashes the input in
Valkey and defers `run_check`, which pops the input (scrubbing it),
runs the Top 10, and writes the verdict to the poll record.

No tenant context: `/check` is anonymous and touches no RLS-scoped
tables, so — unlike `sign_version` — this task does not SET LOCAL the
organization.
"""

from __future__ import annotations

import logging
from typing import Any, cast

from procrastinate.contrib.django import app

from .pipeline import ScanMode, execute_check
from .results import mark_done, mark_error, pop_input, write_cached_verdict

log = logging.getLogger("primitivehub.check")


@app.task(queue="checks", name="primitivehub.run_check")
def run_check(*, request_id: str, mode: str, cache_key: str = "") -> dict[str, Any]:
    """Run one queued `/check` scan to completion and store the result.

    Always writes a TERMINAL poll record (done or error) so the client
    poll never hangs — even on input expiry or an unexpected exception.
    On success, also populates the content-addressed verdict cache under
    `cache_key` so identical future inputs skip the scan entirely.
    Returns a small status dict for observability; the cache record is
    the source of truth the poll endpoint reads.
    """
    raw_input = pop_input(request_id)
    if raw_input is None:
        # Input TTL elapsed before a worker picked the job up (rare:
        # only under a deep backlog). Tell the user plainly to retry.
        mark_error(
            request_id,
            "check:input-expired",
            "Your check was queued but expired before it could run. Please try again.",
        )
        return {"ok": False, "request_id": request_id, "reason": "input_expired"}

    try:
        outcome = execute_check(cast("ScanMode", mode), raw_input, request_id)
    except Exception:
        # Unhandled bug in a resolver/detector. Never leak internals to
        # the user; log the full trace for triage.
        log.exception("run_check: unexpected failure (mode=%s)", mode)
        mark_error(
            request_id,
            "check:internal",
            "The scan failed unexpectedly. Please try again.",
        )
        return {"ok": False, "request_id": request_id, "reason": "internal_error"}

    if outcome["ok"]:
        mark_done(request_id, outcome["result"])
        # Populate the dedup cache so identical inputs skip the scan.
        if cache_key:
            write_cached_verdict(cache_key, outcome["result"])
    else:
        err = outcome["error"]
        mark_error(request_id, err["code"], err["message"])
    return {"ok": outcome["ok"], "request_id": request_id}
