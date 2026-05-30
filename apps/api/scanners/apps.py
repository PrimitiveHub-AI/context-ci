"""Django AppConfig for scanners."""

from __future__ import annotations

from django.apps import AppConfig


class ScannersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scanners"
    verbose_name = "Context CI scanners"
