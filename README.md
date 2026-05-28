# PrimitiveHub

The trusted registry for AI Context Primitives. A CyberOrca Labs initiative.

> PrimitiveHub treats agent context as supply-chain material, not disposable prompt text.

## Status

- **Phase 1 (done)** — Clean architecture, content-digest cryptographic vocabulary, runtime data invariant guards.
- **Phase 2 (in progress)** — Server-split detail page, demo-data honesty labels, real Markdown content per primitive, lifecycle, registry table view.
- **Phase 3+** — Real backend (Django + Ninja + Postgres + Procrastinate + Cloudflare R2 + Authentik + Sigstore). See `docs/architecture.md` (incoming).

## Local development

Everything runs in containers. Docker is the only host requirement.

```bash
# Start the dev stack
docker compose up

# Once running:
#   web:    http://localhost:3000
#   health: http://localhost:3000/api/health
```

The web container hot-reloads from the bind-mounted source. Edits to `.tsx`/`.ts` files apply within ~1 second.

### Useful commands

```bash
# Run any pnpm script inside the container
docker compose run --rm web pnpm check:data
docker compose run --rm web pnpm typecheck
docker compose run --rm web pnpm build

# Rebuild the image after changing package.json or the Dockerfile
docker compose build web

# Stop everything
docker compose down

# Stop and wipe anonymous volumes (node_modules, .next) — useful after switching branches
docker compose down -v
```

## Production deployment

The CI pipeline (`.github/workflows/build-web.yml`) builds and pushes the image
to `ghcr.io/devxyzx/primitivehub-web` on every merge to `main`. Production pulls and runs:

```bash
docker compose -f compose.yaml -f compose.prod.yaml pull
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

`compose.prod.yaml` adds resource limits, log rotation, and `pull_policy: always`.

## Repository layout

```
app/                    Next.js 16 App Router pages + API routes
  api/health/           Health endpoint used by the container healthcheck
components/             React components (ui + landing + primitives)
hooks/                  Custom React hooks
lib/
  data/                 Mock data, per resource (replaced by backend in Phase 3)
  types.ts              Shared TypeScript types
  utils.ts              cn() helper
public/                 Static assets
scripts/check-data.mjs  Runtime data integrity guard — pnpm check:data

Dockerfile              Multi-stage: deps → builder → runner (prod) + dev
compose.yaml            Base Compose config (image, ports, networks)
compose.override.yaml   Dev overlay (auto-loaded by `docker compose up`)
compose.prod.yaml       Prod overlay (loaded explicitly)
.github/workflows/      CI pipelines
```

## License

Private. Copyright (c) 2026 CyberOrca Labs.
