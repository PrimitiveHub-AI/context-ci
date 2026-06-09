"""Shared fixtures for the checks test suite.

`run_inline` makes the async `/check` flow testable in-process: it
patches `run_check.defer` so the Procrastinate task body runs
synchronously inside the POST, so a single subsequent poll yields a
terminal verdict (ADR-0034 async amendment).
"""

from __future__ import annotations

from typing import Any

import pytest

from checks import tasks as check_tasks


@pytest.fixture
def run_inline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run the scan synchronously instead of deferring it to a worker."""

    def _defer(**kwargs: Any) -> None:
        check_tasks.run_check(**kwargs)

    monkeypatch.setattr("checks.api.run_check.defer", _defer)
