# PrimitiveHub

The trusted registry for AI Context Primitives. A CyberOrca Labs initiative.

> PrimitiveHub treats agent context as supply-chain material, not disposable prompt text.

[![scanner-bench](https://github.com/DevXYZx/primitivehub/actions/workflows/scanner-bench.yml/badge.svg)](https://github.com/DevXYZx/primitivehub/actions/workflows/scanner-bench.yml)
&nbsp;
[Evaluation scoreboard](docs/evaluation.md) ·
[Adversarial corpus](docs/corpus-v0.1.md) ·
[Security policy](SECURITY.md)

## Status

- **Phase 1 (done)** — Clean architecture, content-digest cryptographic vocabulary, runtime data invariant guards.
- **Phase 2 (done)** — Server-split detail page, demo-data honesty labels, real Markdown content per primitive, lifecycle visualization, registry table view, Workbench CodeMirror upgrade with live spec validation, narrative sections (Why / Lifecycle / Governance / CLI Roadmap), expert primitives + DESIGN.md + CLAUDE.md enforcement.
- **Phase 3+** — Real backend (Django + Ninja + Postgres + Procrastinate + Cloudflare R2 + Authentik + Sigstore). See `docs/architecture.md` (incoming).

## Repository layout

This is a monorepo. Each app or service lives under `apps/`.

```
.
├── CLAUDE.md              project guidance for Claude sessions
├── DESIGN.md              unified design doctrine
├── README.md              this file
├── apps/
│   └── web/               Next.js 16 frontend
├── compose.yaml           base compose (orchestrates all services)
├── compose.override.yaml  dev overlay (auto-loaded)
├── compose.prod.yaml      prod overlay
├── docs/
│   ├── README.md          doc index
│   ├── spec.md            Primitive Spec v0.1
│   └── threat-model.md    10 supply-chain attack categories
└── .github/workflows/     CI (paths-filtered by service)
```

`apps/api/` lands when the Django backend ships in Phase 3.

## Local development

Everything runs in containers. Docker is the only host requirement.

```bash
# Start the dev stack
docker compose up

# Once running:
#   web:    http://localhost:3000
#   health: http://localhost:3000/api/health
```

The web container hot-reloads from the bind-mounted source (`apps/web/`). Edits to `.tsx`/`.ts` files apply within ~1 second.

### Without Docker (host-only)

If you prefer running the Next.js dev server directly on the host (Node 24 + pnpm required):

```bash
cd apps/web
pnpm install
pnpm dev -- -H 127.0.0.1   # localhost-only binding is mandatory pre-launch
```

### Useful commands

```bash
# Inside the container
docker compose run --rm web pnpm check:data
docker compose run --rm web pnpm typecheck
docker compose run --rm web pnpm build

# Or from the host (cd apps/web first)
cd apps/web
pnpm check:data
pnpm typecheck
pnpm build

# Rebuild the web image after package.json or Dockerfile changes
docker compose build web

# Stop everything
docker compose down

# Stop and wipe anonymous volumes (node_modules, .next) — useful after switching branches
docker compose down -v
```

## Production deployment

The CI pipeline (`.github/workflows/build-web.yml`) builds and pushes the image
to `ghcr.io/devxyzx/primitivehub-web` on every merge to `main` that touches
`apps/web/**`. Production pulls and runs:

```bash
docker compose -f compose.yaml -f compose.prod.yaml pull
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

`compose.prod.yaml` adds resource limits, log rotation, and `pull_policy: always`.

## Pre-launch posture

The project is **not yet launched**. The domain `primitivehub.ai` is owned but
unannounced; we ship alongside an arXiv paper. No public deploys, no social
posts, no domain references anywhere indexable. `robots.txt`, `<meta noindex>`,
and `X-Robots-Tag: noindex` are in place as belt-and-suspenders.

See [`CLAUDE.md`](./CLAUDE.md) for the full set of conventions.

## License

Private. Copyright (c) 2026 CyberOrca Labs.
