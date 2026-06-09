# ADR-0044: `/check` runs its scan off the request path (enqueue + poll)

**Status:** Proposed
**Date:** 2026-06-09
**Amends:** ADR-0034 (public `/check` lookup surface). The input
contract (`mode`/`input`), the per-IP rate limits, the SSRF/tarball
hard caps, and the "input bytes are never persisted to Postgres"
privacy promise are all **unchanged**. What changes is *where the scan
runs* and the *HTTP shape*: the POST now enqueues and returns `202 +
requestId`; a new `GET /api/v1/check/{requestId}` polls for the verdict.
**Related:** ADR-0004 (Procrastinate jobs), ADR-0041 (verdict engine —
the result shape this returns), [`docs/bugs.md`](../bugs.md) § 23.

## Context

`/check` is the public, anonymous, zero-install surface — the surface
most exposed to launch traffic. As shipped under ADR-0034 the entire
scan ran **inside the web request**:

- The view is synchronous and does blocking outbound I/O — npm/GitHub
  tarball fetch (GitHub tries `main` then `master`, 30 s each = up to
  60 s), the URL fetch (10 s), plus decompression + untar (30 s budget)
  + running the Top 10 over every text file (GitHub: up to 20,000 files
  / 256 MiB uncompressed).
- It is served by a **single uvicorn process with no `--workers`**.
  Under Django ASGI, sync views run in `sync_to_async(thread_sensitive=
  True)` — a single shared executor thread. So `/check` effectively
  serializes: one slow scan blocks **every** other request in the
  process, including `GET /healthz`.
- The container healthcheck probes `/healthz` every 10 s (5 s timeout,
  5 retries). A single in-flight GitHub scan starves the probe → the
  container is marked unhealthy and flaps **mid-scan**, taking the whole
  API down — not just `/check`.

The per-IP rate limit (30/5min, 500/24h) bounds *requests per client*
but places **no ceiling on global concurrency or total work**: launch
traffic from many IPs — or one IP firing 30 GitHub scans = ~30 min of
queued work — saturates the single thread. This is the "overloaded →
service down" failure mode. (Full audit: `docs/bugs.md` § 23.)

## Decision

Move the scan off the web request path onto the existing Procrastinate
worker. The web tier only enqueues and reads a cached result.

1. **`POST /api/v1/check`** — rate-limit (unchanged) → sniff mode →
   stash the input in Valkey → seed a `pending` poll record → defer the
   `primitivehub.run_check` task → return **`202 { requestId, status:
   "pending", mode }`**. The web process does no fetching or scanning.

2. **`GET /api/v1/check/{requestId}`** — a cheap cache read (not
   rate-limited). Returns `200 { status: "pending" }`, `200 { status:
   "done", result }` (the full ADR-0041 response shape), `200 { status:
   "error", error }` (handled policy/resolution failures surface here,
   not as a POST 4xx), or `404` for an unknown/expired id.

3. **Dedicated `checks` queue, bounded concurrency.** `run_check` runs
   on a `checks` queue; the `api-worker` drains `--queues=default,checks`
   with `--concurrency=${CHECK_WORKER_CONCURRENCY:-2}`. Concurrency is
   the **hard ceiling on parallel scans** — a flood queues up instead of
   fanning out and exhausting the box.

4. **Input handoff via Valkey, never Postgres.** The raw input is
   stashed under `phub-check:input:{id}` (10-min TTL) and **scrubbed by
   the worker the instant the scan finishes** (`pop_input` reads-then-
   deletes). It is deliberately *not* passed through the Procrastinate
   job args, which would persist it in `procrastinate_jobs` (Postgres,
   the durable truth DB). The verdict result lives under
   `phub-check:status:{id}` with a 1-hour TTL. This preserves ADR-0034
   § 5: the durable DB never sees user-submitted content.

## Consequences

- **A single slow scan can no longer take down the API.** Worst case is
  a queue backlog on the worker; the web tier and `/healthz` stay
  responsive. Worker concurrency, not request arrival, sets the load.
- **Frontend now polls.** `/check` shows a "scanning…" state and polls
  with backoff (150 s ceiling) until a terminal record. One contract for
  all modes — content pastes complete on the first poll (LISTEN/NOTIFY
  pickup is near-instant).
- **The async layer is the only new contract.** The verdict result shape
  (ADR-0041) is unchanged; consumers of a completed result see exactly
  what they saw before.

## Out of scope (follow-ups, see `docs/bugs.md` § 23)

This ADR closes the P0 availability risk only. Deferred:

- **Result caching** by resolved coordinate / tarball digest — popular
  packages are still re-fetched + re-scanned per request.
- **Resource limits** (`mem_limit`/`cpus`) on `api` + `api-worker`, and
  Valkey `maxmemory` + eviction policy — currently unbounded.
- **A dedicated worker container** for `checks` (full isolation from the
  signing queue) — today they share one worker's concurrency pool.
- **SSRF DNS-rebinding gap** in `url` mode (resolve-then-connect TOCTOU).
- The **verdict-engine band calibration** surfaced while wiring this up:
  a textbook prompt injection currently scores `verdictBand: "clean"`.
  That belongs to ADR-0041, not here.
