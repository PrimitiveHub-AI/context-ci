# ADR-0005: Cloudflare R2 for v1 object storage; MinIO swap-in for enterprise

**Status:** Accepted
**Date:** 2026-05-28

## Context

Primitives are content-addressed objects (key = `sha256:<hex>`).
v1 needs S3-compatible object storage that:

- Is cheap at low scale (we're pre-launch).
- Has zero egress fees (downloads are the primary traffic pattern).
- Speaks the standard S3 API so boto3 works unchanged.
- Can be swapped for an on-prem option (enterprise customers in Phase 7
  may not want their primitives stored in a third-party cloud).

## Decision

**v1 (public registry):** Cloudflare R2.
**v1 self-host option (later, Phase 7):** MinIO, swappable via env var
(`S3_ENDPOINT_URL`).

Same boto3 client, same content-addressing scheme, same object-key
format — only the endpoint changes.

## Alternatives considered

1. **AWS S3** — Industry default. Rejected because:
   - Egress fees are the dominant cost for a public registry that
     primarily serves reads. Cloudflare R2 has zero egress; AWS S3 has
     ~$0.09/GB.
   - R2's S3 compatibility is good enough for our use case (we use
     PUT, GET, HEAD, DELETE — not Glacier tiers, not Object Lambda).

2. **Google Cloud Storage** — Similar egress economics to S3 (not free).
   Rejected for cost.

3. **Backblaze B2** — Cheap, native S3 API since ~2022. Rejected
   because Cloudflare R2 has better CDN integration (free Cloudflare
   CDN in front of R2 is one click) and we'll use Cloudflare's CDN
   regardless.

4. **MinIO from day one** — Simpler "single thing", we run it ourselves.
   Rejected for v1 because:
   - We'd have to ops a stateful service with replication, backup,
     monitoring. R2 eliminates that.
   - Customer expectation: a public registry should feel like
     infrastructure, not a hosted MinIO. R2 + Cloudflare CDN is the
     production-grade story.

5. **GitHub Releases / GitHub Packages** — Free, but rate-limited and
   not S3-compatible. Rejected outright.

## Consequences

**Positive:**
- Zero egress cost. Critical because primitive reads will dominate
  traffic post-launch.
- Built-in CDN via Cloudflare. A primitive in Europe is served from a
  European edge.
- S3-compatible boto3 client; switching to MinIO for Phase 7 enterprise
  is a `S3_ENDPOINT_URL` env change.
- Bucket-scoped API tokens (`primitivehub-primitives-dev` token can't
  touch `primitivehub-primitives-prod`). Smallest blast radius if a
  key leaks.

**Negative:**
- Cloudflare lock-in to the extent we use R2-specific features
  (conditional PUT with `If-None-Match` for content-addressed
  optimization, for example). Mitigation: we already test the swap
  path with MinIO in compose (`--profile minio`).
- R2's S3 compatibility has minor gaps (e.g., no `RestoreObject`
  because R2 has no Glacier tier). We don't use the gaps.
- Pre-launch: the dev R2 bucket holds non-trivial content (primitives
  for testing). The bucket is private. A leaked token = read+write on
  dev primitives only — not prod, not other tenants.

## References

- `apps/api/storage/client.py` — boto3 R2 client.
- `apps/api/.env.example` — required R2 env vars.
- `compose.override.yaml` — `--profile minio` overlay for offline dev.
- `apps/web/content/primitives/security-engineering-supplychain.md`
  § Least-privilege access control — bucket-scoped tokens.
- `docs/bugs.md` #12 — env_file precedence gotcha discovered while
  wiring R2 credentials.
