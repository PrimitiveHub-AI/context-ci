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
├── infra/
│   └── postgres/init-multi-db.sh   Postgres initdb hook (primitivehub + authentik dbs)
├── compose.yaml           base compose (web + api + api-worker + postgres + valkey + authentik)
├── compose.override.yaml  dev overlay (auto-loaded)
├── compose.prod.yaml      prod overlay
├── docs/
│   ├── README.md          doc index (canonical refs + strategic foundation)
│   ├── vision.md          WHY this exists — 1/3/10-year north star
│   ├── positioning.md     WHO we are not — vs GitHub, HF, npm, …
│   ├── principles.md      WHAT is non-negotiable — 18 beliefs
│   ├── roadmap.md         WHEN we ship — Phase 1 through Phase 12+
│   ├── bugs.md            WHAT broke + root cause + prevention
│   ├── decisions/         HOW we built it — ADRs (0001-NNNN)
│   ├── spec.md            Primitive Spec v0.1 (canonical, paper-cited)
│   ├── cbom-v0.1.md       Context Bill of Materials v0.1 (canonical, paper-cited)
│   ├── cbom/              CBOM conformance suite (fixtures + manifest)
│   └── threat-model.md    10 supply-chain attack categories (canonical)
└── .github/workflows/     CI (paths: apps/web/**)
```

**Phase 3.5 is shipped on main** (orgs + registry + storage + bundles +
reviews + OIDC + RLS hardening + auth polish + Procrastinate worker
substrate). **Phase 4 is in progress** — PR #1 (Procrastinate worker)
landed; PR #2-5 wire Sigstore signing on top. Phase 5+ adds scanners.

## Canonical documents (treat as authoritative)

| Path | What it defines |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Unified design doctrine for the whole project. Visual theme, palette + roles, typography, components, layout principles. Supersedes scattered taste references. |
| [`docs/doctrine.md`](./docs/doctrine.md) | **Operational law.** Mission (operational + philosophical), category statement ("Context Firewall for AI agents"), named enemy ("unverified agent context"), ICP (1/2/3), 10 Operating Laws, decision algorithm, "We are not …" anti-positioning, Layers of the Trust Runtime, north-star metric, locked paper thesis. Versioned per ADR-0019. |
| [`docs/brand-voice.md`](./docs/brand-voice.md) | Killer phrases (use), banned vocabulary (do not ship), on-voice / off-voice examples, author attribution. Every external sentence passes through this filter. Versioned per ADR-0019. |
| [`docs/threat-model.md`](./docs/threat-model.md) | 10 supply-chain attack categories Context CI is designed to detect. Cited by the paper. Promoted to Context CI Top 10 v0.1 spec in Week 2 of the execution plan. |
| [`docs/spec.md`](./docs/spec.md) | Primitive Spec v0.1: frontmatter, body sections, content addressing, in-toto Attestation predicate, Sigstore signing model, SLSA mapping, Trust Bundle wire format. |
| [`docs/cbom-v0.1.md`](./docs/cbom-v0.1.md) | **Context Bill of Materials v0.1.** The third pillar of the Trust Runtime (alongside Trust Contract + Top 10). Canonical wire format for the agent-context inventory artifact: components, classifications, content digests, sizes, attestation pointers. Reference producer is `phub cbom`. Versioned per [ADR-0033](./docs/decisions/0033-cbom-v01.md). |
| [`docs/execution-plan.md`](./docs/execution-plan.md) | The 18-week execution arc (2026-06-01 → 2026-09-30) from Phase 5.5 to public launch. Acceptance gates (G-A..G-G), weekly cadence, standards-governance workstreams (Trust Contract / Top 10 / CBOM / Policy Language as versioned public specs), risk register, explicit deferrals. Companion to `docs/roadmap.md` — roadmap is the phase ledger, execution plan is how we ship the next phases. |
| [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md) | **Methodology + ledger** for resolving `phub audit` / `phub scan` false positives. The AV-vendor discipline applied to our threat model: four resolution paths (true positive / domain WAI / detector defect / escalate), strict allow-entry format, append-only numbered FP-NNN ledger, quarterly re-review. **Read before adding any `allow:` entry to `.primitivehub/policy.yaml`.** |
| [`docs/README.md`](./docs/README.md) | Doc index + planned OSS sibling repos + the relationship diagram for the whole strategic doc layer. |

When you write code that touches any of: cryptographic vocabulary,
attestation, signing, primitive validation, or the threat model — **read
the relevant docs/* first.** The spec is the contract; the threat model
is the justification.

## Strategic foundation (read before any non-trivial work)

The team-facing strategic layer that frames every decision:

| Path | What it answers |
|---|---|
| [`docs/vision.md`](./docs/vision.md) | **WHY** — the agent-context-as-supply-chain thesis. 1 / 3 / 10-year horizon. The North Star. |
| [`docs/positioning.md`](./docs/positioning.md) | **WHO we are NOT** — competitive landscape vs GitHub, HF, npm, MCP Registry, vendor skill registries. |
| [`docs/principles.md`](./docs/principles.md) | **WHAT is non-negotiable** — 18 beliefs the project ships against. |
| [`docs/roadmap.md`](./docs/roadmap.md) | **WHEN** — Phase 1 through Phase 12+ with target windows, ship lists, success metrics. |
| [`docs/okrs/2026-Q3.md`](./docs/okrs/2026-Q3.md) | **WHAT we are measuring this quarter** — 3 Objectives × 3 Key Results, mapped to the gates in `execution-plan.md` and the Operating Laws in `doctrine.md`. If a piece of work doesn't ladder to a KR, it doesn't belong on the quarter. |
| [`docs/bugs.md`](./docs/bugs.md) | **WHAT broke** — every load-bearing bug + root cause + prevention. Grep before re-deriving. AI-hallucination log at the bottom. |
| [`docs/decisions/`](./docs/decisions/) | **HOW we built it** — Architecture Decision Records. One file per load-bearing choice with status, alternatives, consequences. |

**Discipline:**
- Before proposing a new feature: skim `vision.md` + `principles.md`
  to check alignment.
- Before adopting a third-party library: skim `positioning.md` for
  competitor signal + write an ADR if the choice is load-bearing.
- After fixing a bug: add an entry to `bugs.md` (with root cause +
  prevention) BEFORE the fix merges. No silent fixes.
- Before re-deriving a known failure: grep `bugs.md` for the symptom.
- Before debating an architecture pattern: search `decisions/` for an
  existing ADR. If you disagree, propose superseding it; do not
  silently violate.

These documents are the institutional memory. Treat them with the
same discipline as the codebase.

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
| Any React 19 / TanStack Query / hook / effect / SSR hydration work | [`apps/web/content/primitives/react-19-patterns.md`](./apps/web/content/primitives/react-19-patterns.md) |
| Any Framer Motion / `motion/react` animation work | [`apps/web/content/primitives/framer-motion-discipline.md`](./apps/web/content/primitives/framer-motion-discipline.md) |

### Backend (`apps/api/`)

| Touching… | Load these primitives |
|---|---|
| Attestation, signing, key handling, threat-model code | [`apps/web/content/primitives/security-engineering-supplychain.md`](./apps/web/content/primitives/security-engineering-supplychain.md) |
| Any model, migration, multi-tenant data flow | [`apps/web/content/primitives/ddia-multi-tenant.md`](./apps/web/content/primitives/ddia-multi-tenant.md) |
| Postgres queries, indexes, migrations, EXPLAIN diagnosis | [`apps/web/content/primitives/postgresql-production.md`](./apps/web/content/primitives/postgresql-production.md) |
| Django models, Ninja endpoints, Procrastinate tasks, IDOR prevention | [`apps/web/content/primitives/django-ninja-production.md`](./apps/web/content/primitives/django-ninja-production.md) |
| Caching, rate limiting, Valkey, Next.js `"use cache"` | [`apps/web/content/primitives/valkey-caching-patterns.md`](./apps/web/content/primitives/valkey-caching-patterns.md) |

### Infrastructure

| Touching… | Load these primitives |
|---|---|
| Any Dockerfile / compose.yaml / compose overlay / env_file wiring | [`apps/web/content/primitives/docker-compose-discipline.md`](./apps/web/content/primitives/docker-compose-discipline.md) |

### Meta

| Touching… | Load these primitives |
|---|---|
| Picking which primitives apply to your change | [`apps/web/content/primitives/primitive-cross-reference-index.md`](./apps/web/content/primitives/primitive-cross-reference-index.md) — feature → primitives lookup, bounded by `feedback-bloat-control` |
| Before ANY new feature: scan for recurring bug classes | [`docs/bug-patterns.md`](./docs/bug-patterns.md) — generalized catalog (the instance log is `docs/bugs.md`) |

### Demo content primitives (registry-facing, NOT project cognition)

The following `.md` files in `apps/web/content/primitives/` are **demo
registry entries**, not cognition for Claude to load. They ship as
example primitives in the public registry surface
(`/primitive/[slug]`) and are reachable by users browsing PrimitiveHub.
They are NOT to be confused with the cognition primitives above.

| Demo primitive | Purpose | Loaded by Claude? |
|---|---|---|
| [`apps/web/content/primitives/elite-mobile-design.md`](./apps/web/content/primitives/elite-mobile-design.md) | Domain example: mobile design primitive in the registry | NO — registry content only |
| [`apps/web/content/primitives/secure-code-review.md`](./apps/web/content/primitives/secure-code-review.md) | Domain example: secure-code-review primitive in the registry | NO — registry content only |

When **adding a new** `.md` file under `apps/web/content/primitives/`:

1. If it's project cognition (telling Claude how to think about our
   stack), add it to one of the rows in **Frontend / Backend /
   Infrastructure / Meta** above. This is non-negotiable — orphaned
   cognition primitives never get loaded and become dead weight.
2. If it's registry-facing demo content, add it to this **Demo content
   primitives** table.
3. Update `feedback-bloat-control` if the new entry shifts what should
   typically be loaded.
4. Update `primitive-cross-reference-index` to map the relevant
   surfaces to the new primitive (if cognition).

**These primitives reference each other.** Loading `frontend-design-elite`
references the demo-data discipline from `feedback-no-fake-numbers`
memory; loading `tailwind-v4-mastery` references the actual
`apps/web/app/globals.css`; loading `nextjs-16-app-router` references the
server-split pattern already shipped. Read them as a connected system, not
as isolated docs.

## Auto-memory rules (full enforcement map)

These live in `/home/primitive/.claude/projects/-srv-primitivehub-app/memory/`
and are surfaced via `MEMORY.md`. Every rule below is consulted at the
moment the relevant condition triggers — nothing here is decorative.

| Rule | Triggers when… | Load it for |
|---|---|---|
| [`feedback-pnpm`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md) | Adding/removing JS dependencies, lockfile work | Package management |
| [`feedback-containerize`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md) | Spinning up any new service or dev workflow | Service orchestration |
| [`feedback-localhost-only`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md) | Any port binding in compose / app config | Pre-launch network surface |
| [`feedback-no-fake-numbers`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_no_fake_numbers.md) | Any numeric / metric in UI or copy | Paper-grade truth discipline |
| [`feedback-load-primitives`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_load_primitives.md) | Start of any non-trivial feature | Knowing what to read first |
| [`feedback-audit-methodology`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_audit_methodology.md) | Before marking a feature "done" | 5-layer audit gate |
| [`feedback-self-audit`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_self_audit.md) | Before reporting work complete | Universal + per-domain audit checklist |
| [`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md) | Picking primitives for a feature | 5-10 primitive cap |
| [`feedback-priority-stack`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_priority_stack.md) | Two primitives give conflicting guidance | Conflict tiebreaker |
| [`feedback-never-delete-held-code`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_never_delete_held_code.md) | Encountering `HELD` markers in code | Don't delete staged work |
| [`user-workflow`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/user_workflow.md) | User pastes a prompt from another AI assistant | Evaluation-before-execution workflow |
| [`project-primitivehub`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_primitivehub.md) | Any strategic question | Project identity + phase plan |
| [`project-launch-posture`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_launch_posture.md) | Anything touching public-facing surface | Pre-launch posture |

## Hard rules

These are **enforced by user instruction**; not negotiable.

1. **Containerize everything** — every service runs in Docker. See
   [feedback-containerize memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md).
2. **pnpm only**, never npm. See
   [feedback-pnpm memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md).
3. **Localhost-only dev binding — six layers, not one.** `127.0.0.1`,
   never `0.0.0.0`, ever. The rule covers compose port specs +
   direct process binds + host-level reverse proxies + public DNS
   records + firewall state + running-container bindings — see
   [docs/bugs.md § 26](./docs/bugs.md) for the canonical incident +
   [ADR-0031](./docs/decisions/0031-pre-launch-posture-automation.md)
   for the automation contract. Before claiming pre-launch posture
   is intact, run `scripts/check-pre-launch-posture.sh` on the live
   host; CI auto-gates layer 1
   ([.github/workflows/pre-launch-posture.yml](.github/workflows/pre-launch-posture.yml)).
   See also [feedback-localhost-only memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md).
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
   threat model). The project-local enforcement surface for this rule
   is `npx @primitivehub/phub audit` (PR 5.7.1, ADR-0025) — it walks
   the working tree, classifies every agent-context artifact, and
   runs the Top 10 detectors. If you cloned a skill and want to know
   what it actually contains before reading 14KB of markdown, run
   `phub audit` first.
7. **Active by default; passive only by explicit user choice.**
   Principle 19 + [ADR-0025](./docs/decisions/0025-active-posture-and-phub-audit.md):
   the project ships *guardians*, not just *linters*. Every new
   user-facing surface declares itself passive (waits for a target)
   or active (discovers its own targets) in its design note. Passive
   tools alone cannot defend against the file you didn't know to scan.
8. **False-positive triage is mandatory, not optional.**
   Principle 20 + [ADR-0030](./docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md).
   When `phub audit` / `phub scan` / the Context CI pipeline flags
   content, classify the finding using the four-path decision tree
   in [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md)
   § 1 BEFORE proposing any resolution. Adding an `allow:` entry to
   `.primitivehub/policy.yaml` without a matching `FP-NNN` ledger
   entry in the same commit is a defect. Path A = edit the content.
   Path B = narrow allow + ledger entry. Path C = lockstep detector
   tightening (Python + TS per ADR-0023). Path D = escalate to a
   security-reviewer, never silently allow.
9. **PrimitiveHub is "agent-context AV plus registry," not "GitHub
   for prompts."** [ADR-0030](./docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md)
   § 3 locks the product-family parallel. When writing copy,
   answering "what is this?", or shaping a new surface, the AV
   product-family map (scanner / signature DB / allowlist DB / FP
   submission portal / on-access guard / runtime gate / cloud lookup
   / provenance) is the reference frame. The defense layer is the
   moat, not the storage layer.

## Decision algorithm (from [`docs/doctrine.md`](./docs/doctrine.md))

For any non-trivial decision (PR scope, feature proposal, design
partner ask, dependency add, marketing copy), ask in order:

1. **Does this serve an Operating Law?** (See `docs/doctrine.md` §
   "The Operating Laws".) Yes → priority. No → continue.
2. **Does this serve an active OKR this quarter?** (See
   `docs/okrs/2026-Q3.md`.) Yes → schedule. No → continue.
3. **Does this preserve our category position?** ("We are the Context
   Firewall, not a registry.") Yes → maybe. No → reject.

If a decision cannot pass step 3, the answer is no. Note the decision
in the relevant ADR or PR description; do not re-litigate next month.

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
- **Signing:** Backend-abstracted (ADR-0011). Public Sigstore for the v1
  public registry; Sigstore staging (sigstage.dev) for dev/CI;
  self-hosted Sigstore for Phase 7 enterprise private registries
  (public Rekor's transparency log would publicly disclose
  private-registry author identities). One env var (`SIGSTORE_BACKEND`)
  swaps backends; the sign-call code never branches.
- **Multi-tenancy:** Shared schema + `organization_id` + Postgres RLS
- **CI:** GitHub Actions → GHCR
- **Deployment:** Hetzner CX22+ (8GB) + Docker Compose

## Dev host minimum (load-bearing — read before diagnosing slow auth/build)

The full stack (web dev + api + postgres + valkey + authentik-server +
authentik-worker) needs **≥8 GB RAM + swap** to run together without
memory pressure. Resident set sizes under typical load:

- web (Next.js dev): ~1 GB     — heaviest; stop when not actively building UI
- authentik-server: ~340 MB
- authentik-worker: ~440 MB
- api (Django + uv): ~150 MB
- postgres: ~100 MB
- valkey: ~10 MB
- **Total + host overhead: ~2.5–3 GB resident, peaks higher under load.**

If the dev host is below this:

- **Symptom**: Authentik login spinner, slow `next dev` HMR, postgres
  pg_repack stalls, OOM-killed `next-server` workers.
- **First triage**: `free -h`. If `available` < 500 MB while load is
  light, the host is too small — don't blame the application code.
- **Fast mitigations** (in order of cost):
  1. `docker compose stop web` while doing auth/admin work
     (frees ~1 GB instantly).
  2. Add swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600
     /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
     (persist via `/etc/fstab`).
  3. Upgrade the host to ≥8 GB before claiming the stack "works on this
     box".

Do NOT diagnose Authentik login issues, Next compilation hangs, or
postgres connection storms without first confirming the host has
headroom — half the apparent bugs are actually memory exhaustion.

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
- `uv run mypy primitivehub_api accounts orgs registry storage validation jobs` must pass — strict typing on (django-stubs plugin enabled). The flat-layout means there's no `apps/` subdir to globally target; list the Django apps explicitly.
- `uv run python scripts/check_schema.py` must pass — schema invariant guard.
- `uv run python manage.py check --fail-level WARNING` must pass — Django system check.
- `uv run pytest` must pass — smoke + business tests. Default run
  skips `@pytest.mark.integration` (network-dependent tests against
  sigstage Fulcio + Rekor; opt-in with `uv run pytest -m integration`
  + `SIGSTAGE_OIDC_TOKEN` env). **Tests run against Postgres**, not sqlite. The `primitivehub_test` database is provisioned
  by `infra/postgres/init-multi-db.sh` (one-time on fresh clusters; for
  existing clusters, run the script's SQL manually). pytest-django uses
  `--reuse-db` so the test database persists across runs and keeps the
  `test_bypass_rls` role grants. Tests bypass RLS in their fixture
  setup via `SET ROLE test_bypass_rls`; the dedicated
  `test_rls_actually_isolates.py` resets back to `primitivehub_app`
  (NOSUPERUSER, NOBYPASSRLS) to prove RLS enforces. **sqlite is
  forbidden for tests** — it skips RLS migrations and would hide
  tenant-isolation regressions.
- Migrations: hand-edited migrations are committed; never use `--squash` on
  released migrations. RLS migrations have an `if vendor != "postgresql"`
  early-return for `dumpdata`/`inspectdb` against foreign backends only;
  production and tests are Postgres.
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
