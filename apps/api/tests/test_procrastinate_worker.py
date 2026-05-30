"""Tests for the Procrastinate worker substrate (Phase 4 PR #1).

These tests verify the smoke task (`primitivehub.ping`) behaves
correctly in two modes — minimal loop check and tenant-aware path —
without spinning up a real worker container. We invoke the task
function directly: that's enough to prove the function logic. The
defer/dispatch loop itself is verified by the live smoke recorded
in the PR description.

A more complete test that exercises the queue table + deferral
will land alongside the first task that genuinely depends on
deferred execution (PR #3 — sign-on-upload).
"""

from __future__ import annotations

import uuid

import pytest

from jobs.tasks import ping


@pytest.mark.django_db
def test_ping_minimal_loop_returns_pong() -> None:
    """No org id → minimal loop check; the task returns `pong: True`."""
    # Calling the task function directly: bypasses the Procrastinate
    # dispatch layer (which is exercised end-to-end by the live worker
    # smoke), and isolates the task's own logic.
    result = ping.func(message="hello")

    assert result == {
        "pong": True,
        "organization_id": None,
        "message": "hello",
        "tenant_aware": False,
    }


@pytest.mark.django_db
def test_ping_tenant_aware_sets_and_reads_back_org_context() -> None:
    """With an org id, the task SET LOCALs it and reads it back.

    This is the canonical pattern every tenant-scoped task will follow.
    If this regresses, every signing task in Phase 4 PR #2+ will quietly
    bypass RLS or operate without context — both modes hide data leaks.
    """
    org_id = str(uuid.uuid4())

    result = ping.func(organization_id=org_id, message="tenant-check")

    assert result["pong"] is True
    assert result["tenant_aware"] is True
    assert result["organization_id"] == org_id
    assert result["message"] == "tenant-check"


# A third test — "does SET LOCAL get discarded between task invocations?"
# — was deliberately not written here. pytest-django wraps each test in
# an outer transaction (so rollback can reset state), which means an
# inner `transaction.atomic()` becomes a SAVEPOINT, not a new
# transaction. SET LOCAL is scoped to the outermost transaction, so it
# persists across savepoints until pytest tears the test down. In
# production each task runs without an outer wrap, so SET LOCAL is
# genuinely per-task. The production behavior is verified by the live
# worker smoke (see PR description), not pytest. Writing a pytest test
# that calls _set_ vs _set local_ via raw connections would test the
# fixture infrastructure, not the task. Skipped.
