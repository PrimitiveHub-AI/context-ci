"""Storage app — content-addressed object store (R2 / MinIO)."""

from __future__ import annotations

from django.apps import AppConfig


class StorageConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "storage"
    verbose_name = "Object Storage"
