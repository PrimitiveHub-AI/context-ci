"""Registry app — the core artifact graph.

Registry → Repository → Primitive → PrimitiveVersion → Attestation.
"""

from __future__ import annotations

from django.apps import AppConfig


class RegistryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.registry"
    label = "registry"
    verbose_name = "Registry"
