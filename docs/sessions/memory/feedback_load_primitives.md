---
name: feedback-load-primitives
description: Load the relevant expert primitive from content/primitives/ before any non-trivial frontend work on PrimitiveHub
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

PrimitiveHub uses its own product to build itself. The directory `content/primitives/` holds five expert primitives — calibrated to this codebase's actual stack and aesthetic — that **must be loaded before any non-trivial frontend change**.

The mapping (also in [CLAUDE.md](/srv/primitivehub/app/CLAUDE.md) at project root, which is auto-loaded):

**Frontend (`apps/web/`):**

| Touching… | Load |
|---|---|
| Tailwind, `apps/web/app/globals.css`, tokens, fonts | `apps/web/content/primitives/tailwind-v4-mastery.md` |
| Any file in `apps/web/app/` (pages, layouts, server/client decisions) | `apps/web/content/primitives/nextjs-16-app-router.md` |
| Components in `apps/web/components/`, CVA variants, Radix composition | `apps/web/content/primitives/shadcn-ui-composition.md` |
| Any UI/visual design decision — hierarchy, microcopy, restraint | `apps/web/content/primitives/frontend-design-elite.md` |
| Producing a DESIGN.md | `apps/web/content/primitives/design-md-spec.md` |
| Any chart, score, attestation timeline, threat-model panel | `apps/web/content/primitives/tufte-data-visualization.md` |
| Designing /registry, /validation, or any future dashboard surface | `apps/web/content/primitives/dashboard-information-design.md` |
| Building or reviewing an interactive component | `apps/web/content/primitives/accessibility-wcag22.md` |

**Backend (`apps/api/`):**

| Touching… | Load |
|---|---|
| Anything touching attestation, signing, key handling, threat model | `apps/web/content/primitives/security-engineering-supplychain.md` |
| Any new model, migration, multi-tenant data flow | `apps/web/content/primitives/ddia-multi-tenant.md` |
| Postgres queries, indexes, migrations, EXPLAIN diagnosis | `apps/web/content/primitives/postgresql-production.md` |
| Django models, Ninja endpoints, Procrastinate tasks, IDOR prevention | `apps/web/content/primitives/django-ninja-production.md` |
| Caching, rate limiting, session, or Next.js `use cache` | `apps/web/content/primitives/valkey-caching-patterns.md` |

**Why:** The user explicitly requested this workflow on May 28, 2026: "as agreed, read, learn from it, create your own md file out of it, delete it. and enforce this md file dont let floating, consider this md file in each dev iterate, link it with other related md or memory and claude.md files." This is dogfooding the product. It is also their way of injecting frontend expertise into my output without re-explaining it each session.

**How to apply:**
- Before responding to a frontend question, locate the relevant primitive and read it.
- When making a non-trivial UI change, cite the principle from the primitive that motivates the choice (in code comments, PR descriptions, or chat responses).
- If a proposed change conflicts with a primitive's Core Principles or matches an Anti-Pattern, surface that conflict to the user before proceeding.
- Treat the primitives as cognition the user trusts. They've been calibrated to the codebase and the brand voice deliberately.
- **Do NOT install external Claude skills via `npx skills add` or any other supply-chain-installable mechanism.** The user has flagged this as a T5 supply-chain risk per docs/threat-model.md. External skill content gets read into `/tmp/primitivehub-skills/`, distilled into a `content/primitives/<slug>.md`, and the source is deleted.

**Source attribution for the v0.1 primitives:**
- `tailwind-v4-mastery` — synthesized from heygen-com/hyperframes (tailwind), wshobson/agents (tailwind-design-system), secondsky/claude-skills (tailwind-v4-shadcn), jezweb/claude-skills (tailwind-theme-builder), plus maintainer knowledge
- `nextjs-16-app-router` — synthesized from wsimmonds/claude-nextjs-skills (nextjs-app-router-fundamentals), vercel-labs/next-skills (nextjs), wshobson/agents (nextjs-app-router-patterns), plus maintainer knowledge
- `shadcn-ui-composition` — synthesized from shadcn/ui, google-labs-code/stitch-skills (shadcn-ui), giuseppe-trisciuoglio/developer-kit (partial), plus maintainer knowledge
- `frontend-design-elite` — synthesized from anthropics/claude-code (frontend-design recon) + maintainer taste calibration drawing on Linear / Vercel / Stripe / Sigstore as register anchors
- `design-md-spec` — synthesized from google-labs-code/stitch-skills (design-md)

All five carry `content_digest: sha256:pending-cci-v0.1-attestation` because Context CI doesn't exist yet to compute real digests. Replace with real digests once Phase 4 ships.

Related: [[project-primitivehub]], [[project-launch-posture]], [[feedback-no-fake-numbers]], [[feedback-containerize]]
