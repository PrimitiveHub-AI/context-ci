"""Validation models — review queue + Context CI pipeline stages.

ReviewItem is the "what needs human review now" surface that the
/validation page renders. PipelineStage is the per-stage result of one
Context CI run, the structured log behind the attestation predicate.

Both are tenant-scoped via organization FK + RLS policy (migration
0002). Append-only by convention: existing rows are never UPDATEd
once recorded; status transitions are new rows in the audit log
(future work — Phase 4 wires the state machine).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from orgs.models import Organization
from registry.models import PrimitiveVersion


class ReviewItem(models.Model):
    """A primitive version waiting on, or in, a review stage."""

    class Status(models.TextChoices):
        NEEDS_SECURITY_REVIEW = "needs_security_review", "Needs Security Review"
        BENCHMARK_FAILED = "benchmark_failed", "Benchmark Failed"
        HUMAN_REVIEW_PENDING = "human_review_pending", "Human Review Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="review_items"
    )
    primitive_version = models.ForeignKey(
        PrimitiveVersion,
        on_delete=models.CASCADE,
        related_name="review_items",
    )
    status = models.CharField(max_length=32, choices=Status.choices)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reviews_assigned",
        blank=True,
        null=True,
    )
    comments_count = models.PositiveIntegerField(default=0)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "validation_review_item"
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["primitive_version"]),
            models.Index(fields=["status"]),
            models.Index(fields=["-submitted_at"]),
        ]

    def __str__(self) -> str:
        return f"review:{self.primitive_version}:{self.status}"


class PipelineStage(models.Model):
    """One Context CI stage result for a primitive version.

    The full pipeline (Schema → Safety → Benchmark → … → Trusted) is the
    set of PipelineStage rows for a given PrimitiveVersion, ordered by
    `position`. The attestation predicate aggregates these.
    """

    class StageStatus(models.TextChoices):
        PASSED = "passed", "Passed"
        WARNING = "warning", "Warning"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="pipeline_stages"
    )
    primitive_version = models.ForeignKey(
        PrimitiveVersion,
        on_delete=models.CASCADE,
        related_name="pipeline_stages",
    )
    name = models.CharField(max_length=120)
    position = models.PositiveSmallIntegerField(
        help_text="0-based position in the pipeline (Schema=0, Safety=1, …)"
    )
    status = models.CharField(max_length=12, choices=StageStatus.choices)
    score = models.PositiveSmallIntegerField(
        blank=True, null=True, help_text="0-100; null for non-scoring stages"
    )
    duration_ms = models.PositiveIntegerField(blank=True, null=True)
    log = models.TextField(blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="pipeline_stages_executed",
        blank=True,
        null=True,
    )
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "validation_pipeline_stage"
        constraints = [
            models.UniqueConstraint(
                fields=["primitive_version", "position"],
                name="validation_pipeline_pv_position_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["primitive_version", "position"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.primitive_version}:{self.position}:{self.name}"
