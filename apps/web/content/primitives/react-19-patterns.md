---
spec_version: "0.1"
name: react-19-patterns
version: 0.1.0
type: engineering
domain: frontend
author: PrimitiveHub AI (synthesized 2026-05-30 from React 19 release notes + production patterns)
license: CC-BY-4.0
tokens: 3200
token_budget: 4500
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
use_when:
  - "Writing or editing any React 19 component or hook"
  - "Working with TanStack Query (cache, invalidation, sync-effect patterns)"
  - "Diagnosing stale-state, stale-closure, or render-cascade bugs"
  - "Designing data flow between server components and client components"
  - "Hydration mismatch issues (localStorage, Date, random in SSR'd components)"
do_not_use_when:
  - "Plain HTML / static markup (no React needed)"
  - "React 18 codebases (some primitives don't apply)"
attestation: cci-v0.1
description: "React 19 patterns for PrimitiveHub: TanStack Query discipline (key design, staleTime, cache invalidation), effects + stale closures, ref-mirror pattern for cross-callback state, SSR hydration safety, server vs client component decision, key-based identity in lists."
keywords: [react-19, tanstack-query, hooks, hydration, effects, closures, server-components]
references:
  - "https://react.dev/blog/2024/04/25/react-19"
  - "https://tanstack.com/query/latest/docs/framework/react/overview"
---

# React 19 Patterns

## Purpose

PrimitiveHub's frontend is Next.js 16 + React 19. The App Router
primitive (`nextjs-16-app-router`) covers server/client split,
routing, and Server Actions. THIS primitive covers the React-layer
patterns that bite at runtime: stale closures, stale state in effects,
TanStack Query discipline, hydration safety, and the cache-vs-state
hand-off.

The common AI-output failures: (a) `useEffect(() => setState(query.
data))` that wipes paginated state on every refetch, (b) drag/touch
handlers reading state via stale closures, (c) localStorage read
during render breaking SSR hydration, (d) `useEffect` cleanup not
firing on every re-render (`[]` deps with render-time global mutation),
(e) `setState` between `router.push()` and route transition disrupting
bfcache.

## Core Principles

- **Query data first, derived state second.** When a TanStack Query
  hook returns data, read from `query.data` directly. Do NOT
  `setState(query.data)` in a sync effect to "mirror" the query —
  every refetch wipes any local changes (pagination, optimistic
  edits). The mirror pattern is correct ONLY when you intentionally
  accumulate beyond what the query returns; in that case, the sync
  effect MERGES, not replaces.

- **Query keys are tenant + identity + params.** PrimitiveHub's hooks
  follow `[resource, activeOrgSlug, ...params]`. Including the org
  slug in the key invalidates the cache on org switch automatically.
  Omitting it leaks cross-tenant data when the user switches orgs.

- **Stale-closure rule for event handlers.** A handler created in
  `useCallback` captures the state value at creation time. If
  `onTouchMove` sets state and `onTouchEnd` reads it, the read sees
  the OLD value. Use a `ref` mirror alongside state: state drives
  re-renders (visual), ref drives logic (threshold checks). Pattern
  established in `docs/bugs.md` #19.

- **SSR-safe initialization.** Code that runs during render must
  produce the same output on the server and on the first client
  render. `localStorage.getItem()`, `Date.now()`, `Math.random()` in
  render bodies cause hydration mismatch. Read these in `useEffect`
  after mount, then `setState` (which re-renders client-only).

- **Effect cleanup runs every time deps change — including on
  re-render with new dep values.** `useEffect(() => {…; return () =>
  cleanup}, [a, b])`: cleanup fires before each re-run AND on unmount.
  If you set a global flag in render and clean it in an effect with
  `[]` deps, the cleanup runs once and the flag stays mutated forever.
  Use a `ref` guard or move the mutation into the effect itself.

- **Server components for static + per-request data; client components
  for state, effects, browser APIs.** Cross-reference
  `nextjs-16-app-router` for the boundary discipline. THIS primitive
  assumes you've chosen client.

- **Lists need stable `key`s tied to identity.** Not `index`. Not
  `Date.now()`. The model's UUID or stable slug. `key={index}` breaks
  enter/exit animations and triggers unnecessary remounts on insert.

## Decision Rules

### TanStack Query

- **IF building a hook for a tenant-scoped resource THEN** include
  `activeOrgSlug` from `useActiveOrg()` in the query key:
  `["primitives", activeOrgSlug, params]`. Forward `orgSlug` into
  `apiFetch` so the header is sent.
- **IF a query's data feeds local state THEN** read from `query.data`
  directly. Don't mirror into `useState` unless you're accumulating
  beyond what one query returns (e.g., infinite scroll). If you must
  mirror, MERGE in the functional updater; never `setState(query.data)`
  that wipes accumulated rows.
- **IF a mutation changes data another query reads THEN** invalidate
  the affected keys via `queryClient.invalidateQueries({ queryKey:
  ["primitives", activeOrgSlug] })`. Don't reach into the cache and
  set data manually unless you understand the eviction model.
- **IF staleTime matters (registry data updates slowly) THEN** set
  `staleTime: 5 * 60 * 1000`. PrimitiveHub's default in
  `components/providers.tsx` is 5 min, with `retry: 1` and
  `refetchOnWindowFocus: false`.
- **IF the page is purely SSG with no need for live data THEN** skip
  the query hook entirely; read from `lib/data/*` mocks or pass props.

### Effects + state

- **IF a `useEffect` mirrors query data into local state THEN** the
  page is probably accumulating (pagination) — and the mirror must
  MERGE, not replace. Otherwise, just read `query.data` and delete
  the effect.
- **IF a value is set in one callback and read in another (touch
  handlers, async chains) THEN** use a `ref` mirror. State for
  re-render, ref for logic.
- **IF an effect mutates a global / external state THEN** the cleanup
  must reverse it AND must fire on every dep change. Pair the
  mutation with a `ref` guard if it must fire only once.
- **IF an effect depends on `router.push()` completing THEN** don't
  set state in the same handler — defer state changes to after the
  navigation animation completes. (`docs/bugs.md` #32.)

### SSR + hydration

- **IF you need `localStorage` / `sessionStorage` THEN** read it in a
  `useEffect`, not in render. Initialize state to the SSR-safe default;
  hydrate from storage post-mount. Pattern in `lib/api/org-context.tsx`.
- **IF a value differs between server render and client first render
  THEN** wrap in `useEffect` or use `suppressHydrationWarning`
  surgically. Better: design so the value isn't computed during
  render.
- **IF using `Date.now()`, `Math.random()`, or `new Date()` in render
  THEN** stop. Pass these in as props from a deterministic source, or
  compute them in `useEffect`.

### Lists + keys

- **IF rendering a list THEN** key by stable identity (model id, slug),
  never `index`. Otherwise enter/exit animations and reordering break.
- **IF children of `AnimatePresence` lack `key`s THEN** add them.
  AnimatePresence can't track identity without; exit animations never
  play.

## Anti-Patterns

- **Sync-effect that wipes paginated state.** `useEffect(() => setItems
  (query.data?.items ?? []))` after the user has loaded 80 items via
  infinite scroll. Every background refetch resets to 20. (`docs/bugs.
  md` #30.)
- **`useState` in a touch handler that another handler reads.** Stale
  closure → reads old value → gesture never fires. (`docs/bugs.md`
  #19.)
- **Render-time `localStorage` read.** Hydration mismatch. Read in
  `useEffect`.
- **Setting global state during render without a guard.** Effect cleanup
  fires once; global stays mutated forever after the first re-render.
  (`docs/bugs.md` #44.)
- **`key={index}` for dynamic lists.** Breaks animations, triggers
  unnecessary remounts on insert.
- **`setState` after `router.push()`.** Re-render races the route
  transition; bfcache + TanStack hydration disrupted. Animate first,
  navigate after. (`docs/bugs.md` #32.)
- **Identity in a query key omitting the tenant.** Cross-tenant cache
  leakage on org switch. Always include `activeOrgSlug`.
- **Sync effect that compares with shallow object reference.** TanStack
  returns a new object reference per refetch even when content is
  identical; mirror effect runs anyway. Compare by ID set (`docs/
  bugs.md` #45).

## Review Checklist

- [ ] All tenant-scoped query keys include `activeOrgSlug`.
- [ ] No `useEffect(() => setState(query.data))` that replaces (not
      merges) accumulated state.
- [ ] No `useState` reads inside touch/drag handlers that read
      across callbacks — use a `ref` mirror.
- [ ] No `localStorage` / `sessionStorage` / `Date.now()` /
      `Math.random()` reads in render bodies — move to `useEffect`.
- [ ] Lists keyed by stable identity, not index.
- [ ] `AnimatePresence` children have `key` props.
- [ ] Global-state mutation in render has a `ref` guard preventing
      re-firing.
- [ ] No `setState` between `router.push()` and the page transition
      completing.
- [ ] `staleTime`, `retry`, `refetchOnWindowFocus` set explicitly per
      query when they matter (defaults come from `providers.tsx`).

## Agent Behavior Instructions

1. Before writing a `useEffect`, ask: "Why is this not just a derived
   value from props or query data?" Most effects are unnecessary.
2. When the user reports "data disappears" or "scroll resets" — first
   suspect a sync effect wiping paginated state.
3. When the user reports "gesture doesn't fire" — first suspect a
   stale closure in a cross-callback handler.
4. When proposing a TanStack Query hook, include the tenant slug in
   the key automatically. Cross-reference `lib/api/queries.ts` for the
   project pattern.
5. Cite `docs/bugs.md` entries when a known bug class appears in the
   proposal.

## Expected Output Format

For a new TanStack Query hook:

```ts
"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { useActiveOrg } from "@/lib/api/org-context"
import type { ReturnType } from "@/lib/types"

export function useResource(id: string): UseQueryResult<ReturnType> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["resource", activeOrgSlug, id],
    queryFn: ({ signal }) =>
      api.getResource(id, { signal, orgSlug: activeOrgSlug }),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })
}
```

For a handler that needs cross-callback state:

```tsx
const [dragX, setDragX] = useState(0)
const dragRef = useRef(0)

const onMove = useCallback((x: number) => {
  setDragX(x)        // re-render for visual
  dragRef.current = x  // ref for logic
}, [])

const onEnd = useCallback(() => {
  if (dragRef.current >= THRESHOLD) commitAction()
  setDragX(0)
  dragRef.current = 0
}, [])
```

## References

- React 19 release notes: https://react.dev/blog/2024/04/25/react-19
- TanStack Query: https://tanstack.com/query/latest
- Companion: `nextjs-16-app-router` (server/client boundary)
- Companion: `shadcn-ui-composition` (key + ref forwarding via asChild)
- Cross-ref: `docs/bugs.md` #19, #24, #29, #30, #32, #44, #45
- Cross-ref: `lib/api/queries.ts` (canonical hook pattern)
- Cross-ref: `lib/api/org-context.tsx` (canonical localStorage-via-effect)
