"""Django AppConfig for signing."""

from __future__ import annotations

from django.apps import AppConfig


class SigningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "signing"
    verbose_name = "Sigstore signing pipeline"
