"""Django settings for the PrimitiveHub API.

Reads configuration from environment variables (12-factor). Sensible defaults
are provided for local dev; production should set every secret explicitly.
"""

from __future__ import annotations

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DEV_AUTH_BYPASS=(bool, False),
    OIDC_VERIFY_AUDIENCE=(bool, True),
)

# Load .env if present (dev convenience)
env_file = BASE_DIR / ".env"
if env_file.is_file():
    env.read_env(str(env_file))

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="dev-secret-not-for-production-replace-via-env",
)
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    "django.contrib.messages",
    "django.contrib.sessions",
    # Third-party
    "corsheaders",
    # Procrastinate must be listed BEFORE apps that define tasks so its
    # management commands (procrastinate worker / healthchecks / schema)
    # discover and configure the App before our tasks register.
    "procrastinate.contrib.django",
    # Project apps
    "accounts",
    "orgs",
    "registry",
    "storage",
    "validation",
    "signing",
    "jobs",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # CORS must precede CommonMiddleware so it can answer OPTIONS preflight
    # before any other middleware short-circuits with a redirect.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # PrimitiveHub OIDC: extracts + validates Bearer tokens, attaches request.oidc_subject
    "accounts.middleware.OIDCAuthenticationMiddleware",
    # Tenant context: sets `primitivehub.current_organization` for RLS.
    # MUST come after OIDC so request.user is populated.
    "accounts.tenant_middleware.TenantContextMiddleware",
]

ROOT_URLCONF = "primitivehub_api.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "primitivehub_api.wsgi.application"
ASGI_APPLICATION = "primitivehub_api.asgi.application"

# Custom user model — see apps.accounts.models.User. OIDC subject is the
# identity; Django doesn't store passwords.
AUTH_USER_MODEL = "accounts.User"

# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────
DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://primitivehub:primitivehub@localhost:5432/primitivehub",
    ),
}
# Use psycopg 3 (the modern driver)
DATABASES["default"]["ENGINE"] = "django.db.backends.postgresql"
DATABASES["default"].setdefault("CONN_MAX_AGE", 60)
DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"].setdefault("connect_timeout", 5)
# Every request runs inside a Postgres transaction. Required so the
# tenant-context middleware can use `SET LOCAL primitivehub.current_organization`
# — without an open transaction, SET LOCAL is silently a no-op and RLS
# would never see the org context. The cost (transaction wrap per request)
# is acceptable for a multi-tenant API where tenant isolation is load-bearing.
DATABASES["default"]["ATOMIC_REQUESTS"] = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─────────────────────────────────────────────────────────────────────────────
# Cache (Valkey, redis-protocol-compatible)
# ─────────────────────────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("VALKEY_URL", default="redis://localhost:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
        },
    },
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ─────────────────────────────────────────────────────────────────────────────
# OIDC / Authentik
# ─────────────────────────────────────────────────────────────────────────────
OIDC_ISSUER = env(
    "OIDC_ISSUER",
    default="http://authentik-server:9000/application/o/primitivehub/",
)
OIDC_AUDIENCE = env("OIDC_AUDIENCE", default="primitivehub-api")
OIDC_VERIFY_AUDIENCE = env("OIDC_VERIFY_AUDIENCE")
OIDC_JWKS_CACHE_SECONDS = 3600

# Dev bypass — when True, every request is treated as authenticated as the
# DEV_OIDC_SUBJECT. ONLY for local dev without Authentik running. Production
# image must never have this set.
DEV_AUTH_BYPASS = env("DEV_AUTH_BYPASS")
DEV_OIDC_SUBJECT = env("DEV_OIDC_SUBJECT", default="dev-mhm@cyberorca.sa")
DEV_OIDC_EMAIL = env("DEV_OIDC_EMAIL", default="dev_mh@protonmail.com")
DEV_OIDC_NAME = env("DEV_OIDC_NAME", default="M.H. (dev)")

if DEV_AUTH_BYPASS and not DEBUG:
    msg = (
        "DEV_AUTH_BYPASS may only be set in combination with DEBUG=True. "
        "Refusing to start with an auth bypass in production mode."
    )
    raise RuntimeError(msg)

# ─────────────────────────────────────────────────────────────────────────────
# Object storage (S3-compatible — R2 in prod, MinIO option for self-host)
# ─────────────────────────────────────────────────────────────────────────────
S3_ENDPOINT_URL = env("S3_ENDPOINT_URL", default="")
S3_ACCESS_KEY_ID = env("S3_ACCESS_KEY_ID", default="")
S3_SECRET_ACCESS_KEY = env("S3_SECRET_ACCESS_KEY", default="")
S3_BUCKET = env("S3_BUCKET", default="primitivehub-primitives")
S3_REGION = env("S3_REGION", default="auto")  # "auto" works with R2

# Per-request upload guard (size limit for primitive content). Defends
# against DoS via massive uploads. 1 MiB is generous for a markdown
# primitive (10 KiB typical, 100 KiB extreme); raise only if a real
# primitive needs it.
PRIMITIVE_MAX_BYTES = env("PRIMITIVE_MAX_BYTES", default=1024 * 1024, cast=int)

# ─────────────────────────────────────────────────────────────────────────────
# Background jobs (Procrastinate — Postgres-backed queue, ADR-0004)
# ─────────────────────────────────────────────────────────────────────────────
# `procrastinate.contrib.django` auto-discovers tasks.py in every app in
# INSTALLED_APPS and uses the default DATABASE connection. The Django
# migrations install the procrastinate schema (run with `python manage.py
# migrate procrastinate`). Worker: `python manage.py procrastinate worker`.
# Defaults are correct for our setup; PROCRASTINATE_* overrides only when
# we need to deviate (e.g. dedicated DB alias for the queue in Phase 7).

# ─────────────────────────────────────────────────────────────────────────────
# Sigstore signing pipeline (ADR-0011 — backend abstraction)
# ─────────────────────────────────────────────────────────────────────────────
# Selects which Sigstore deployment we sign against:
#   public       — production public Sigstore (sigstore.dev)
#   staging      — Sigstore staging (sigstage.dev) — dev default
#   self-hosted  — operator's own deployment (Phase 7 enterprise)
#   noop         — deterministic fake; tests only
# Misconfigured deploys raise UnknownBackendError at first sign() call.
# See apps/api/signing/ for the implementation; ADR-0011 for rationale.
SIGSTORE_BACKEND = env("SIGSTORE_BACKEND", default="staging")

# self-hosted backend requires these THREE (validated at get_backend()).
# Empty defaults are fine since they're only consulted when
# SIGSTORE_BACKEND=self-hosted.
SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH = env("SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH", default="")
SIGSTORE_SELF_HOSTED_REKOR_URL = env("SIGSTORE_SELF_HOSTED_REKOR_URL", default="")
SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE = env(
    "SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE", default=""
)

# ─────────────────────────────────────────────────────────────────────────────
# CORS — the web app (localhost:3000 in dev) calls the api (localhost:8000).
# In prod they share an origin via reverse proxy; CORS_ALLOWED_ORIGINS stays
# empty in that case. Pre-launch posture: explicit allow-list, no wildcards.
# ─────────────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env(
    "CORS_ALLOWED_ORIGINS",
    cast=list,
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "x-requested-with",
]

# ─────────────────────────────────────────────────────────────────────────────
# Internationalization
# ─────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ─────────────────────────────────────────────────────────────────────────────
# Static files
# ─────────────────────────────────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ─────────────────────────────────────────────────────────────────────────────
# Logging — structured JSON to stdout (Docker captures)
# ─────────────────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "primitivehub_api.logging.JsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "primitivehub": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Security (production posture; tighten further per env)
# ─────────────────────────────────────────────────────────────────────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# Pre-launch: deny all crawlers at the response-header level (matches the
# web app's chore/noindex-everywhere posture).
SECURE_REFERRER_POLICY = "no-referrer"
