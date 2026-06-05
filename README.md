# PrimitiveHub

The trusted registry for AI Context Primitives. A CyberOrca Labs initiative.

> PrimitiveHub treats agent context as supply-chain material, not disposable prompt text.

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

## Multi-session coordination

When more than one agent/dev session works this repo, two things go wrong:
**continuity is lost** (a new session redoes or contradicts the last one) and
**files get clobbered** (two sessions edit the same area). Git history is the
permanent record and ADRs are the decision record — this section is neither. It
is the **live board** of what is in-flight *right now*. Keep it short: clear an
entry the moment the work lands; git holds the history.

**Protocol — every session:**

1. **On start** — read the board below, plus `git log --oneline -10`. Don't
   re-do landed work; don't silently contradict an open ADR.
2. **Before editing** — add a claim row for the area you're about to touch. If a
   live claim already covers those files, coordinate or pick different work —
   **do not overwrite**.
3. **On stop** — update your row with the state + the single next step, or delete
   it if the work landed (the commit is the record).

This is a convention, not a lock: it only works if every session honours it. For
*cooperative* sessions the board is enough. When cooperation can't be assumed,
escalate to **hard isolation** below — and note that no markdown file fixes
*runtime* competition (crashes, resource fights); that's "Runtime hygiene".

### Live board

| Area / files | Session intent | State + next step | Since |
|---|---|---|---|
| _`apps/web/components/forge/` — example, replace with your real claim_ | _refactor CVA variants_ | _mid-flight — next: wire the CodeMirror linter_ | _2026-06-05_ |

### Hard isolation (when the board isn't enough)

The board can't *prevent* an overwrite — only a convention every session honours.
When you can't assume that (e.g. genuinely concurrent agents), give each session
its own `git worktree`: a separate checkout on its own branch, in its own
directory, so two sessions editing the same file is **physically impossible**.

```bash
scripts/session-worktree.sh new my-task   # new worktree + branch off main
scripts/session-worktree.sh list          # show all active worktrees
scripts/session-worktree.sh rm  my-task    # remove it (branch is kept)
```

**Single-stack rule:** worktrees isolate *files*, not *ports/RAM*. Only **one**
worktree may run the dev stack at a time — edit in parallel, run `docker compose
up` / `pnpm dev` in exactly one. See [ADR-0042](./docs/decisions/0042-multi-session-isolation.md).

### Runtime hygiene (prevents the "competing / crashing" dev process)

A board cannot stop two processes fighting for the same socket or RAM. These
rules can:

- **One dev server at a time.** Either `docker compose up` (containerized,
  preferred) **or** host `pnpm dev` — never both; they collide on port 3000 and
  the `.next` build dir. After switching modes, `docker compose down -v` wipes
  the anonymous `node_modules`/`.next` volumes.
- **Mind the RAM floor.** The full stack needs ≥8 GB + swap; `next dev` alone is
  ~1 GB. `docker compose stop web` while doing auth/admin work frees ~1 GB. See
  [`CLAUDE.md`](./CLAUDE.md) § "Dev host minimum" before blaming application code
  for an OOM/HMR stall.
- **Localhost-only, always.** `127.0.0.1`, never `0.0.0.0` (pre-launch posture).

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
