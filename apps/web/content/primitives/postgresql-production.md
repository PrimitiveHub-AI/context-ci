---
spec_version: "0.1"
name: postgresql-production
version: 0.2.0
type: architecture
domain: backend
author: PrimitiveHub Labs (synthesized 2026-05-29 from PG 16+ production knowledge; v0.2.0 adds fillfactor/HOT updates, lateral joins for top-N, SKIP LOCKED for queues, pg_repack vs VACUUM FULL, EXISTS over COUNT)
license: CC-BY-4.0
tokens: 4200
token_budget: 5500
risk_level: low
content_digest: sha256:9c6cabc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a5
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
use_when:
  - "Designing or modifying Postgres schemas in apps/api/"
  - "Writing or reviewing SQL migrations"
  - "Diagnosing slow queries via EXPLAIN ANALYZE"
  - "Tuning Postgres config for the api container"
  - "Designing indexes for new query patterns"
  - "Planning zero-downtime schema changes"
do_not_use_when:
  - "Non-Postgres databases (sqlite tests, MySQL, NoSQL)"
  - "Frontend or pure design work"
attestation: cci-v0.1
description: "Postgres 17 production knowledge — index strategy, EXPLAIN reading, VACUUM, zero-downtime migrations, monitoring queries, gotchas, pgBouncer. Calibrated to PrimitiveHub's apps/api on Hetzner CX22+."
keywords: [postgresql, postgres, indexes, explain-analyze, vacuum, zero-downtime-migration, pgbouncer]
references:
  - "PostgreSQL 17 official docs"
  - "Use the Index, Luke — Markus Winand"
---

# PostgreSQL Production

## Purpose

Deep Postgres knowledge for PrimitiveHub's `apps/api` backend. Covers
gotchas that bite at scale, index strategy, EXPLAIN reading, VACUUM
discipline, zero-downtime migration patterns, monitoring queries, and
pgBouncer when needed. Calibrated to our deployment: Postgres 17 on
Hetzner CX22 (8GB RAM, single instance in v1, two-instance with
streaming replica when scale warrants).

## Core Principles

- **Postgres is the source of truth.** Other surfaces (Valkey cache,
  search index, R2 storage) are derived. They can be rebuilt; Postgres
  cannot.
- **Indexes serve queries, not models.** Every index has a named
  query it serves. No "just in case" indexes.
- **MVCC has a cost.** Every UPDATE/DELETE leaves dead tuples; VACUUM
  cleans them. Design schemas that minimize hot-row churn.
- **Schema changes are rolling.** New code and old code coexist
  mid-deploy. Additive migrations only.
- **Statement and lock timeouts are non-negotiable.** Runaway queries
  must die.

## Critical Gotchas (burn these in)

- **FK columns are NOT auto-indexed.** Django creates FKs but
  inconsistently indexes them. Verify after every migration.
- **UNIQUE allows multiple NULLs by default.** Use `NULLS NOT
  DISTINCT` (PG 15+) to restrict.
- **No clustered PK.** Heap storage; row order is insertion order.
- **Volatile defaults cause table rewrites.** `ADD COLUMN … DEFAULT
  now()` rewrites the table. Non-volatile defaults are instant.
- **Sequences have gaps.** Normal. Don't try to consecutive them.
- **CTE optimization fences.** PG 12+ supports `MATERIALIZED` /
  `NOT MATERIALIZED` to control. Without hints, behavior varies.
- **Type mismatches kill indexes.** `WHERE id = '123'` (string) on
  integer column does seq scan.
- **Function on indexed column kills index.** `WHERE UPPER(email) =
  'X'` requires expression index.

## Data Type Contract

| Purpose | Use | Don't use |
|---|---|---|
| Timestamps | `TIMESTAMPTZ` | `TIMESTAMP` (no tz), `TIMETZ` |
| Strings | `TEXT` | `CHAR(n)` / `VARCHAR(n)` (unless real length cap) |
| Money | `NUMERIC(p, s)` | `FLOAT` / `DOUBLE` / `MONEY` |
| IDs | `BIGINT GENERATED ALWAYS AS IDENTITY` | `SERIAL` |
| UUIDs | `UUID` via `gen_random_uuid()` | TEXT containing UUID |
| Booleans | `BOOLEAN NOT NULL` | Nullable booleans (use enum) |
| JSON | `JSONB` | `JSON` |

## Index Strategy

### Index type by query pattern

| Query | Index |
|---|---|
| `=`, `<`, `>`, `BETWEEN`, `ORDER BY` | B-tree (default) |
| JSONB containment `@>`, key existence `?` | GIN |
| Array containment `@>`, overlap `&&` | GIN |
| Full-text search `@@` | GIN |
| Ranges, geometry, exclusion constraints | GiST |
| Time-series append-only | BRIN |

### Advanced patterns

- **Composite**: equality first, range/sort last. `(status,
  created_at)` for `WHERE status='active' ORDER BY created_at`.
- **Partial**: `CREATE INDEX ON tbl (col) WHERE status='active'`.
  Smaller, faster, only indexes hot subset.
- **Expression**: `CREATE INDEX ON tbl (LOWER(email))`. Must match
  exactly in WHERE.
- **Covering**: `CREATE INDEX ON tbl (id) INCLUDE (name, email)`.
  Enables index-only scan.
- **`CREATE INDEX CONCURRENTLY`** in production. Avoids table lock.
- **GIN `jsonb_path_ops`**: smaller + faster than default GIN for
  containment-only (`@>`) queries; loses key-existence (`?`) support.
- **BRIN**: tiny index for append-only time-series where on-disk order
  correlates with the indexed column. Useful for audit logs;
  irrelevant for the registry tables.

### Update-heavy table tuning

- **`fillfactor = 90` for hot tables.** Leaves room for HOT (Heap-Only
  Tuple) updates — Postgres can update a row in-place without index
  maintenance if (a) no indexed column changed AND (b) the new tuple
  fits on the same page. Set per table: `ALTER TABLE tbl SET (fillfactor
  = 90)`. Reduces bloat for update-heavy workloads.
- **Avoid updating indexed columns** — kills HOT.
- **Wide-row hot column split**: if a row has a frequently-updated
  field alongside many static fields, consider splitting (sometimes
  worth a separate table keyed by the same id) to minimize the bloat
  surface.

## Decision Rules

- **IF a new query pattern is introduced THEN** name the query and
  design the index that serves it.
- **IF an EXPLAIN shows Seq Scan on a large table THEN** consider an
  index. If it shows "Filter removing 99%" → index that filter.
- **IF estimated rows differ from actual by >10× THEN** run
  `ANALYZE` to refresh statistics.
- **IF a migration adds a column with `DEFAULT now()` THEN**
  split: ADD COLUMN, backfill in batches, then SET DEFAULT.
- **IF a migration ADDs NOT NULL to existing column THEN** use the
  NOT VALID → backfill → VALIDATE → SET NOT NULL pattern (see below).
- **IF a query is paginated with OFFSET THEN** switch to cursor-based
  (`WHERE id > $last_id`). OFFSET scans and discards.
- **IF a task-queue table is involved THEN** use `SELECT … FOR UPDATE
  SKIP LOCKED`. Procrastinate does this; custom code must too.
- **IF rate of UPDATEs to a hot row is high THEN** redesign as
  append-only events + periodic aggregate. Hot-row contention kills
  throughput.
- **IF the index list grows past N THEN** find unused indexes (see
  monitoring queries) and drop them. Each index taxes writes.
- **IF connection count approaches `max_connections` THEN** add
  pgBouncer in transaction mode.

## Zero-Downtime Migrations

### Adding NOT NULL to existing column

```sql
-- Step 1: NOT VALID constraint (instant, no scan)
ALTER TABLE tbl ADD CONSTRAINT col_not_null CHECK (col IS NOT NULL) NOT VALID;

-- Step 2: Backfill (batched if large; see batched-updates below)
UPDATE tbl SET col = '<default>' WHERE col IS NULL;

-- Step 3: Validate (scans, but doesn't block writes)
ALTER TABLE tbl VALIDATE CONSTRAINT col_not_null;

-- Step 4: SET NOT NULL (now instant — already validated)
ALTER TABLE tbl ALTER COLUMN col SET NOT NULL;

-- Step 5: Drop CHECK (redundant)
ALTER TABLE tbl DROP CONSTRAINT col_not_null;
```

### Batched updates for large tables

```sql
DO $$
DECLARE batch_size INT := 10000; updated INT;
BEGIN
  LOOP
    UPDATE tbl SET col = $value
    WHERE id IN (SELECT id FROM tbl WHERE col IS NULL LIMIT batch_size);
    GET DIAGNOSTICS updated = ROW_COUNT;
    EXIT WHEN updated = 0;
    PERFORM pg_sleep(0.1);  -- Breathe between batches
  END LOOP;
END $$;
```

### Safe index creation

- `CREATE INDEX CONCURRENTLY` — no table lock, allows reads/writes.
- Monitor via `pg_stat_progress_create_index`.
- On failure, leaves INVALID index. Find + drop, then retry.

## Bloat removal — pg_repack over VACUUM FULL

- **`VACUUM`** (regular) reclaims space FOR REUSE inside the table.
  Non-blocking. Run regularly via autovacuum.
- **`VACUUM FULL`** rewrites the table to release space TO THE OS. Takes
  an `ACCESS EXCLUSIVE` lock — blocks all reads + writes. **Avoid in
  production.**
- **`pg_repack`** (extension) does what VACUUM FULL does but without the
  table lock — creates a shadow table, copies live rows, swaps. Online,
  safe. Install when a tenant-scoped table accumulates significant bloat
  and we need to release space.
- **`REINDEX CONCURRENTLY`** (PG12+) rebuilds bloated indexes online.

For PrimitiveHub: VACUUM via autovacuum is sufficient at current scale.
Plan to install `pg_repack` when `pg_stat_user_tables.n_dead_tup` shows
sustained high dead-tuple ratios on the larger tables.

## VACUUM Discipline

- Regular VACUUM is **non-blocking**.
- `VACUUM FULL` **locks the table** — never run in production. Use
  `pg_repack` for online bloat removal.
- Autovacuum is on by default but can be too lazy for high-churn
  tables. Tune per-table:
  ```sql
  ALTER TABLE high_churn_table SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02
  );
  ```
- `REINDEX CONCURRENTLY` (PG 12+) rebuilds bloated indexes without
  lock.

## Configuration for PrimitiveHub

For Postgres 17 on Hetzner CX22 (8 GB RAM, dedicated PG container with
2 GB allocated):

```
shared_buffers = 512MB              # 25% of container memory
effective_cache_size = 1536MB       # 75% of container memory
work_mem = 8MB                      # Per sort/hash
maintenance_work_mem = 256MB
random_page_cost = 1.1              # SSD
effective_io_concurrency = 200      # SSD
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Timeouts (non-negotiable)
statement_timeout = '30s'
lock_timeout = '10s'
idle_in_transaction_session_timeout = '60s'
```

## Query Patterns

### Cursor pagination (not OFFSET)
```sql
-- BAD — scans + discards rows
SELECT * FROM tbl ORDER BY id OFFSET 10000 LIMIT 20;

-- GOOD — constant-time per page
SELECT * FROM tbl WHERE id > $last_id ORDER BY id LIMIT 20;
```
PrimitiveHub's `primitivehub_api/pagination.py` implements this over
`(created_at, id)`.

### EXISTS over COUNT
```sql
-- BAD — counts every matching row to ask "any?"
SELECT * FROM users WHERE (SELECT COUNT(*) FROM orders WHERE user_id = users.id) > 0;

-- GOOD — short-circuits on first match
SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE user_id = users.id);
```

### Approximate counts for large tables
```sql
SELECT reltuples::bigint FROM pg_class WHERE relname = 'tablename';
```
For "total rows in this table" displays where exact count is too
expensive.

### `SELECT ... FOR UPDATE SKIP LOCKED` for task queues
```sql
SELECT * FROM jobs WHERE status = 'pending'
ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 10;
```
Multiple workers can claim jobs concurrently without lock contention.
Procrastinate uses this pattern internally — relevant when reading its
internals or building a custom queue.

### Lateral joins (top-N per group)
```sql
-- "Most recent 3 versions per primitive"
SELECT p.slug, v.semver, v.submitted_at
FROM registry_primitive p
CROSS JOIN LATERAL (
    SELECT semver, submitted_at FROM registry_primitive_version
    WHERE primitive_id = p.id ORDER BY submitted_at DESC LIMIT 3
) v;
```
Avoids GROUP BY + window-function complexity. Performant when paired
with an index on `(primitive_id, submitted_at DESC)`.

## Monitoring Queries

```sql
-- Cache hit ratio (target >99%)
SELECT round(100.0 * sum(blks_hit) / sum(blks_hit + blks_read), 2) AS ratio
FROM pg_stat_database WHERE datname = current_database();

-- Slow queries (pg_stat_statements required)
SELECT query, calls, round(mean_exec_time::numeric, 2) AS avg_ms,
       round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;

-- Long-running queries
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '30 seconds';

-- Dead tuple ratio
SELECT relname, n_dead_tup, n_live_tup,
       round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 100 ORDER BY n_dead_tup DESC;

-- Unused indexes
SELECT schemaname, tablename, indexname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Blocking queries
SELECT blocked.pid AS blocked_pid, blocked.query AS blocked_query,
       blocking.pid AS blocking_pid, blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid));
```

## Anti-Patterns

- `VACUUM FULL` in production.
- `OFFSET` for large pagination.
- `SELECT * FROM …` (always list columns; lets PG use index-only
  scans).
- `COUNT(*) > 0` instead of `EXISTS`.
- Implicit type casts (`WHERE id = '5'` on integer).
- Functions on indexed columns without expression index.
- One global queue table for all jobs (head-of-line blocking).
- `idx_scan = 0` indexes that survive multiple weeks.
- Direct production mutations without dry-run.

## Review Checklist

- [ ] Every new index serves a named query.
- [ ] FK columns are explicitly indexed.
- [ ] Migrations are additive (no destructive changes mid-deploy).
- [ ] Adding columns with volatile defaults uses ADD/backfill/SET split.
- [ ] NOT NULL adds use NOT VALID → backfill → VALIDATE → SET pattern.
- [ ] `CREATE INDEX CONCURRENTLY` for any non-tiny table.
- [ ] Statement + lock timeouts set.
- [ ] No N+1 from the ORM layer.
- [ ] Cursor-based pagination on user-facing lists.
- [ ] `pg_stat_statements` enabled in production.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before adding an index, name the query it serves and EXPLAIN it.
2. Before merging a migration, simulate it on a staging copy and
   measure the duration.
3. For any new high-churn table, set per-table autovacuum parameters
   explicitly in the migration.
4. For any new endpoint, sketch the queries it generates and verify
   they're index-served via EXPLAIN.
5. Recommend `pg_repack` over `VACUUM FULL` whenever bloat removal
   comes up.

## References

- PostgreSQL 17 official docs
- Markus Winand — *Use the Index, Luke*
- Companion: `ddia-multi-tenant` (architecture)
- Companion: `django-ninja-production` (ORM specifics)
