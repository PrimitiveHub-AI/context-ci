# Repository structure & phase status

> Extracted from `CLAUDE.md` to keep the contract lean (ADR-0040
> anti-bloat). This is the orientation map; `CLAUDE.md` links here.
> Update this file in the same PR when the top-level layout changes.

## Layout

```
.
├── CLAUDE.md              the contract (auto-loaded every session)
├── DESIGN.md              unified design doctrine (single source of truth)
├── README.md              project-level dev workflow
├── apps/
│   ├── web/               Next.js 16 frontend
│   │   ├── app/           App Router pages + route handlers
│   │   ├── components/    React components (ui / landing / primitives / forge / contributors)
│   │   ├── content/       per-primitive markdown source
│   │   ├── hooks/         custom hooks
│   │   ├── lib/           types, data, forge utilities (CodeMirror linter, Primitive Spec parser)
│   │   ├── public/        static assets (robots.txt, icons, …)
│   │   ├── scripts/       check-data.mjs runtime invariant guard
│   │   ├── Dockerfile     multi-stage; built by CI
│   │   └── package.json   web app dependencies
│   └── api/               Django 5 + Django Ninja backend (Phase 3.5 shipped)
│       ├── pyproject.toml uv-managed Python 3.13 project
│       ├── manage.py
│       ├── primitivehub_api/   Django project package (settings, urls, api composition)
│       ├── accounts/      custom User + OIDC middleware + tenant middleware
│       ├── orgs/          Organization + Member + Role
│       ├── registry/      Registry → Repository → Primitive → Version → Attestation
│       ├── storage/       boto3 R2 client + content-addressed digest helpers
│       ├── validation/    ReviewItem + PipelineStage (Context CI surface)
│       ├── jobs/          Procrastinate tasks (Phase 4 PR #1 — substrate)
│       ├── signing/       Sigstore backend abstraction (Phase 4 PR #2 — ADR-0011)
│       ├── scanners/      Context CI detectors — T1..T10 (Phase 5 — ADR-0012)
│       ├── tests/         pytest suite (Postgres-only, --reuse-db)
│       ├── scripts/check_schema.py  schema invariant guard
│       └── Dockerfile     multi-stage (uv → slim runtime)
├── packages/
│   └── phub/              the @primitivehub/phub CLI (TS): audit / scan / verify / watch / cbom
├── bench/                 adversarial corpus + measurement scripts (ADR-0032)
├── infra/
│   └── postgres/init-multi-db.sh   Postgres initdb hook (primitivehub + authentik dbs)
├── compose.yaml           base compose (web + api + api-worker + postgres + valkey + authentik)
├── compose.override.yaml  dev overlay (auto-loaded)
├── compose.prod.yaml      prod overlay
├── docs/
│   ├── README.md          doc index (canonical refs + strategic foundation)
│   ├── vision.md          WHY this exists — 1/3/10-year north star
│   ├── positioning.md     WHO we are not — vs GitHub, HF, npm, …
│   ├── principles.md      WHAT is non-negotiable — beliefs the project ships against
│   ├── roadmap.md         WHEN we ship — Phase 1 through Phase 12+
│   ├── bugs.md            WHAT broke + root cause + prevention
│   ├── decisions/         HOW we built it — ADRs (0001-NNNN)
│   ├── spec.md            Primitive Spec v0.1 (canonical, paper-cited)
│   ├── cbom-v0.1.md       Context Bill of Materials v0.1 (canonical, paper-cited)
│   ├── cbom/              CBOM conformance suite (fixtures + manifest)
│   ├── repo-structure.md  this file
│   ├── primitive-routing.md   which expert primitive to load for a given change
│   ├── dev-host.md        dev host requirements + memory-pressure troubleshooting
│   ├── build-hygiene.md   per-app build/test gates
│   └── threat-model.md    10 supply-chain attack categories (canonical)
└── .github/workflows/     CI
```

## Phase status

**Phase 3.5 is shipped on main** (orgs + registry + storage + bundles +
reviews + OIDC + RLS hardening + auth polish + Procrastinate worker
substrate). **Phase 4 is in progress** — PR #1 (Procrastinate worker)
landed; PR #2-5 wire Sigstore signing on top. Phase 5+ adds scanners.

See [`docs/roadmap.md`](./roadmap.md) for the full phase ledger and
[`docs/execution-plan.md`](./execution-plan.md) for the 18-week arc.
