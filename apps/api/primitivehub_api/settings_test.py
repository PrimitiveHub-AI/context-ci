"""Test-specific settings — used by pytest via pytest-django."""

from __future__ import annotations

from .settings import *  # noqa: F401,F403

DEBUG = True
DEV_AUTH_BYPASS = True

# In-memory sqlite for fast unit tests; integration tests will use a real
# Postgres fixture via testcontainers (Phase 3 follow-up).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    },
}

SECRET_KEY = "test-secret-key-do-not-use-in-production"  # noqa: S105
