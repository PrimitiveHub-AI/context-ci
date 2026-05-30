# ADR-0006: Postgres Row-Level Security for tenant isolation

**Status:** Accepted
**Date:** 2026-05-29

## Context

PrimitiveHub is multi-tenant from day one — Organizations contain
Registries, Repositories, Primitives, etc. Tenant isolation is
load-bearing: one tenant's data leaking to another is the worst
possible product failure (worse than downtime).

Two defenses are possible:

1. Application-level only — every queryset includes
   `.filter(organization__in=user_orgs)`. Lives in code.
2. Application-level AND database-level (RLS) — same application
   filter PLUS Postgres Row-Level Security policy denies cross-tenant
   reads at the DB layer.

The first is necessary but not sufficient — a single missed `.filter()`
call leaks rows. The second is defense in depth: even if the
application filter is buggy, the DB refuses the read.

## Decision

Both layers. Application-level scoping is the primary defense; Postgres
RLS is defense in depth.

Implementation:
- Every tenant-scoped table carries an `organization_id` FK.
- A RunPython migration enables and FORCES Row-Level Security on each
  table (FORCE means even the table owner is subject to the policy).
- The policy reads `primitivehub.current_organization` from the
  session and limits visibility to matching rows.
- A `TenantContextMiddleware` reads `X-Organization-Slug` per request
  and SET LOCALs the org UUID before any query runs.
- The application connects as a NOSUPERUSER NOBYPASSRLS role
  (`primitivehub_app`), not the bootstrap superuser. Superusers bypass
  RLS unconditionally.
- A dedicated `test_rls_actually_isolates.py` exercises the policy via
  raw SQL (bypassing the application filter) to prove the DB layer
  enforces.

## Alternatives considered

1. **Application-level only** — Simplest. Rejected because a single
   missing `.filter()` call in a single endpoint silently leaks rows
   across tenants. The test suite can't catch every endpoint; RLS as
   a backstop catches what tests miss.

2. **Schema-per-tenant** — Each tenant gets a Postgres schema. Hard
   isolation but heavy ops (migrations have to run per-schema, connection
   pools partition per-schema, etc.). Rejected for v1; kept on the
   Phase 7 roadmap as an option for enterprises with extreme isolation
   requirements.

3. **Database-per-tenant** — Maximum isolation, maximum ops cost.
   Rejected outright for v1; viable only for very large enterprise.

4. **No tenant isolation** — Some marketplaces are single-tenant
   (one organization owns everything). Rejected because PrimitiveHub
   is a multi-tenant registry by product design.

## Consequences

**Positive:**
- Two independent layers must both fail before cross-tenant data
  leaks. Significantly harder for a single bug to cause a data breach.
- The policy is one place. New tables get RLS in their initial
  migration; no per-endpoint discipline required to gate cross-tenant
  reads at the DB layer.
- `test_rls_actually_isolates.py` is one canonical place that
  regression-tests the policy. If a future migration drops RLS by
  mistake, this test fails.

**Negative:**
- ATOMIC_REQUESTS=True is required so `SET LOCAL` works (transaction-
  scoped). Adds transaction overhead to every request. Acceptable;
  Postgres handles it.
- Test fixtures that insert cross-tenant data have to use a BYPASSRLS
  role for setup, then drop back to the app role for assertions.
  `tests/conftest.py` has the autouse fixture; new test files inherit
  it automatically.
- Postgres-only. Tests CANNOT run on sqlite — sqlite would skip the
  RLS migrations and silently mask regressions. CLAUDE.md explicitly
  forbids sqlite for tests.
- Roles + grants are stateful: pytest-django's `--reuse-db` is
  required so the test DB's grants survive across runs. (See `bugs.md`
  #14.)

## References

- `apps/api/registry/migrations/0002_rls_policies.py` — initial RLS
  enable + policy creation.
- `apps/api/registry/migrations/0005_bundle_rls.py` — RLS on Bundle.
- `apps/api/validation/migrations/0002_rls_policies.py` — RLS on
  ReviewItem + PipelineStage.
- `apps/api/accounts/tenant_middleware.py` — sets
  `primitivehub.current_organization` per request.
- `apps/api/tests/test_rls_actually_isolates.py` — proves enforcement.
- `infra/postgres/init-multi-db.sh` — creates the non-superuser app
  role + test bypass role on cluster init.
- `apps/web/content/primitives/ddia-multi-tenant.md` — DDIA principles
  applied.
- `apps/web/content/primitives/security-engineering-supplychain.md`
  § IDOR prevention.
- `docs/bugs.md` #8, #9, #14, #15, #16 — the RLS-related bugs we hit
  while wiring this up.
