---
name: project-deploy-topology
description: How primitivehub.ai is served — PROD build behind Cloudflare+nginx; deploy via scripts/deploy.sh, NOT by editing the working tree
metadata: 
  node_type: memory
  type: project
  originSessionId: dfe323a7-eeeb-4596-b280-885eae256b39
---

**`127.0.0.1:3000` IS production, but it now runs the PROD build, not
`pnpm dev`.** Path: browser → **Cloudflare** (DNS `2a06:98c1::`, `server:
cloudflare`) → host nginx (`/etc/nginx/sites-available/primitivehub`,
`0.0.0.0:443`) → `127.0.0.1:3000` = `primitivehub-web-1` running the
`runner` image (`next start`). `analytics.primitivehub.ai` → `127.0.0.1:3001`
(Umami), unrelated.

**CHANGED 2026-07-22 (supersedes the old "edit tree = instant deploy" model).**
The site went public **behind Cloudflare**. Serving `pnpm dev` there breaks:
Next's HMR WebSocket (`wss://…/_next/webpack-hmr`) fails the Cloudflare
handshake (520), so the page half-hydrates and client components (the Forge
CodeMirror editor) never mount — dead on the domain, fine on localhost.
Full diagnosis: [[project-primitivehub]] / `docs/bugs.md` #33. So the web
container was flipped to the production build. **Editing `apps/web/` no longer
hot-reloads to production** — there is now a real build+deploy step.

**How to apply:**
- **Deploy via `scripts/deploy.sh`** (`local` mode today: locally-built prod
  web image + `pull_policy: never`; `ghcr` mode after the owner does
  `docker login ghcr.io` + merges to `main`). Runbook: `docs/deploy.md`.
- **Never run a bare `docker compose up` expecting it to be safe** — it used
  to load the dev overlay. Guard in place: host `.env` pins
  `COMPOSE_FILE=compose.yaml:compose.prod.yaml:compose.deploy-local.yaml`, so
  a bare `up` resolves to **prod**. `compose.deploy-local.yaml` is gitignored
  and host-local.
- **api/api-worker still run the `primitivehub-api:dev` image** (Django
  `runserver`) — the locally-built prod api image is broken (`No module named
  uvicorn`). `runserver` behind Cloudflare is fine (plain HTTP, no WebSocket).
  Fix the prod api image before the GHCR cutover.
- **After any deploy run `scripts/smoke-prod.sh`** — it hits the live domain
  through Cloudflare and fails if `/forge` ships `webpack-hmr` (= dev leaked to
  prod) or any key route ≠ 200. `--browser` also checks the editor mounts.
- To preview a change privately: throwaway `next dev` on another loopback port
  (e.g. `127.0.0.1:3005`) from a `scripts/session-worktree.sh` worktree — off
  nginx, so private. Confirm `free -h` first ([[feedback-containerize]]).
- Irreversible go-public flips (DNS/noindex/repo/npm) stay human-only
  ([[project-launch-posture]]).
