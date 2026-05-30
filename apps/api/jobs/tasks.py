"""Procrastinate task definitions.

Tasks are discovered by `procrastinate.contrib.django` at startup
provided this module is imported (the `jobs` AppConfig makes that
implicit by being in INSTALLED_APPS).

Tenant-context discipline
-------------------------
Tasks run outside the request cycle, so `TenantContextMiddleware`
has not fired. Any task that touches tenant-scoped data MUST set
`primitivehub.current_organization` inside its own transaction —
otherwise the RLS policies on tenant tables will deny every row
and the task will silently produce empty results (or worse, leak
across tenants if the role were ever misconfigured).

The `ping` task below is the canonical example. When the second
real task lands (Phase 4 PR #2 onwards), the pattern will be
extracted into a shared decorator.
"""

from __future__ import annotations

from typing import Any

from django.db import connection, transaction
from procrastinate.contrib.django import app

_SQL_SET_TENANT = "SET LOCAL primitivehub.current_organization = %s"


@app.task(queue="default", name="primitivehub.ping")
def ping(*, organization_id: str | None = None, message: str = "") -> dict[str, Any]:
    """Smoke task — verifies the Procrastinate worker loop end-to-end.

    Two modes:
      * `organization_id` is None — minimal loop check (worker → task
        → return). Used by health probes that don't care about RLS.
      * `organization_id` is a UUID string — full tenant-aware path:
        opens a transaction, sets the RLS context, reads it back, and
        returns the observed value. This proves the tenant-context
        pattern works inside a worker context (not just web requests).

    Returned dict is what Procrastinate stores in `procrastinate_jobs.
    result_*` (when result-storage is enabled) and what tests assert on.
    """
    if organization_id is None:
        return {
            "pong": True,
            "organization_id": None,
            "message": message,
            "tenant_aware": False,
        }

    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(_SQL_SET_TENANT, [organization_id])
        cursor.execute("SHOW primitivehub.current_organization")
        row = cursor.fetchone()
        observed = row[0] if row else ""

    return {
        "pong": True,
        "organization_id": observed,
        "message": message,
        "tenant_aware": True,
    }
