---
spec_version: "0.1"
name: valkey-caching-patterns
version: 0.1.0
type: architecture
domain: backend
author: PrimitiveHub AI (synthesized 2026-05-29 from Redis/Valkey production patterns + Next.js "use cache" doctrine)
license: CC-BY-4.0
tokens: 3400
token_budget: 5000
risk_level: low
content_digest: sha256:cac0abc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a8
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
use_when:
  - "Adding a Valkey cache layer to a Django endpoint"
  - "Designing cache invalidation for primitive versions, attestations"
  - "Using Next.js 'use cache' / cacheTag / cacheLife / updateTag"
  - "Adding HTTP Cache-Control / s-maxage to API or web responses"
  - "Designing rate limiting via Valkey"
do_not_use_when:
  - "Workloads where staleness is unacceptable (signing operations)"
  - "Frontend or design-only work"
attestation: cci-v0.1
description: "Caching patterns for Valkey + Next.js 16 'use cache' + HTTP. Cache-aside, stampede prevention, pub/sub invalidation, explicit invalidation over TTL-only, rate limiting, session storage."
keywords: [caching, valkey, redis, cache-aside, stampede, invalidation, http-cache, use-cache, next-16]
references:
  - "Valkey docs — https://valkey.io"
  - "Next.js 16 'use cache' — https://nextjs.org/docs/app/api-reference/directives/use-cache"
---

# Valkey + Next.js Caching Patterns

## Purpose

PrimitiveHub uses Valkey (Redis-compatible) as the cache + session +
rate-limit layer, plus Next.js 16's `"use cache"` directive on the
frontend. This primitive teaches the patterns: cache-aside, stampede
prevention, explicit invalidation (not TTL-only), HTTP cache headers,
and rate limiting. The trust narrative requires that a "Trusted" badge
update propagates correctly — stale caches that show old verdicts are
credibility bugs.

## Core Principles

- **Postgres is truth; cache is convenience.** Never read business
  decisions from cache without a Postgres backstop. Cache outage =
  slow, not wrong.

- **Explicit invalidation beats TTL-only.** When the underlying data
  changes (primitive version attested, deprecated, withdrawn), the
  cache entry must be invalidated immediately. TTL is the safety net,
  not the strategy.

- **Cache key includes everything that affects the response.**
  Tenant ID, language, version, role. Otherwise one user sees
  another's response.

- **Cache stampede is real.** N concurrent misses for the same key
  generate N concurrent recomputations. Use stale-while-revalidate or
  request coalescing.

- **Separate Valkey databases by purpose.** PrimitiveHub:
  - DB 0: Django cache (session, view caching)
  - DB 1: Procrastinate state (if not using Postgres for it)
  - DB 2: Rate limiting
  - DB 3: Reserved for pub/sub
  Same-DB sharing → cache eviction can wipe queued state.

## Decision Rules

### Pattern selection

- **IF a read is hot but data changes rarely THEN** cache-aside with
  explicit invalidation on write. The canonical case for PrimitiveHub.

- **IF a write touches a cached entity THEN** invalidate the cache
  key as part of the same transaction (after commit), not best-effort
  later.

- **IF concurrent requests for the same cold cache key are likely
  THEN** request coalescing: first request computes + caches; others
  wait. Implement via a short-TTL lock key or stale-while-revalidate
  pattern.

- **IF data is per-user / per-tenant THEN** cache key includes the
  tenant scope: `primitive:org:<org-uuid>:<slug>:<version>`.

- **IF data is global + invariant after publish THEN** cache key is
  content-derived: `primitive:digest:sha256:<hex>:content`. Immutable
  by definition; no invalidation needed.

### Next.js 16 `"use cache"`

- **IF a server-component fetcher is called from multiple subtrees
  THEN** wrap with `"use cache"` (or `React.cache` for per-request
  dedup). Document the cache lifetime with `cacheLife`.

- **IF cached data is tied to a specific tag THEN** call `cacheTag`
  with that tag inside the cached function. Invalidate via
  `updateTag(tag)` from a Server Action.

- **IF the cache life should differ per data class THEN** declare
  `cacheLife({ revalidate: <s>, expire: <s>, stale: <s> })`.

- **IF the request must always be fresh THEN** opt out with
  `fetch(url, { cache: 'no-store' })` — but document why.

### HTTP caching

- **IF a route handler returns the same content for the same URL +
  no auth THEN** add
  `Cache-Control: public, s-maxage=<n>, stale-while-revalidate=<m>`.

- **IF a route handler depends on auth state THEN** `Cache-Control:
  private, max-age=0, no-store` — don't cache personalized responses
  at the CDN.

- **IF a route handler returns 404 / 500 THEN** add
  `Cache-Control: no-store` to error responses. Caching errors
  amplifies outages.

### Rate limiting

- **IF an endpoint accepts user input THEN** apply rate limit.
  PrimitiveHub default: burst 60/min AND sustained 1000/day,
  evaluated separately, fail-closed on hit.

- **IF rate limiting is keyed by token THEN** also key by tenant
  for fairness across orgs.

- **IF a write endpoint is rate-limited THEN** the limit is per-user
  AND per-org. Avoids one user exhausting an org's budget.

### Sessions

- **IF sessions go in Valkey THEN** use a separate DB or key prefix
  from the cache. Otherwise cache eviction logs users out.

- **IF a session value must survive Valkey restart THEN** persist via
  Valkey AOF + RDB. Loss of sessions = loss of user trust.

### Invalidation

- **IF cached data is per-primitive-version THEN** invalidation
  happens on: attestation written, verdict changed, version
  deprecated, primitive withdrawn. Each path explicitly invalidates.

- **IF multi-key invalidation is needed THEN** use a sorted set or
  a pub/sub message. Don't iterate keys with KEYS pattern — it's
  O(N).

- **IF a TTL expires while a request is in flight THEN**
  stale-while-revalidate keeps serving the stale value briefly.
  Don't show a loading spinner if you have stale data.

## Anti-Patterns

- **Caching write paths or business decisions.** "Is this user
  allowed to delete?" never comes from cache.
- **Same Valkey DB for cache + sessions + queues + rate limit.**
  Eviction wipes other purposes.
- **TTL-only invalidation on data that changes.** Trusted-badge
  changes to "Rejected" but cache still says "Trusted" for 5
  minutes — that's a credibility bug.
- **Cache key without tenant scope on tenant-scoped data.** Leak
  data across tenants.
- **`KEYS *` in production.** Blocking iteration; can lock Valkey.
  Use `SCAN`.
- **Setting absurdly long TTLs because "the data doesn't change."**
  Immutable data should be keyed by content; mutable data needs real
  TTL + invalidation.
- **Caching personalized responses at the CDN.** Cross-user leakage.
- **No fallback if Valkey is down.** Should degrade to "slow but
  correct," not "fast and broken."

## Review Checklist

- [ ] Cache key includes tenant + relevant scope.
- [ ] Write paths explicitly invalidate cache for the touched entity.
- [ ] Reads have an explicit cache strategy
      (`use cache`, `Cache-Control`, or none — with comment).
- [ ] Errors are NOT cached at the CDN.
- [ ] Rate limit applies to all user-input endpoints.
- [ ] Sessions on a separate Valkey DB from cache.
- [ ] Valkey persistence (AOF + RDB) configured for sessions.
- [ ] Stampede prevention on hot keys: SWR or request coalescing.
- [ ] No `KEYS *`; use `SCAN` for iteration.
- [ ] Fallback path tested: Valkey down → slow-but-correct
      (Postgres reads continue).

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. For each new cached path, name the invalidation triggers.
2. For each `"use cache"`, declare `cacheLife` AND `cacheTag`.
3. For each Cache-Control header, justify the `s-maxage` and
   `stale-while-revalidate` values.
4. When proposing a TTL, ask "what changes the underlying data?" and
   wire invalidation there.
5. Surface any pattern that caches a write decision, ownership check,
   or auth result.

## Expected Output Format

For a cached endpoint:

```
KEY:               <key shape, including tenant scope>
TTL:               <seconds + reason>
INVALIDATION:      <events that explicitly invalidate>
STAMPEDE STRATEGY: <SWR / coalescing / N/A>
HTTP HEADERS:      <Cache-Control value if applicable>
FALLBACK:          <behavior when Valkey down>
```

## Examples

For the `/api/v1/primitives/<slug>/versions/<semver>` endpoint, the
cache key is `primitive:org:<org>:slug:<slug>:version:<semver>`. TTL
is 1 hour with stale-while-revalidate 5 minutes. Invalidated on
attestation publish, deprecation, withdrawal. HTTP header:
`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
since this is public-registry data.

For the homepage primitive count widget, the data is hourly-fresh;
`"use cache"` with `cacheLife({ revalidate: 3600 })` and `cacheTag
("registry:counts")`. Server Action that publishes a primitive calls
`updateTag("registry:counts")`.

## References

- Valkey docs: https://valkey.io
- Next.js 16 `"use cache"`:
  https://nextjs.org/docs/app/api-reference/directives/use-cache
- HTTP Caching: RFC 9111
- Companion: `nextjs-16-app-router` (`use cache` mechanics)
- Companion: `ddia-multi-tenant` (Postgres-as-truth principle)
