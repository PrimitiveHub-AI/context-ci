# ADR-0046: Self-hosted analytics (Umami), and no HTML caching layer (Varnish)

**Status:** Accepted
**Date:** 2026-07-21
**Related:** ADR-0005 (Cloudflare R2 — the only Cloudflare surface today),
Hard rule #3 (localhost-only dev binding), Hard rule #4 (no fake numbers),
[`docs/bugs.md`](../bugs.md) § "before adding nginx/traefik/caddy/…"
(host-network preflight), [`docs/roadmap.md`](../roadmap.md) Phase 8
(observability + analytics).

This ADR records two decisions taken together in one pre-launch pass:
adopt **Umami** for web analytics (replacing a mismatched dependency), and
**reject Varnish** (and any dedicated HTML cache layer) for now.

## Context

Two supporting libraries were on the table for the website: **Umami**
(traffic analytics) and **Varnish** (HTML caching). Before adding either,
we mapped what already exists:

- **Reverse proxy:** [`deploy/caddy/Caddyfile`](../../deploy/caddy/Caddyfile)
  already terminates TLS and does zstd+gzip compression. Caddy proxies to
  the `web` container; Cloudflare is used **only** for R2 object storage
  (ADR-0005), not as an edge/CDN for the site.
- **Rendering:** [`apps/web/next.config.mjs`](../../apps/web/next.config.mjs)
  uses `output: standalone`. Every dynamic route (`/primitive/[slug]`,
  `/docs/[slug]`, …) is `generateStaticParams()`-built from the ~20
  markdown files at compile time. The site is served as pre-rendered HTML.
- **Analytics, as-shipped:** `apps/web/app/layout.tsx` rendered
  `<Analytics/>` from `@vercel/analytics` in production. But we deploy on
  **Hetzner + Caddy, not Vercel** — off-Vercel that component collects
  nothing into any dashboard we own; it only loads a **third-party beacon
  to Vercel**. A privacy cost (against our self-host posture: Authentik,
  R2, everything containerized) with zero data return.

## Decision

### 1. Adopt Umami; remove `@vercel/analytics`

Umami is self-hosted, privacy-first, containerized, and **Postgres-backed**
— it reuses the Postgres 17 instance we already run (one more DB, not new
infra). It replaces `@vercel/analytics`, which is removed from
`package.json` and the lockfile.

- **Service:** `umami` in `compose.yaml`, image pinned to
  `ghcr.io/umami-software/umami:3.2.0` (v3 unified image; Postgres inferred
  from `DATABASE_URL`). `DISABLE_TELEMETRY=1` — we don't phone home.
- **Profile-gated** (`profiles: [analytics]`), mirroring the `minio`
  opt-in, so a plain `docker compose up` dev loop stays lean on the 8GB
  host. Enable with `--profile analytics` (dev) or
  `COMPOSE_PROFILES=analytics` (prod). Prod cap: 384m / 0.5 cpu
  (`compose.prod.yaml`).
- **Localhost-bound** (`127.0.0.1:${UMAMI_PORT:-3001}:3000`) — Hard rule #3.
- **Database:** its own `umami` DB, added to `POSTGRES_MULTIPLE_DATABASES`.
- **Tracking wire-up:** a first-party [`components/analytics.tsx`](../../apps/web/components/analytics.tsx)
  server component reads **build-time** `NEXT_PUBLIC_UMAMI_SRC` +
  `NEXT_PUBLIC_UMAMI_WEBSITE_ID`. Build-time (not runtime) is forced by the
  SSG: the root layout is statically rendered for content pages, so a
  runtime `process.env` read would never reach the baked HTML. Both values
  are public (a website id is not a secret). **Empty by default → the
  component renders nothing → no script, no beacon.** Wired through the
  Dockerfile builder `ARG`s, `compose.yaml` `web.build.args`, and
  `build-web.yml` (`vars.NEXT_PUBLIC_UMAMI_*`, empty until launch). The
  canonical value is `NEXT_PUBLIC_UMAMI_SRC=https://analytics.primitivehub.ai`.

The script only ever loads in a build made explicitly with those two
values — i.e. the **owner-triggered launch build**. This matches the
launch-posture doctrine: analytics is off until the owner flips it, and
every current dev/CI image ships beacon-free (satisfies Hard rule #4 — we
report no numbers we can't stand behind, and none at all pre-launch).

- **Public host — `analytics.primitivehub.ai` via host nginx + Cloudflare
  proxied DNS, NOT Caddy and NOT a tunnel.** The owner's edge is the host
  nginx already running on this box. A vhost
  ([`deploy/nginx/analytics.primitivehub.ai.conf`](../../deploy/nginx/analytics.primitivehub.ai.conf))
  answers for the subdomain and `proxy_pass`es to `127.0.0.1:${UMAMI_PORT:-3001}`;
  Cloudflare fronts it with a **proxied** (orange-cloud) DNS record `A
  analytics → 178.105.164.250`, terminating TLS at the edge (SSL/TLS mode
  Full-strict; the origin vhost carries a Let's Encrypt cert for the
  subdomain). Umami itself stays `127.0.0.1`-bound — only nginx faces the
  public interface, exactly as the owner runs the rest of the site.
  **Posture note:** this deliberately uses the public interface (nginx on
  `0.0.0.0:443`), which is the owner's chosen launch edge — distinct from the
  bug § 26 *accident* (unintended nginx + stale `0.0.0.0` container binds
  while the rule still claimed localhost-only). The irreversible external
  flips — creating the subdomain DNS record and the origin TLS cert — are
  **owner-only** (Hard rule #5). The assistant ships the vhost file and the
  build wiring; it does not create DNS records or run certbot.

### 2. Reject Varnish (and any dedicated HTML cache layer) — for now

The site does not have the profile that justifies an HTTP cache tier:

- A reverse proxy already exists (Caddy), already compressing. Varnish
  would be a **second** proxy hop behind Caddy, in front of Next.
- The content is **pre-rendered at build** — Next's standalone server is
  already serving static HTML. There is almost nothing for Varnish to
  accelerate.
- Pre-launch traffic is ~zero (noindex, not announced). Varnish earns its
  keep with *expensive dynamic* HTML at real scale — not this profile.
- It trips the `docs/bugs.md` host-network preflight and eats memory on the
  CX22 for no measurable win.

**If HTML edge-caching is ever needed**, the sanctioned cheap paths — in
order — are: (a) Caddy's own response cache, (b) flip Cloudflare to proxy
mode (orange cloud) at the edge. Both are free and neither is a new
service. Revisit only when measured traffic + render cost demand it; record
the revisit as an amendment here, don't silently add a proxy.

## Migration (existing Postgres cluster)

`infra/postgres/init-multi-db.sh` creates the `umami` DB — but only on a
**fresh** cluster. On an already-initialized cluster, create it once by
hand before first `umami` boot:

```bash
docker compose exec postgres \
  psql -U primitivehub -d primitivehub \
  -c 'CREATE DATABASE umami OWNER primitivehub;'
```

Umami runs its own schema migrations on first boot.

## Launch runbook (owner-triggered)

1. Set `UMAMI_APP_SECRET` (`openssl rand -hex 32`) in `.env` and, in prod,
   `COMPOSE_PROFILES=analytics` (add `,tunnel` once the token is set).
2. `docker compose --profile analytics up -d umami`; open the dashboard at
   `http://127.0.0.1:${UMAMI_PORT:-3001}`, **change the default admin
   password** (`admin`/`umami`), and **create a website** for
   `primitivehub.ai` to obtain its id (UUID).
3. **Expose via host nginx + Cloudflare proxied DNS (not Caddy, not a
   tunnel):** install the vhost
   `deploy/nginx/analytics.primitivehub.ai.conf` (proxies to
   `127.0.0.1:${UMAMI_PORT:-3001}`), issue a cert
   (`certbot --nginx -d analytics.primitivehub.ai`), `nginx -t && reload`.
   In Cloudflare add `A analytics → 178.105.164.250` (**Proxied**), SSL/TLS
   mode Full-strict.
4. Set the two **public** build vars — repo `vars.NEXT_PUBLIC_UMAMI_SRC` =
   `https://analytics.primitivehub.ai` and `vars.NEXT_PUBLIC_UMAMI_WEBSITE_ID`
   = the id — and rebuild the web image (`gh variable set …`). The
   `<Analytics/>` script now loads first-party. This is the only step that
   makes the site emit a beacon.

## Consequences

- **Good:** first-party, privacy-respecting analytics on our own infra;
  no third-party beacon; no new proxy tier; reuses Postgres; off-by-default
  so pre-launch posture is intact; one profile flip to enable.
- **Cost:** one more container + DB when the profile is on (~384m). The
  launch analytics id must be baked at build (documented above) — changing
  it means a rebuild, acceptable for a stable per-deploy constant.
- **Follow-ups:** digest-pin the `umami` image in the next hardening pass
  (consistent with the web Dockerfile's stated deferral); keep the
  `analytics` nginx vhost's Let's Encrypt cert renewing alongside the main
  site's.
