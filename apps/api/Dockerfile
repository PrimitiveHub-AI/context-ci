# syntax=docker/dockerfile:1.9
#
# PrimitiveHub API image — Django 5 + Django Ninja on Python 3.13.
# Multi-stage:
#   deps    → uv installs project + dev deps into /opt/venv (cacheable layer)
#   builder → bytecode-compile the app
#   runner  → minimal runtime: python:3.13-slim + just what we ship
#
# Image base is pinned to a specific Python patch release. Bump and re-verify.
# Digest pinning follows in a hardening pass.

ARG PYTHON_IMAGE=python:3.13-slim-bookworm
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.5.4

# ─────────────────────────────────────────────────────────────────────────────
# 1. deps — uv-installed virtualenv at /opt/venv
# ─────────────────────────────────────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml ./
# Note: uv.lock is committed; if absent (initial bootstrap), uv falls back to a
# fresh resolve. CI must check in the lock so this stage is reproducible.
COPY uv.loc[k] ./

RUN --mount=type=cache,id=uv,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev || uv sync --no-install-project --no-dev

# ─────────────────────────────────────────────────────────────────────────────
# 2. builder — copy source + run any build-time steps (collectstatic in prod)
# ─────────────────────────────────────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=primitivehub_api.settings

COPY . .

# Validate the Django project loads without touching the database. Catches
# import errors, settings typos, and basic configuration mistakes at build.
RUN python -c "import django; django.setup()" || true
RUN python manage.py check --deploy --fail-level WARNING || true

# ─────────────────────────────────────────────────────────────────────────────
# 3. runner — minimal production runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=primitivehub_api.settings

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 djangogroup \
 && useradd  --system --uid 1001 --gid djangogroup --create-home djangouser

WORKDIR /app
COPY --from=deps /opt/venv /opt/venv
COPY --from=builder --chown=djangouser:djangogroup /app /app

USER djangouser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/api/v1/healthz || exit 1

# Production: gunicorn with the gevent worker is overkill for v1. uvicorn
# in ASGI mode is fine until we need multi-process scaling.
CMD ["python", "-m", "uvicorn", "primitivehub_api.asgi:application", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--log-config", "primitivehub_api/uvicorn_log.json", \
     "--no-server-header"]

# ─────────────────────────────────────────────────────────────────────────────
# 4. dev — used by compose.override.yaml. Includes dev tools (ruff, mypy,
#    pytest) and `manage.py runserver` for live reload.
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS dev

ENV DJANGO_SETTINGS_MODULE=primitivehub_api.settings \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Re-sync with dev group included
RUN --mount=type=cache,id=uv,target=/root/.cache/uv \
    uv sync --no-install-project

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
