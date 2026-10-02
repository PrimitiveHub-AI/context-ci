---
spec_version: "0.1"
name: django-ninja-production
version: 0.1.0
type: engineering
domain: backend
author: PrimitiveHub AI (synthesized 2026-05-29 from Django 5 production patterns, adapted from DRF to Ninja)
license: CC-BY-4.0
tokens: 4200
token_budget: 6000
risk_level: low
content_digest: sha256:d1a0bc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a6
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
use_when:
  - "Adding or modifying any file in apps/api/"
  - "Writing or reviewing Django models, serializers, or endpoints"
  - "Adding Procrastinate tasks"
  - "Implementing IDOR prevention or RBAC"
  - "Writing API tests for Django Ninja endpoints"
do_not_use_when:
  - "Frontend or design work"
  - "Pure Python scripts without Django"
attestation: cci-v0.1
description: "Django 5 + Django Ninja + Procrastinate + Postgres + Valkey production patterns. ORM optimization, Ninja routers, server-side ownership, IDOR prevention via two-layer defense, Procrastinate task design, testing patterns."
keywords: [django, django-ninja, ninja, procrastinate, idor, orm, n-plus-one, multi-tenant]
references:
  - "Django 5 docs"
  - "Django Ninja docs — https://django-ninja.dev"
  - "Procrastinate docs"
---

# Django + Django Ninja Production

## Purpose

Production patterns for PrimitiveHub's `apps/api`. We use **Django 5 +
Django Ninja** (not DRF), **Procrastinate** (not Celery), **Postgres**
(not sqlite outside tests), and **Valkey** (Redis-compatible). This
primitive distills the production patterns that matter: ORM
optimization, Ninja routing + schema modeling, server-side ownership
enforcement, IDOR prevention, Procrastinate task design, testing.

The most common AI-output failures: (a) N+1 queries, (b) trusting the
client for owner fields, (c) skipping ownership checks because "auth
middleware ran," (d) passing model instances as task args, (e)
forgetting `transaction.on_commit()` before enqueueing tasks.

## Core Principles

### ORM

- **N+1 prevention is non-negotiable.** Use `select_related` for FK /
  OneToOne, `prefetch_related` for reverse FK / M2M. Combine for
  multi-relation paths.
- **Encapsulate optimized querysets** in custom managers so callers
  can't forget.
- **Filter before annotate.** Filtering after forces processing of
  all rows.
- **Atomic operations** via `F('field') + 1` (DB-level, race-free).
- **Indexes go on Model.Meta.** Pair with `CheckConstraint` for
  invariants the DB enforces even outside Django.

### Ninja

- **Schemas are Pydantic models.** Strict typing, automatic OpenAPI.
  Don't return raw dicts; return typed `Schema` instances.
- **Routers per app.** `apps/orgs/api.py` exports a `router`; the
  main `primitivehub_api/api.py` mounts it via `api.add_router(…)`.
- **Async-native when needed.** Ninja supports `async def` handlers.
  Use for I/O-heavy paths; sync is fine for ORM.

### Server-side ownership

- **Never trust the client for owner fields.** Set them server-side
  from `request.user` / `request.oidc_subject`.
- **Two-layer ownership defense:** (1) queryset scoped to tenant in
  `get_queryset`-equivalent, (2) explicit ownership check before
  mutation. Postgres RLS adds a third layer.

### IDOR prevention (the load-bearing thing)

The core question: **"Can User A access, modify, or delete User B's
data?"** Every endpoint accepting a user-controllable ID gets traced:

1. Where does the ID enter? (path, query, body)
2. Where is data fetched? (ORM call)
3. What enforces ownership between 1 and 2?

If the answer to 3 is "the auth middleware," it's wrong. Auth proves
identity, not authorization.

### Procrastinate

- **Pass IDs, not model instances.** Serialization is JSON.
- **Always `transaction.on_commit()` before enqueueing.** Otherwise
  the worker may start before the row exists.
- **Idempotency is mandatory** for any task that produces external
  side effects.

## Decision Rules

### Models

- **IF a new FK is added THEN** explicitly add a `models.Index` on
  the FK column. Django's auto-index varies.
- **IF a new model is tenant-scoped THEN** add `organization` FK +
  add the RLS policy in a follow-up migration (see
  `ddia-multi-tenant` primitive).
- **IF a model needs invariants the DB should enforce THEN** add
  `CheckConstraint` to `Model.Meta.constraints`. Don't rely on Python
  validators alone.

### Endpoints

- **IF an endpoint reads a user-controllable ID THEN** use a tenant-
  scoped queryset, not `Model.objects.get(pk=pk)`. Verify membership
  before any operation.
- **IF an endpoint creates a row THEN** set owner fields from
  `request.user` (or `request.oidc_subject` translated to a User
  row). Never `Model.objects.create(**body.dict())` where body could
  carry an owner field.
- **IF an endpoint returns "not allowed" THEN** return 404, not 403.
  404 reveals nothing about existence.
- **IF an endpoint is mutating THEN** wrap in `transaction.atomic()`.
- **IF a Ninja schema field can be omitted by client THEN** make it
  `Optional[…]` and validate explicitly. Don't accept incomplete
  payloads silently.

### Procrastinate tasks

- **IF a task is enqueued from a request handler THEN** wrap the
  enqueue in `transaction.on_commit(lambda: task.defer(...))`.
- **IF a task produces an external side effect THEN** define an
  idempotency key. Re-runs must be safe.
- **IF a task has a long max execution THEN** also have a soft
  timeout with cleanup logic. Hard timeouts kill without cleanup.
- **IF the task imports models THEN** import inside the function
  body to avoid circular imports.

### Testing

- **IF testing a list endpoint THEN** verify queryset scoping
  prevents seeing other tenants' rows.
- **IF testing an object endpoint THEN** verify access to another
  user's object returns 404.
- **IF testing query count is important THEN** wrap with
  `assertNumQueries(N)`.
- **IF testing a Procrastinate task THEN** call directly (sync) in
  unit tests; configure `defer_inline=True` for integration tests
  that go through `defer()`.

## Anti-Patterns

- **`Model.objects.get(pk=pk)` without owner filter.** IDOR by design.
- **`fields = '__all__'` in any input schema.** Lets the client
  inject fields they shouldn't.
- **`serializer.save(**request.data)` in DRF, or
  `Model.objects.create(**body.dict())` in Ninja.** Same problem:
  client controls owner fields.
- **Same Valkey DB for cache + Procrastinate state.** Cache eviction
  can wipe queued state.
- **Catching all exceptions in a task and returning silently.**
  Failures must be surfaced.
- **`transaction.atomic()` inside a Procrastinate task that calls
  `task.defer()`.** Use `on_commit()` even inside tasks if defer
  follows commit.
- **`time.sleep()` inside an async Ninja handler.** Use
  `asyncio.sleep` or move to a Procrastinate job.
- **Raw SQL where ORM suffices.** Loses validation, signals,
  consistency. Use ORM unless EXPLAIN says otherwise.
- **`select_for_update()` without timeout.** Held indefinitely on
  worker hang.
- **`only(...)` then accessing deferred field in a loop.** Each
  access fires a query. Worse than not using `only()` at all.

## Review Checklist

- [ ] No N+1: hot paths use `select_related` / `prefetch_related`.
- [ ] FK columns explicitly indexed.
- [ ] Tenant scoping at queryset level for every multi-tenant model.
- [ ] Owner fields are set server-side; never accepted from client.
- [ ] User-controllable IDs are scoped to the user's tenant before
      fetch. RLS is defense in depth, not the only line.
- [ ] Mutations are in `transaction.atomic()`.
- [ ] Task enqueues use `transaction.on_commit()`.
- [ ] Tasks pass IDs, not model instances.
- [ ] Tasks have idempotency keys for external side effects.
- [ ] Tests assert 404 (not 403) for cross-tenant access.
- [ ] Tests use `assertNumQueries` on hot paths.
- [ ] No `fields = '__all__'` on input schemas.
- [ ] Statement timeouts at the DB level cover runaway queries.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. For every new endpoint, write the IDOR trace in the PR
   description: ID source → fetch path → ownership enforcement.
2. For every new task, write the idempotency key + the re-run safety
   argument.
3. Recommend `pg_stat_statements` queries when slow-query problems
   surface.
4. Suggest the test for cross-tenant access on every new endpoint.
5. Flag any `time.sleep` / synchronous blocking call in async
   handlers.

## Expected Output Format

For a new endpoint:

```
ENDPOINT: <METHOD path>
TENANT SCOPE: <queryset filter that limits to the actor's tenant>
IDOR TRACE:
  ID source: <path/query/body>
  Fetch: <ORM call>
  Ownership check: <code/RLS/manager method>
INPUT SCHEMA: <Pydantic model, explicit fields>
OUTPUT SCHEMA: <Pydantic model, explicit fields>
SIDE EFFECTS: <tasks deferred, with idempotency keys>
TESTS:
  - 401 for unauthenticated
  - 404 for cross-tenant access
  - Query count assertion on hot path
```

## Examples

`apps/api/accounts/middleware.py` implements OIDC token validation —
JWKS-cached, signature/audience/issuer-checked, and refuses to run if
`DEV_AUTH_BYPASS=True` while `DEBUG=False`. The DEV bypass path
provisions a User row from a fixed subject for fast local iteration.

`apps/api/registry/migrations/0002_rls_policies.py` enables RLS on
every tenant-scoped table via `RunPython` with a Postgres-only check.
Sqlite tests pass through unchanged.

## References

- Django 5 docs
- Django Ninja docs: https://django-ninja.dev
- Procrastinate: https://procrastinate.readthedocs.io
- Companion: `ddia-multi-tenant`
- Companion: `postgresql-production`
- Companion: `security-engineering-supplychain`
