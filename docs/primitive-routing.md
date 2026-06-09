# Primitive routing — which expert primitive to load

> Extracted from `CLAUDE.md` to keep the contract lean (ADR-0040
> anti-bloat). `CLAUDE.md` keeps the *rule* ("load the right primitives
> before non-trivial work"); this file holds the full touch → primitive
> map. **This routing is non-negotiable: orphaned cognition primitives
> never get loaded and become dead weight.**

The directory [`apps/web/content/primitives/`](../apps/web/content/primitives/)
holds the project's expert cognition primitives, calibrated to the actual
stack and the actual codebase. **Before making any non-trivial change,
read the primitives in the second column.** Max 5-10 per change (see
[`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md));
if more than 10 match, the change is too broad — split it.

**Start here for any new work:** the Meta primitives below
(`discovery-and-design-discipline` + `primitive-cross-reference-index`)
route you to the rest.

## Frontend (`apps/web/`)

| Touching… | Load these primitives |
|---|---|
| Tailwind classes, `apps/web/app/globals.css`, theme tokens, fonts | [`tailwind-v4-mastery`](../apps/web/content/primitives/tailwind-v4-mastery.md) |
| Any file in `apps/web/app/` (pages, layouts, route handlers, server/client decisions) | [`nextjs-16-app-router`](../apps/web/content/primitives/nextjs-16-app-router.md) |
| Components in `apps/web/components/`, CVA variants, Radix composition | [`shadcn-ui-composition`](../apps/web/content/primitives/shadcn-ui-composition.md) |
| **Any** UI / visual design decision — taste, hierarchy, microcopy, restraint | [`frontend-design-elite`](../apps/web/content/primitives/frontend-design-elite.md) |
| Producing a DESIGN.md, documenting a screen's visual logic | [`design-md-spec`](../apps/web/content/primitives/design-md-spec.md) |
| Any chart, score badge, attestation timeline, threat-model panel | [`tufte-data-visualization`](../apps/web/content/primitives/tufte-data-visualization.md) |
| Designing `/registry`, `/validation`, future founder/admin dashboards | [`dashboard-information-design`](../apps/web/content/primitives/dashboard-information-design.md) |
| Any interactive component (focus, keyboard, ARIA, contrast, motion) | [`accessibility-wcag22`](../apps/web/content/primitives/accessibility-wcag22.md) |
| Any React 19 / TanStack Query / hook / effect / SSR hydration work | [`react-19-patterns`](../apps/web/content/primitives/react-19-patterns.md) |
| Any Framer Motion / `motion/react` animation work | [`framer-motion-discipline`](../apps/web/content/primitives/framer-motion-discipline.md) |

## Backend (`apps/api/`)

| Touching… | Load these primitives |
|---|---|
| Attestation, signing, key handling, threat-model code | [`security-engineering-supplychain`](../apps/web/content/primitives/security-engineering-supplychain.md) |
| Any model, migration, multi-tenant data flow | [`ddia-multi-tenant`](../apps/web/content/primitives/ddia-multi-tenant.md) |
| Postgres queries, indexes, migrations, EXPLAIN diagnosis | [`postgresql-production`](../apps/web/content/primitives/postgresql-production.md) |
| Django models, Ninja endpoints, Procrastinate tasks, IDOR prevention | [`django-ninja-production`](../apps/web/content/primitives/django-ninja-production.md) |
| Caching, rate limiting, Valkey, Next.js `"use cache"` | [`valkey-caching-patterns`](../apps/web/content/primitives/valkey-caching-patterns.md) |

## Infrastructure

| Touching… | Load these primitives |
|---|---|
| Any Dockerfile / compose.yaml / compose overlay / env_file wiring | [`docker-compose-discipline`](../apps/web/content/primitives/docker-compose-discipline.md) |

## Meta

| Touching… | Load these primitives |
|---|---|
| Before ANY new feature, surface, or behavior change — *and* any strategic / GTM / opportunity question: what to build, and when to stop and ask | [`discovery-and-design-discipline`](../apps/web/content/primitives/discovery-and-design-discipline.md) — two modes (product/strategy exploration + scaled feature→design→ADR gate). The pre-implementation step that makes the "consult on direction" value mechanical |
| Picking which primitives apply to your change | [`primitive-cross-reference-index`](../apps/web/content/primitives/primitive-cross-reference-index.md) — feature → primitives lookup, bounded by `feedback-bloat-control` |
| Before ANY new feature: scan for recurring bug classes | [`docs/bug-patterns.md`](./bug-patterns.md) — generalized catalog (the instance log is `docs/bugs.md`) |

## Demo content primitives (registry-facing, NOT project cognition)

The following `.md` files in `apps/web/content/primitives/` are **demo
registry entries**, not cognition for Claude to load. They ship as
example primitives in the public registry surface (`/primitive/[slug]`)
and are reachable by users browsing PrimitiveHub. They are NOT to be
confused with the cognition primitives above.

| Demo primitive | Purpose | Loaded by Claude? |
|---|---|---|
| [`elite-mobile-design`](../apps/web/content/primitives/elite-mobile-design.md) | Domain example: mobile design primitive in the registry | NO — registry content only |
| [`secure-code-review`](../apps/web/content/primitives/secure-code-review.md) | Domain example: secure-code-review primitive in the registry | NO — registry content only |

## When adding a new `.md` under `apps/web/content/primitives/`

1. If it's **project cognition** (telling Claude how to think about our
   stack), add it to one of the rows in **Frontend / Backend /
   Infrastructure / Meta** above. Non-negotiable — orphaned cognition
   primitives never get loaded.
2. If it's **registry-facing demo content**, add it to the **Demo
   content primitives** table.
3. Update [`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md)
   if the new entry shifts what should typically be loaded.
4. Update [`primitive-cross-reference-index`](../apps/web/content/primitives/primitive-cross-reference-index.md)
   to map the relevant surfaces to the new primitive (if cognition).

**These primitives reference each other.** Loading `frontend-design-elite`
references the demo-data discipline from `feedback-no-fake-numbers`
memory; `tailwind-v4-mastery` references the actual
`apps/web/app/globals.css`; `nextjs-16-app-router` references the
server-split pattern already shipped. Read them as a connected system,
not as isolated docs.
