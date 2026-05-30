# ADR-0004: Procrastinate over Celery for background jobs

**Status:** Accepted
**Date:** 2026-05-28

## Context

PrimitiveHub's Context CI pipeline (Phase 5) is fundamentally async —
schema validation, safety scanning, benchmark runs, attestation
generation, webhook delivery, Rekor inclusion polling. These don't
belong on a request thread.

Two patterns dominate the Python async-job space:

1. Celery + Redis/RabbitMQ
2. Postgres-backed task queues (Procrastinate, django-q2, dramatiq)

The decision shapes operational complexity, idempotency guarantees,
and how the validation pipeline composes.

## Decision

Procrastinate for background jobs. Postgres-backed (uses the existing
Postgres instance, no new stateful service). Tasks defined per Django
app under `<app>/tasks.py`. Workers run as a sibling container in
compose.

## Alternatives considered

1. **Celery + RabbitMQ** — Industry default. Rejected because:
   - Adds a third stateful service (RabbitMQ) to ops. Hetzner CX22 +
     Postgres + Valkey + Authentik + the app already fills the small
     host; adding RabbitMQ for queue durability when Postgres can do
     it is premature.
   - Transactional enqueue is awkward in Celery. We want `task.defer()`
     inside `transaction.atomic()` to ROLL BACK with the transaction
     if the request fails. Procrastinate's Postgres-native enqueue is
     truly transactional.
   - Celery's at-most/at-least/exactly-once semantics are murky;
     Procrastinate's are explicit (at-least-once with idempotency
     keys is the path).

2. **Celery + Redis (as broker)** — Lighter weight than RabbitMQ but
   loses transactional enqueue (Redis isn't part of the Postgres
   transaction). Same critique as Celery+RabbitMQ for ordering and
   idempotency.

3. **django-q2** — Newer, smaller. Rejected because Procrastinate has
   better documentation, more production users at scale, and
   first-class async support.

4. **Dramatiq + Redis** — Excellent design, simpler than Celery.
   Rejected for the same transactional-enqueue reason; we want
   Postgres-backed.

5. **Roll our own** — `select FOR UPDATE SKIP LOCKED` is the standard
   pattern; we could write it in an afternoon. Rejected because
   Procrastinate already did it, plus retries, plus periodic schedules,
   plus the management commands; reinventing is waste.

## Consequences

**Positive:**
- One fewer stateful service. Postgres is the truth (DDIA principle);
  the job queue lives there too.
- `transaction.on_commit(lambda: task.defer(...))` is the canonical
  pattern. Job state moves with the transaction; if the row insert
  rolls back, the job doesn't enqueue.
- Job inspection is `SELECT * FROM procrastinate_jobs`. No separate
  monitoring tool needed for dev.
- Tracks job history per task in Postgres — useful for the audit log
  we'll need in Phase 5+.

**Negative:**
- Postgres is now load-bearing for both OLTP and jobs. A Postgres
  outage takes both down simultaneously. Mitigation: jobs that produce
  external side effects are idempotent by design (per
  `security-engineering-supplychain` primitive), so re-running after
  Postgres recovers is safe.
- Less community than Celery; fewer "how do I do X in Procrastinate"
  Stack Overflow answers. Docs are good though.
- Throughput ceiling is whatever Postgres can do on the queue table.
  For Phase 5+ Context CI loads (~hundreds of primitives/day),
  Postgres-as-queue scales fine; if we hit a wall, an in-place migration
  to a separate queue Postgres instance is straightforward.

## References

- `apps/web/content/primitives/django-ninja-production.md` § Procrastinate
- `apps/web/content/primitives/ddia-multi-tenant.md` § Idempotency +
  ordering — every task gets an idempotency key.
- `apps/api/pyproject.toml` — `procrastinate[django]>=2.15` declared.
  Phase 4 wires actual tasks.
