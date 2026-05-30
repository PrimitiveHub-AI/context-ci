# ADR-0003: Django Ninja over Django REST Framework

**Status:** Accepted
**Date:** 2026-05-28

## Context

Phase 3 needed a Python API framework on top of Django. Django REST
Framework (DRF) is the conventional choice, but its design predates
type hints and Pydantic. Newer options exist.

The decision shapes every endpoint we'll ship.

## Decision

Django Ninja for the API layer. Pydantic schemas as input/output
contracts. Routers per Django app, composed in
`apps/api/primitivehub_api/api.py`.

## Alternatives considered

1. **Django REST Framework (DRF)** — The default Django API toolkit.
   Mature, huge ecosystem, every "Django API tutorial" uses it.
   Rejected because:
   - Serializers are not Pydantic; types are runtime-only and lack the
     compile-time guarantees mypy gives us with Pydantic.
   - Class-based views encourage inheritance hierarchies that obscure
     the IDOR-trace pattern we want explicit on every endpoint.
   - OpenAPI generation requires `drf-spectacular` (a third package
     with its own quirks); Ninja generates it from Pydantic types
     natively.
   - Async support added late and feels bolted on.

2. **FastAPI standalone (no Django)** — The Ninja-flavor experience
   without the Django ORM. Rejected because:
   - We need Django's ORM, admin, migrations, auth scaffolding, RLS
     migration tooling. Replacing them costs weeks.
   - The maintainer's prior project (Meteorium) ran on Django; carrying
     over operational muscle memory is value.

3. **Starlette + custom layer** — Maximum control. Rejected as
   too-much-glue.

4. **Django Ninja Extra** — A community extension that adds more
   class-based ergonomics. Rejected because the base Ninja's
   function-based handlers are easier to reason about for the IDOR
   trace pattern we want explicit.

## Consequences

**Positive:**
- Endpoint handlers are functions with Pydantic-typed arguments and
  Pydantic return types. mypy strict mode catches contract drift at
  compile time.
- OpenAPI schema auto-generated from types. `/api/v1/openapi.json` is
  always current; can feed a future SDK generator.
- Per-router config (`Router(by_alias=True)`) keeps wire-format choices
  local to each router.
- Async-native — Ninja's `async def` handlers integrate with Django's
  async ORM cleanly. Useful for I/O-heavy paths (Sigstore calls,
  Authentik JWKS fetches).
- Smaller surface area than DRF; less framework to learn for new
  contributors.

**Negative:**
- Smaller community than DRF; some patterns we have to invent (e.g.,
  the camelCase response renderer; the Pydantic 2.13 + UploadedFile
  forward-ref workaround). Both are captured in `docs/bugs.md`.
- DRF's permissions/authentication classes are conventional; Ninja
  uses decorators (`@requires_auth` in `primitivehub_api/auth.py`).
  Different mental model.
- Some Django integrations (django-stubs, django-filter) target DRF
  first; we sometimes need to roll our own.

## References

- `apps/web/content/primitives/django-ninja-production.md` — the
  primitive that calibrates how we write Ninja endpoints.
- `apps/api/primitivehub_api/auth.py` — `@requires_auth` decorator.
- `apps/api/registry/api.py` — IDOR-trace pattern in practice.
- `docs/bugs.md` #10 (Ninja + Pydantic alias serialization), #11
  (Ninja + Pydantic forward-ref on UploadedFile).
