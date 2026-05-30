# ADR-0001: Next.js 16 App Router for the frontend

**Status:** Accepted
**Date:** 2026-05-27

## Context

The frontend is the primary trust signal — it's where users see "Trusted"
badges, attestation timelines, signature evidence. Pre-launch, it's also
the surface the paper will screenshot. We need a framework that:

- Server-renders for SEO + first-paint speed (the marketing-adjacent
  landing pages matter for paper-launch impressions).
- Supports the trust UI patterns we need (auth-gated, hydrated, real-
  time-ish for review-queue updates).
- Has a strong type-checker story (we shipped strict TypeScript from
  day one).
- Is the framework the paper's audience expects (researchers and
  engineering teams looking at the screenshots shouldn't be distracted
  by an unusual stack).
- Has the ecosystem of UI components that lets us match Linear / Vercel
  / Sigstore visual register without re-inventing every primitive.

## Decision

Next.js 16 App Router + React 19 + TypeScript 5.7 + Tailwind v4 +
shadcn/ui + CodeMirror 6 for the Workbench editor.

App Router (not Pages Router) for: native async server components,
streaming, server actions, parallel + intercepting routes, View
Transitions, proxy.ts middleware. These features are not optional —
they're load-bearing for the planned validation UI.

## Alternatives considered

1. **Remix** — Strong server-first story; smaller community; loaders/
   actions are great but the parallel-route + intercepting-route
   feature set is weaker than Next 16's. Rejected because the planned
   `/registry → /primitive/[slug]` modal-on-top-of-list pattern is
   exactly what App Router's `(.)folder` intercepting routes solve.

2. **SvelteKit** — Excellent perf, beautiful DX. Rejected because the
   component ecosystem (shadcn/ui equivalent, Radix equivalent) is
   smaller, and the paper's audience is more likely to recognize a
   React/Next stack. Aesthetics matter but framework familiarity
   matters more at first-impression.

3. **Plain Vite + React** — Maximum control, no framework opinions.
   Rejected because we'd be re-implementing routing, data-loading
   conventions, code-splitting, image optimization — every Next.js
   feature we use takes a week of glue we don't have.

4. **Astro** — Static-first; would handle the marketing pages
   beautifully. Rejected because the registry surfaces (Workbench,
   detail pages, validation queue) are too dynamic for Astro's
   sweet-spot.

## Consequences

**Positive:**
- Async server components give us SSG + per-request hydration for free.
- shadcn/ui + Radix + CVA gives us the components we'd otherwise build
  by hand. Calibrated taste comes from our composition, not from a
  bespoke component library.
- App Router's `proxy.ts` (formerly `middleware.ts`) is the right
  shape for the OIDC + tenant-context middleware Phase 5+ adds.
- TanStack Query integrates cleanly with Next 16's caching.

**Negative:**
- Next 16 is recent; some bugs surface only after we ship (e.g., the
  Pydantic forward-ref issue we hit on the storage upload endpoint
  was Ninja-side, but had we caught it sooner we might have stayed on
  Next 15). Acceptable risk for the feature set.
- Server actions + httpOnly cookies + same-origin proxy is more moving
  parts than a single-page app. Step 7 (OIDC) made that wiring
  load-bearing; we own the complexity now.
- Framework lock-in. If Vercel pulls a rug-pull (license change, OSS
  drama), we have to migrate. Mitigation: we avoid Vercel-only APIs
  (no `@vercel/edge-config` adoption); the deployment target is plain
  Docker + Node.

## References

- `apps/web/content/primitives/nextjs-16-app-router.md` — the primitive
  that calibrates how we write App Router code.
- `apps/web/content/primitives/shadcn-ui-composition.md` — Radix +
  shadcn discipline.
- `apps/web/content/primitives/tailwind-v4-mastery.md` — Tailwind v4
  conventions.
