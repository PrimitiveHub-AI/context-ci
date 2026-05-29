# CLAUDE.md — PrimitiveHub project guidance

> **This file is auto-loaded into every Claude Code session in this repository.**
> It enforces project-specific conventions, points to canonical docs, and
> tells future-Claude which **expert primitives** to load before any frontend
> work. It is not optional reading. It is the contract.

## Project identity

PrimitiveHub is a **CyberOrca Labs initiative** — the trusted registry for
AI Context Primitives. The product positions itself as "GitHub Enterprise
for trusted AI Context Primitives" and launches alongside an arXiv
technical paper on **agent-context as a new supply-chain attack surface**.

- **Domain:** primitivehub.ai (owned, **not yet announced**)
- **Launch posture:** pre-launch, secret. No public deploys. No social
  posts. No indexing.
- **Target launch:** Q3 2026 alongside the arXiv paper.

See [project memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_primitivehub.md)
and [launch posture memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_launch_posture.md)
for the full picture. **Read both before responding to a strategic question.**

## Repository layout

```
.
├── CLAUDE.md              this file
├── DESIGN.md              unified design doctrine (single source of truth)
├── README.md              project-level dev workflow
├── apps/
│   ├── web/               Next.js 16 frontend
│   │   ├── app/           App Router pages + route handlers
│   │   ├── components/    React components (ui / landing / primitives / workbench / contributors)
│   │   ├── content/       per-primitive markdown source
│   │   ├── hooks/         custom hooks
│   │   ├── lib/           types, data, workbench utilities
│   │   ├── public/        static assets (robots.txt, icons, …)
│   │   ├── scripts/       check-data.mjs runtime invariant guard
│   │   ├── Dockerfile     multi-stage; built by CI
│   │   └── package.json   web app dependencies
│   └── api/               Django 5 + Django Ninja backend (Phase 3 bootstrap)
│       ├── pyproject.toml uv-managed Python 3.13 project
│       ├── manage.py
│       ├── primitivehub_api/   Django project package (settings, urls, api composition)
│       ├── accounts/      custom User + OIDC middleware
│       ├── orgs/          Organization + Member + Role
│       ├── registry/      Registry → Repository → Primitive → Version → Attestation
│       ├── tests/         pytest suite
│       ├── scripts/check_schema.py  schema invariant guard
│       └── Dockerfile     multi-stage (uv → slim runtime)
├── infra/
│   └── postgres/init-multi-db.sh   Postgres initdb hook (primitivehub + authentik dbs)
├── compose.yaml           base compose (orchestrates web + api + postgres + valkey + authentik)
├── compose.override.yaml  dev overlay (auto-loaded)
├── compose.prod.yaml      prod overlay
├── docs/
│   ├── README.md          doc index
│   ├── spec.md            Primitive Spec v0.1
│   └── threat-model.md    10 supply-chain attack categories
└── .github/workflows/     CI (paths: apps/web/**)
```

**Phase 3 bones are now in `apps/api/`.** Phase 4 wires Sigstore + Procrastinate
workers; Phase 5+ adds scanners. New services land as siblings of `apps/web/`
and `apps/api/`.

## Canonical documents (treat as authoritative)

| Path | What it defines |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Unified design doctrine for the whole project. Visual theme, palette + roles, typography, components, layout principles. Supersedes scattered taste references. |
| [`docs/threat-model.md`](./docs/threat-model.md) | 10 supply-chain attack categories Context CI is designed to detect. Cited by the paper. |
| [`docs/spec.md`](./docs/spec.md) | Primitive Spec v0.1: frontmatter, body sections, content addressing, in-toto Attestation predicate, Sigstore signing model, SLSA mapping. |
| [`docs/README.md`](./docs/README.md) | Doc index + planned OSS sibling repos. |

When you write code that touches any of: cryptographic vocabulary,
attestation, signing, primitive validation, or the threat model — **read
the relevant docs/* first.** The spec is the contract; the threat model
is the justification.

## Expert primitives — load these before non-trivial work

The directory [`apps/web/content/primitives/`](./apps/web/content/primitives/)
holds the project's expert cognition primitives, calibrated to the actual
stack and the actual codebase. **Before making any non-trivial change,
read the primitives in the second column.** Max 5-10 per change (see
[`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md));
if more than 10 match, the change is too broad — split it.

### Frontend (`apps/web/`)

| Touching… | Load these primitives |
|---|---|
| Tailwind classes, `apps/web/app/globals.css`, theme tokens, fonts | [`apps/web/content/primitives/tailwind-v4-mastery.md`](./apps/web/content/primitives/tailwind-v4-mastery.md) |
| Any file in `apps/web/app/` (pages, layouts, route handlers, server/client decisions) | [`apps/web/content/primitives/nextjs-16-app-router.md`](./apps/web/content/primitives/nextjs-16-app-router.md) |
| Components in `apps/web/components/`, CVA variants, Radix composition | [`apps/web/content/primitives/shadcn-ui-composition.md`](./apps/web/content/primitives/shadcn-ui-composition.md) |
| **Any** UI / visual design decision — taste, hierarchy, microcopy, restraint | [`apps/web/content/primitives/frontend-design-elite.md`](./apps/web/content/primitives/frontend-design-elite.md) |
| Producing a DESIGN.md, documenting a screen's visual logic | [`apps/web/content/primitives/design-md-spec.md`](./apps/web/content/primitives/design-md-spec.md) |
| Any chart, score badge, attestation timeline, threat-model panel | [`apps/web/content/primitives/tufte-data-visualization.md`](./apps/web/content/primitives/tufte-data-visualization.md) |
| Designing `/registry`, `/validation`, future founder/admin dashboards | [`apps/web/content/primitives/dashboard-information-design.md`](./apps/web/content/primitives/dashboard-information-design.md) |
| Any interactive component (focus, keyboard, ARIA, contrast, motion) | [`apps/web/content/primitives/accessibility-wcag22.md`](./apps/web/content/primitives/accessibility-wcag22.md) |

### Backend (`apps/api/`)

| Touching… | Load these primitives |
|---|---|
| Attestation, signing, key handling, threat-model code | [`apps/web/content/primitives/security-engineering-supplychain.md`](./apps/web/content/primitives/security-engineering-supplychain.md) |
| Any model, migration, multi-tenant data flow | [`apps/web/content/primitives/ddia-multi-tenant.md`](./apps/web/content/primitives/ddia-multi-tenant.md) |
| Postgres queries, indexes, migrations, EXPLAIN diagnosis | [`apps/web/content/primitives/postgresql-production.md`](./apps/web/content/primitives/postgresql-production.md) |
| Django models, Ninja endpoints, Procrastinate tasks, IDOR prevention | [`apps/web/content/primitives/django-ninja-production.md`](./apps/web/content/primitives/django-ninja-production.md) |
| Caching, rate limiting, Valkey, Next.js `"use cache"` | [`apps/web/content/primitives/valkey-caching-patterns.md`](./apps/web/content/primitives/valkey-caching-patterns.md) |

**These primitives reference each other.** Loading `frontend-design-elite`
references the demo-data discipline from `feedback-no-fake-numbers`
memory; loading `tailwind-v4-mastery` references the actual
`apps/web/app/globals.css`; loading `nextjs-16-app-router` references the
server-split pattern already shipped. Read them as a connected system, not
as isolated docs.

## Hard rules

These are **enforced by user instruction**; not negotiable.

1. **Containerize everything** — every service runs in Docker. See
   [feedback-containerize memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md).
2. **pnpm only**, never npm. See
   [feedback-pnpm memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md).
3. **Localhost-only dev binding** — `127.0.0.1`, never `0.0.0.0`,
   ever. See [feedback-localhost-only memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md).
4. **No fake numbers as fact** — every UI metric is either reproducible
   or labeled `<DemoDataBadge>`. See
   [feedback-no-fake-numbers memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_no_fake_numbers.md).
5. **No public deploys, no social posts, no domain references** anywhere
   indexable until the paper publishes. `noindex` defenses are live
   (robots.txt + meta + X-Robots-Tag).
6. **No npx skill installs.** External AI skills get *read into
   `/tmp/primitivehub-skills/`, distilled into a spec-conformant
   primitive in `apps/web/content/primitives/`, source deleted*. The npx
   install path is treated as a supply-chain attack vector (T5 in our
   threat model).

## Cryptographic vocabulary (locked)

- **Content Digest** = SHA-256 hash of the canonical content
- **Signature** = Ed25519 (planned via Sigstore keyless OIDC; not yet
  implemented)
- **Attestation** = Context CI validation record (in-toto Statement with
  PredicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`)
- **Provenance Chain** = author → validation → review → release

**Never write "SHA-256 signed"** — SHA-256 is a hash, not a signature.
This wording is load-bearing for the paper's correctness.

## Architecture (locked decisions)

- **Frontend:** Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui ✓ done (`apps/web/`)
- **Backend (Phase 3+):** Django 5 + Django Ninja + Postgres 17 (`apps/api/`, not yet built)
- **Cache / sessions:** Valkey (not Redis)
- **Jobs:** Procrastinate (Postgres-backed; defers RabbitMQ to Phase 5+)
- **Object storage:** Cloudflare R2 (v1); MinIO swap-in for enterprise
  self-host (Phase 7). Object key = `sha256:<hex>` always.
- **Auth / identity:** Authentik (OIDC, self-hosted, containerized)
- **Signing:** Public Sigstore (Phase 4); self-hosted Sigstore (Phase 7
  for private registries — public Rekor's transparency log would
  publicly disclose private-registry author identities)
- **Multi-tenancy:** Shared schema + `organization_id` + Postgres RLS
- **CI:** GitHub Actions → GHCR
- **Deployment:** Hetzner CX22+ (8GB) + Docker Compose

## Build hygiene

### Frontend (`apps/web/`)

All web commands run from `apps/web/`.

- `cd apps/web && pnpm typecheck` must pass before any commit touching
  `.ts`/`.tsx`.
- `cd apps/web && pnpm check:data` must pass before any commit touching
  `apps/web/lib/data/*` or `apps/web/lib/types.ts`. The data-integrity
  guard is non-negotiable.
- Real TS errors block builds — `apps/web/next.config.mjs` does NOT silence
  them (the v0 `ignoreBuildErrors: true` flag was removed in Phase 1).
- Container builds: `docker compose build web` from the repo root.

### Backend (`apps/api/`)

All Python commands run from `apps/api/` via `uv`.

- `uv run ruff check .` must pass — Python lint (S = security, B = bugbear, DJ = Django).
- `uv run ruff format --check .` must pass — formatter is non-negotiable.
- `uv run mypy primitivehub_api apps` must pass — strict typing on (django-stubs plugin enabled).
- `uv run python scripts/check_schema.py` must pass — schema invariant guard.
- `uv run python manage.py check --fail-level WARNING` must pass — Django system check.
- `uv run pytest` must pass — smoke + business tests.
- Migrations: hand-edited migrations are committed; never use `--squash` on
  released migrations. RLS migrations use `RunPython` with a no-op on
  non-Postgres backends so sqlite-based tests still work.
- Container builds: `docker compose build api` from the repo root.

## Workflow

- **PRs over direct-to-main.** Even for docs.
- **One logical change per PR.** Reviewability is itself a trust signal.
- **Branch from `main`** unless there's a stated reason to stack.
- **No merging without the user's explicit OK** — even on a session
  where they've trusted you to do everything else.

## When in doubt

1. Read the relevant primitive in `apps/web/content/primitives/`.
2. Read the relevant `docs/*`.
3. Read the relevant memory file.
4. **Ask.** The user has stated repeatedly that they value being
   consulted on direction. They prefer two clarifying questions to one
   wrong assumption.

---

This file is updated whenever a primitive is added, the contract shifts,
or the repository structure changes. It is meant to be a load-bearing
reference, not a snapshot.
