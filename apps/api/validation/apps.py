"""Validation app — Context CI pipeline runs + review queue.

Owns ReviewItem (the queue a reviewer sees) and PipelineStage (the
per-stage result emitted by a Context CI run). Sigstore attestation
itself lives on `registry.Attestation`; this app owns the operational
state that produces it.
"""

from __future__ import annotations

from django.apps import AppConfig


class ValidationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "validation"
    verbose_name = "Validation"
