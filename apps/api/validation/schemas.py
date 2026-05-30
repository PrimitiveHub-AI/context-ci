"""Validation schemas — ReviewItem + PipelineStage."""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — Pydantic needs runtime access

from registry.schemas import CamelSchema

_WEB_STATUS_BY_DB: dict[str, str] = {
    "needs_security_review": "Needs Security Review",
    "benchmark_failed": "Benchmark Failed",
    "human_review_pending": "Human Review Pending",
    "approved": "Approved",
    "rejected": "Rejected",
}


def web_status_for(db_value: str) -> str:
    """Map ReviewItem.Status DB value → web ReviewStatus literal."""
    return _WEB_STATUS_BY_DB.get(db_value, db_value)


class ReviewItemOut(CamelSchema):
    """Mirrors `apps/web/lib/types.ts:ReviewItem`."""

    primitive: str
    author: str
    status: str
    reviewer: str | None = None
    submitted_at: datetime
    comments: int
    version: str
    risk_level: str


class PipelineStageOut(CamelSchema):
    """Mirrors `apps/web/lib/types.ts:PipelineStage`."""

    name: str
    status: str
    score: int
    duration: str
    log: str
    reviewer: str
