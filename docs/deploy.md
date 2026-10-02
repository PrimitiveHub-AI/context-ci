# Deploy runbook — primitivehub.ai

> **Golden rule:** the public domain must serve the **production build**
> (`next start`), never `pnpm dev`. Dev mode needs a hot-reload WebSocket
> that Cloudflare rejects (520) → the page half-hydrates and client
> components (the Forge editor) die. This bit us: [`bugs.md` #33](./bugs.md).

## Topology

```
browser → Cloudflare (DNS 2a06:98c1::, server: cloudflare)
        → host nginx (/etc/nginx/sites-available/primitivehub, 0.0.0.0:443)
        → 127.0.0.1:3000  (primitivehub-web-1 container)
```

- **web** — Next.js. MUST be the `runner` (prod) image running `next start`.
- **api / api-worker** — Django + uvicorn / Procrastinate worker.
- **postgres / valkey / authentik / umami** — stateful, long-running.

The web container is `restart: unless-stopped`, so it survives host reboots
as whatever image it currently runs. Keep that image = prod.

## The trap we removed

A bare `docker compose up` auto-loads `compose.override.yaml` (the **dev**
overlay: `pnpm dev`, source-mounted). That is how the live domain ended up
serving dev for weeks. Two guards now prevent it:

1. **`COMPOSE_FILE` is pinned** in the host `.env`:
   ```
   COMPOSE_FILE=compose.yaml:compose.prod.yaml:compose.deploy-local.yaml
   ```
   So a bare `docker compose up -d` resolves to the **prod** overlay, not
   the dev one. (`compose.deploy-local.yaml` is host-local + gitignored.)
2. **`scripts/smoke-prod.sh`** asserts the live `/forge` ships **no**
   `webpack-hmr` (i.e. is prod, not dev) — run it after every deploy.

## Deploying

Always use the script — it never serves dev and smoke-tests the live edge:

```bash
scripts/deploy.sh              # GHCR mode: pull CI images, up prod, smoke
scripts/deploy.sh local        # use locally-built images (no registry auth)
scripts/deploy.sh local --build   # build web locally first, then deploy
```

Manual equivalent of `local` mode:
```bash
cp -r docs apps/web/docs                                   # bugs.md #25
docker compose -f compose.yaml -f compose.prod.yaml build web
rm -rf apps/web/docs
docker compose up -d                                       # .env pin → prod
scripts/smoke-prod.sh
```

## Current state (2026-07-22) — stopgap

- **web** → locally-built **prod** image (`ghcr.io/devxyzx/primitivehub-web:latest`,
  `pull_policy: never`). Editor verified through Cloudflare.
- **api / api-worker** → **dev** image (`primitivehub-api:dev`). The locally
  built prod api image is broken (`No module named uvicorn`), so it stays on
  the known-good dev image with its source mount + R2 `env_file`. Django
  `runserver` works fine behind Cloudflare (plain HTTP, no WebSocket).

## Target state — GHCR as source of truth (owner steps, HUMAN-ONLY)

`build-web.yml` + `build-api.yml` already build the `runner` target and push
to GHCR on every push to `main`. To make pushed images the source of truth:

1. **Fix the prod api image** — confirm `apps/api/Dockerfile` `runner` stage
   installs `uvicorn` (the local image predates it); a fresh CI build on
   `main` should produce a good one. Verify with
   `docker run --rm ghcr.io/…/primitivehub-api:latest python -c "import uvicorn"`.
2. **Merge the release branch to `main`** (needs owner OK — no auto-merge) so
   CI publishes fresh web+api images with the editor fix + branding.
3. **One-time on the host:** `docker login ghcr.io -u <user>` (PAT with
   `read:packages`). Check: `grep ghcr.io ~/.docker/config.json`.
4. **Cut over:** `scripts/deploy.sh` (GHCR mode), then repoint the pin:
   ```
   COMPOSE_FILE=compose.yaml:compose.prod.yaml     # drop compose.deploy-local.yaml
   ```
   and delete `compose.deploy-local.yaml`. Now the whole stack runs CI-built
   images and a bare `up` pulls the published prod build.

## After any deploy

```bash
scripts/smoke-prod.sh            # routes 200 + prod-mode assertion
scripts/smoke-prod.sh --browser  # + headless: Forge editor mounts & types
```
Both must pass before you walk away. A dev regression shows as
`/forge is serving the DEV build (webpack-hmr present)`.
