# apps/api — PrimitiveHub backend

Django 5 + [Django Ninja](https://django-ninja.dev) + Postgres 17 + Valkey + Procrastinate + Cloudflare R2 + Authentik OIDC.

This is the trust-layer backend. The Primitive Spec v0.1 (see `docs/spec.md`) is the contract; everything here is an implementation of that contract.

## Status

Phase 3 — **bootstrap**. The bones exist:

- Multi-tenant schema in the first migration (Organization → Member → Registry → Repository → Primitive → PrimitiveVersion → Attestation)
- Postgres Row-Level Security on every tenant-scoped table
- Custom `User` model bound to OIDC subjects (no passwords stored)
- OIDC bearer-token middleware (Authentik JWKS verification, with `DEV_AUTH_BYPASS` for local-only fast iteration)
- Django Ninja API surface with auto-generated OpenAPI at `/api/v1/openapi.json`
- `/api/v1/healthz` and `/api/v1/whoami` smoke endpoints
- Multi-stage `Dockerfile` (uv-managed Python 3.13, non-root runtime)
- Compose integration with the rest of the stack (Postgres, Valkey, Authentik server + worker)

What's NOT in this PR (each lands separately):

- Business endpoints (primitive upload, version listing, attestation lookup) — Phase 4
- Sigstore signing wiring — Phase 4
- Procrastinate worker process — Phase 4
- Content-addressed storage (R2 client) — `feat/content-addressed-storage`
- API integration on the frontend (kill the mock data) — `feat/api-integration`

## Local development

From the repo root:

```bash
# Bring up the whole stack (web + api + postgres + valkey + authentik)
docker compose up

# Once running:
#   web:        http://localhost:3000
#   api:        http://localhost:8000/api/v1/healthz
#   api docs:   http://localhost:8000/api/v1/docs
#   openapi:    http://localhost:8000/api/v1/openapi.json
#   authentik:  http://localhost:9000 (first-time login: admin@cyberorca.sa + bootstrap password)
```

In dev, `DEV_AUTH_BYPASS=True` is set in `compose.override.yaml` — the API treats every request as authenticated as `dev-mhm@cyberorca.sa`. No Authentik configuration needed to start hacking on endpoints.

### Without Docker (host-only, for fast Python iteration)

Requires Python 3.13 + uv installed on the host. From `apps/api`:

```bash
uv sync
cp .env.example .env
# Edit .env: DATABASE_URL → local postgres, VALKEY_URL → local valkey
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
```

### Useful commands

All run from `apps/api/`:

```bash
uv run python manage.py migrate                # apply migrations
uv run python manage.py makemigrations         # generate new migrations
uv run python manage.py createsuperuser        # admin user (asks for OIDC subject)
uv run python manage.py shell_plus             # if django-extensions is installed
uv run python scripts/check_schema.py          # schema invariant guard
uv run pytest                                  # tests
uv run ruff check .                            # lint
uv run ruff format .                           # auto-format
uv run mypy primitivehub_api apps              # type check
```

## Cryptographic posture

Per `docs/spec.md`:

- **Content Digest** = SHA-256 of the canonical content. `PrimitiveVersion.content_digest` is this value; `storage_key` matches.
- **Signature** = Ed25519 via Sigstore Fulcio + Rekor. Wired in Phase 4.
- **Attestation** = in-toto Statement with `predicateType = https://primitivehub.ai/context-ci/v0.1/Attestation`. The `Attestation` model carries the payload.

The `Attestation.signature_envelope` field stays empty until Phase 4 wires Sigstore.

## Multi-tenancy

Every tenant-scoped table has an `organization` foreign key plus a Postgres RLS policy (migration `0002_rls_policies`). The application sets a session-local Postgres variable per request:

```sql
SET LOCAL primitivehub.current_organization = '<org-uuid>';
```

The RLS policy filters every query through `organization_id = primitivehub_current_org()`. A missing or mismatched session variable means zero rows visible — fail-closed.

Phase 3 follow-up: tenant-context middleware that resolves the active organization from the OIDC subject's memberships and sets the session variable. Until then, RLS is enabled but the app code must set the variable manually (admin-only flows).

For sqlite (test) backends, the RLS migration is a no-op — see migration `0002_rls_policies.py`.

## Layout

```
apps/api/
├── pyproject.toml             uv-managed
├── .python-version            3.13
├── manage.py                  Django management entry
├── Dockerfile                 multi-stage (deps → builder → runner + dev)
├── .dockerignore
├── .env.example
├── primitivehub_api/          Django project package
│   ├── settings.py
│   ├── settings_test.py       sqlite + DEV_AUTH_BYPASS for fast tests
│   ├── urls.py                mounts /api/v1 + /admin
│   ├── api.py                 Ninja API composition + healthz + whoami
│   ├── asgi.py / wsgi.py
│   ├── logging.py             single-line JSON formatter for stdout
│   └── uvicorn_log.json
├── accounts/                  custom User + OIDC middleware
├── orgs/                      Organization + OrganizationMember + Role
├── registry/                  Registry → Repository → Primitive → Version → Attestation
├── tests/                     smoke tests
└── scripts/check_schema.py    invariant guard
```

## License

Private. Copyright (c) 2026 CyberOrca Labs.
