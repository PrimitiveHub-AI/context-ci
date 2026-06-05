"""Django AppConfig for the `checks` app.

The app holds no models — `default_auto_field` is set anyway so the
Django check-framework doesn't complain.
"""

from __future__ import annotations

from django.apps import AppConfig


class ChecksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "checks"
    verbose_name = "Public lookup (ADR-0034)"
