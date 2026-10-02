---
spec_version: "0.1"
name: ddia-multi-tenant
version: 0.1.0
type: architecture
domain: backend
author: PrimitiveHub AI (synthesized 2026-05-29 from Martin Kleppmann's "Designing Data-Intensive Applications")
license: CC-BY-4.0
tokens: 4200
token_budget: 6000
risk_level: low
content_digest: sha256:dd1a0bc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a4
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
use_when:
  - "Adding or modifying any Django model in apps/api/"
  - "Designing or changing a multi-tenant data flow (Organization-scoped tables, RLS)"
  - "Implementing event sourcing, idempotency, or derived-data flows"
  - "Reviewing reliability, fault firewalls, or partial-failure handling"
  - "Designing schema migrations, especially zero-downtime ones"
  - "Choosing between transactional and analytical storage paths"
do_not_use_when:
  - "Pure frontend code"
  - "Static doc edits"
attestation: cci-v0.1
description: "DDIA distilled for PrimitiveHub's apps/api: reliability budgets, fault-to-failure firewalls, idempotency keys, read-your-writes, causal ordering, transactions vs analytics split, schema evolution, content-addressed storage as derived state."
keywords: [ddia, kleppmann, multi-tenant, rls, idempotency, causal-ordering, schema-evolution, content-addressed]
references:
  - "Martin Kleppmann — Designing Data-Intensive Applications"
---

# DDIA for PrimitiveHub Multi-Tenant Backend

## Purpose

PrimitiveHub's backend (`apps/api/`) is a multi-tenant registry that
must be reliable, scalable, and maintainable under real load. DDIA is
the standard reference for these properties; this primitive distills
the principles that matter to PrimitiveHub's specific shape — Postgres
+ Procrastinate + Valkey + R2 + multi-tenant RLS + content-addressed
storage of immutable primitive versions.

The PrimitiveHub doctrine inherited from DDIA:

- **Postgres is the source of truth** unless explicitly stated.
- **Search, analytics, counters, dashboards, notifications, and feeds
  are derived state.**
- **Every external side effect must be idempotent.**
- **Every event must carry versioning and causal context when
  ordering matters.**
- **Privacy beats analytics. Integrity beats timeliness for
  destructive or trust-bearing actions.**

## Core Principles

### Reliability + scalability fundamentals

- **Reliability budget.** Faults are inevitable. Design so faults
  don't become user-visible failures. Every primitive-publish or
  attestation path declares: what can fail, what the user sees, how
  recovery works.

- **Fault-to-failure firewall.** Separate local component faults from
  user-visible product failure through retries, fallbacks,
  idempotency, and graceful degradation. Never let a secondary system
  (analytics, search reindex) corrupt primary registry state.

- **Tail latency SLO.** Mean latency is useless. Track p50/p95/p99/p999
  for ritual paths (primitive publish, primitive read, verify). Mean
  hides the worst experience. Always measure client-visible time,
  including queueing.

- **Head-of-line blocking detection.** A few slow Context-CI jobs
  block many fast ones if they share a queue. Split queues by ritual
  urgency: validation runs (slow, queued), webhooks (fast), search
  indexing (background). Dead-letter poison jobs.

- **Load parameter contract.** Don't optimize unknown load. For
  PrimitiveHub: load params include primitives/second published, reads
  /second of trusted primitives, validation runs queued, etc.
  Document per feature.

### Multi-tenant data model

- **Postgres is the truth.** Every other surface (search index,
  Valkey cache, analytics rollups, ClickHouse if added) is derived
  from Postgres. Lose any of them → rebuild from Postgres. Lose
  Postgres → catastrophic, restore from PITR backup.

- **Tenant scope is explicit on every table.** Every row carries
  `organization_id`. RLS policy enforces. Application code carries a
  second check (defense in depth).

- **Search index is derived state.** Postgres FTS for v1; Meilisearch
  later. Either way, the index is rebuildable. Search outage degrades
  discovery, never corrupts primitives.

- **Cache invalidation is explicit, not TTL-only.** When a primitive
  version is attested, the cache key for that primitive must be
  invalidated immediately. TTL alone causes stale "Trusted" badges to
  linger when a primitive was rejected.

### Idempotency + ordering

- **Every external side effect is idempotent.** Webhook delivery,
  email notification, Sigstore Rekor submission, attestation
  publication — each takes an idempotency key derived from the
  primitive version's content digest. Re-dispatch is safe.

- **Idempotency keys are stored.** Don't trust "I'll just check if
  the side effect already happened" — race condition. Store the
  idempotency key + dispatch result; subsequent attempts return the
  stored result.

- **Causal ordering when it matters.** Submit → Schema → Safety →
  Benchmark → Human Review → Trusted. Skipping a stage is a bug.
  Causal vector or strict-sequence enforced in `ValidationRun.state`
  enum + state-machine helper.

- **Read-your-writes guarantee for the submitter.** Within the same
  user session, the author who just submitted a primitive version
  must see it appear as `Submitted` immediately, regardless of
  replication lag. Read from leader, or use session-pinning.

### Transactional vs analytical

- **OLTP path and analytics path are separate.** Don't run heavy
  reports on the same Postgres instance that handles publish/read
  traffic. v1: light analytics via materialized views, scheduled
  rebuild. v2+: ClickHouse for events, kept eventually-consistent.

- **The OLTP layer is small + fast.** Postgres can serve 10k+
  primitives/sec of read traffic if the schema is tuned. Don't
  prematurely add a cache for sub-millisecond reads; do add a cache
  for cross-region latency.

- **Counter / metric updates are derived state.** Don't UPDATE a row
  every time someone reads a primitive. Append an event; aggregate
  hourly. Otherwise contention kills throughput.

### Schema evolution

- **Schema evolution must support rolling upgrades.** New code and
  old code coexist during deploy. Migrations are additive (add
  column, write to both, read from new, drop old). Never breaking.

- **Hand-edited Django migrations are committed.** Never use
  `--squash` on released migrations. The migration history is the
  schema's audit trail.

- **RLS migrations are `RunPython` with a Postgres-only check** so
  sqlite tests still work. (See
  `apps/api/registry/migrations/0002_rls_policies.py`.)

- **Versioned API surface.** `/api/v1/…` today. Breaking changes →
  `/api/v2/…` AND deprecate v1 with timeline. Never silently change
  semantics under the same URL.

### Content-addressed storage

- **Object key = content digest.** Always. Primitives are immutable;
  storage is content-addressed; verification is re-hash + compare.
  No mutable object keys.

- **Storage is a derived view of the digest.** R2 (or MinIO) is
  durable storage; Postgres knows "this primitive version has digest
  X." Lose the storage → re-upload from the original source or
  recompute from a backup snapshot. Lose Postgres → restore from
  PITR.

- **No mutation of object content.** Updates ship as new version with
  new digest. Old version remains accessible at its key. Old version's
  attestation remains valid.

### Failure handling

- **Timeouts everywhere.** Every external call (Sigstore Fulcio, R2
  upload, OIDC JWKS fetch) has a timeout. No call hangs indefinitely.

- **Retries with exponential backoff + jitter.** Procrastinate
  handles this for tasks. Inline HTTP calls in request handlers must
  also wrap with a retry decorator that respects backoff.

- **Don't trust wall clocks across nodes.** Distributed coordination
  uses Postgres serializable transactions or Procrastinate's
  Postgres-backed locks, not "everyone agrees on the time."

## Decision Rules

- **IF a new model is added THEN** declare `organization_id` if it's
  tenant-scoped; add the RLS policy in a `_rls_policies` migration; add
  the application-level owner check in the service layer.
- **IF a new side effect is added (webhook, email, Sigstore call,
  Rekor submission) THEN** define the idempotency key and the storage
  for dispatch results. Otherwise re-dispatch will produce duplicates.
- **IF a primitive version is created THEN** the create path uses a
  Postgres transaction that wraps: insert version row, compute digest,
  upload to R2 with `If-None-Match`, write attestation row. Either all
  succeed or none do. (Two-phase if needed; usually a single tx
  suffices because R2 is idempotent on conflict.)
- **IF an endpoint reads a primitive THEN** read from Postgres. Don't
  read from the search index — search is derived state and can lag.
- **IF a counter (downloads, installs) is incremented THEN** append
  an event; aggregate later. Don't UPDATE the row.
- **IF the schema is migrated THEN** the change is additive +
  rolling-deploy-safe. Drop columns / rename tables only after
  multiple deploys confirm no readers remain.
- **IF an external call has no timeout THEN** add one. Default
  timeout: 5s for sync, 30s for async.
- **IF you need exactness on a counter THEN** use a Postgres advisory
  lock or serializable transaction. Don't use Valkey atomic ops as
  the source of truth.
- **IF processing requires causal ordering THEN** use a state
  machine with explicit transitions. Don't trust queue arrival order.
- **IF a stage takes long (validation, benchmarking) THEN** it's a
  Procrastinate task, not a request handler. Inline long work blocks
  the request.

## Anti-Patterns

- **Using the search index as the source of truth for any
  user-facing read.** Search is derived; it can be stale or empty
  during reindex.
- **`SELECT ... FOR UPDATE` without a timeout.** Holds the row
  indefinitely if the calling code hangs.
- **N+1 queries in any hot path.** Use `select_related` /
  `prefetch_related` (Django) or explicit joins.
- **Reading from Postgres followers immediately after writing.**
  Replication lag → user doesn't see their own write. Read leader
  for read-your-writes.
- **Counter UPDATEs on hot rows.** Hot row contention kills
  throughput.
- **Breaking schema changes deployed without migration path.**
  Mid-deploy, half the fleet is on new code, half on old. Old code
  must tolerate new schema (additive only).
- **Same wall clock across nodes for ordering.** Use a logical
  clock (Postgres txn ID) or causal vector.
- **Trusting that a side-effect call completed because the HTTP
  call returned 200.** It may have completed; it may have been retried.
  Always idempotency-key.
- **Storing primitives by random UUID instead of content digest.**
  Loses verification property + duplicate-detection.
- **Tight coupling between OLTP and analytics.** Analytics queries
  steal IOPS from publish/read.

## Review Checklist

- [ ] Every tenant-scoped table has `organization_id` FK + RLS
      policy.
- [ ] Application service code checks ownership explicitly (defense
      in depth).
- [ ] External side effects have idempotency keys + stored results.
- [ ] External calls have explicit timeouts.
- [ ] Long work is Procrastinate, not inline.
- [ ] Counter increments are append-event, not row-update.
- [ ] Schema migrations are additive + rolling-deploy-safe.
- [ ] Reads after writes use the leader (read-your-writes).
- [ ] Search index is treated as derived; no user-facing read
      depends on it.
- [ ] Cache invalidation is explicit, not TTL-only, on attestation
      changes.
- [ ] No N+1 queries in hot paths.
- [ ] No `FOR UPDATE` without timeout.
- [ ] Content-addressed storage uses digest as the object key.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before adding a model, sketch the access pattern (point read,
   range scan, search, analytics) and design the indexes for that
   pattern. No index without a named query.
2. For every new external call, demand an idempotency-key story.
3. For every new state transition, document the allowed predecessors
   and the rollback path.
4. For every migration that drops a column, demand a two-deploy
   rollout (deploy 1: stop writes, deploy 2: drop).
5. When proposing search or analytics changes, restate that the
   derived state can lag and verify the user-visible UX tolerates it.

## Expected Output Format

A backend feature design:

```
ACCESS PATTERN: <point read / range / search / analytics / append>
INDEX(ES):       <list>
TENANT SCOPE:    <organization_id present + RLS policy>
TXN MODEL:       <serializable / read committed / advisory lock>
SIDE EFFECTS:    <list, with idempotency key per>
RYW GUARANTEE:   <yes/no; if yes, source of read>
FAILURE MODES:   <what can fail, what user sees, recovery path>
DERIVED STATE:   <search/cache/analytics — none of which are truth>
```

## Examples

The Procrastinate-based Context CI pipeline (Phase 4) is correct
because: jobs commit transactionally to Postgres (idempotent
enqueue), each stage is a separate job with its own idempotency key,
state transitions are explicit and constrained, results are stored
before notification dispatch, and the pipeline can resume from any
intermediate state.

The content-addressed object storage is correct because: the digest is
computed at upload, the object key IS the digest, re-upload is a
no-op (same digest → same key), and verification is re-hash on read.

## References

- Martin Kleppmann — *Designing Data-Intensive Applications*
- Companion: `postgresql-production` (Postgres specifics)
- Companion: `django-ninja-production` (Django/Ninja specifics)
- Companion: `security-engineering-supplychain` (data security)
- Phase 4 pipeline design: `docs/spec.md` §5 (attestation)
