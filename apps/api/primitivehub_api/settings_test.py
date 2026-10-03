"""Test-specific settings — Postgres-backed, RLS-active.

PrimitiveHub's multi-tenant safety story rests on Postgres Row-Level
Security. sqlite is explicitly forbidden here — it would silently skip
every RLS policy in the migrations (per the `if vendor != "postgresql"`
guard) and the test suite would no longer verify tenant isolation at the
database layer.

Test DB layout
  - Same `postgres` compose service as dev
  - Dedicated `primitivehub_test` database, created+migrated+destroyed
    by pytest-django per test session
  - Connection comes from `TEST_DATABASE_URL`, falling back to the dev
    URL with the database name swapped out
"""

from __future__ import annotations

import environ

from .settings import *  # noqa: F403

DEBUG = True
DEV_AUTH_BYPASS = True
# settings.py enables SECURE_SSL_REDIRECT at import time (CI has DEBUG=False then),
# which 301-redirects every test-client HTTP request to https:// before it reaches
# the endpoint — breaking all API POST tests. The test client never uses SSL.
SECURE_SSL_REDIRECT = False

_env = environ.Env()

# Resolve the test DB connection. Default pattern: same host/port/user as
# dev, dedicated database. The compose `postgres` service exposes itself
# under the hostname `postgres` inside the api container.
# Tests connect as `primitivehub_app` — NOSUPERUSER role created in the
# postgres init flow. Postgres superusers bypass RLS unconditionally, so
# tests that exercise the policy MUST connect as a non-superuser role
# (this is the lesson from why the previous sqlite-based suite never
# caught the bypass).
_default_test_db_url = (
    "postgres://primitivehub_app:primitivehub_app@postgres:5432/primitivehub_test"
)
DATABASES = {
    "default": _env.db_url(
        "TEST_DATABASE_URL",
        default=_default_test_db_url,
    ),
}
DATABASES["default"]["ENGINE"] = "django.db.backends.postgresql"
DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"].setdefault("connect_timeout", 5)
# Tests rely on pytest-django's session-level transaction wrap (and the
# per-test rollback) instead of ATOMIC_REQUESTS, so the autouse
# `SET ROLE test_bypass_rls` in conftest.py persists across the test's
# request flow. Production keeps ATOMIC_REQUESTS=True (settings.py).
DATABASES["default"]["ATOMIC_REQUESTS"] = False
# pytest-django mirrors `default` into the test runner; naming the
# test DB explicitly here keeps it stable across pytest invocations
# and prevents accidental cross-talk with the dev database.
DATABASES["default"]["TEST"] = {"NAME": "primitivehub_test"}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    },
}

SECRET_KEY = "test-secret-key-do-not-use-in-production"  # noqa: S105
