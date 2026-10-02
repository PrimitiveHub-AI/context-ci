---
name: feedback-self-audit
description: "Self-audit checklist — apply to my own deployed work before reporting \"done\" to the user"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Before reporting any work as "done" to the user, run the self-audit checklist. This catches the mistakes that *look* fine in isolation but break in production-adjacent scenarios. The user has lost faith in "done" claims from prior AI work; this checklist rebuilds it.

**Universal checks (run on every change):**

- **Destructive actions.** Did I delete files, drop branches, force-push, run `rm -rf`, drop tables, withdraw published primitives, or invalidate signed attestations? If yes, was the user authorization explicit and per-action, not session-wide?
- **URL / param mismatches.** Did I leave a URL pattern that the page doesn't actually serve? A `Link href="/foo"` to a route that doesn't exist? A `searchParams` access without `await`?
- **Stale state in effects.** Did I leave `useEffect` dependencies wrong, causing reruns I didn't predict? Or skip a dep that should trigger reruns?
- **Filter counts vs visible items.** If I added pagination or filtering, do the count badges match what's actually visible? A "12 primitives" header next to 5 rendered cards is a bug.
- **Swipe / gesture without dismiss.** (Less applicable to PrimitiveHub's desktop-first surface, but still: any interactive gesture without a clear dismiss/undo?)
- **Dead code.** Did I leave a commented-out block, an unused import, a dead branch in a switch?
- **No fake numbers as fact.** Every metric on a UI surface must be reproducible OR labeled `<DemoDataBadge>`. (See [[feedback-no-fake-numbers]].)
- **Localhost-only binding.** Any dev server I started binds to `127.0.0.1`, never `0.0.0.0`. (See [[feedback-localhost-only]].)
- **Containerized everything.** Any new service runs in Docker; no host installs. (See [[feedback-containerize]].)
- **pnpm only.** Never `npm install`. (See [[feedback-pnpm]].)
- **Memory of held code.** I did NOT delete code marked "held for next phase" — held ≠ dead. (See [[feedback-never-delete-held-code]].)

**Per-PR checks:**

- **Build chain green.** `pnpm check:data` + `pnpm typecheck` + `pnpm build` (or the api equivalents) all pass.
- **No `outline: none` without `focus-visible:`.** (See `accessibility-wcag22`.)
- **No new colors outside the palette.** (See `tailwind-v4-mastery` + `DESIGN.md`.)
- **Spec-conformant primitives.** Anything in `apps/web/content/primitives/` passes the Workbench validator.
- **Cross-references updated.** If a primitive moved or renamed, CLAUDE.md, DESIGN.md, and the `feedback_load_primitives` memory all reference the new path.
- **Bugs.md / bug-patterns scan.** Did this change touch a class of bug previously logged? If yes, the relevant pattern check was run. If the fix prevents a known pattern from recurring, an entry in [`docs/bugs.md`](/srv/primitivehub/app/docs/bugs.md) lands BEFORE the merge.

**Backend / data-layer extras (run when the change touches Django / Postgres / Ninja):**

- **Tenant scoping at every endpoint.** Did each new queryset go through `_scoped_*(user)` or include `organization__in=`? Did `requires_auth` decorator wrap each? Is the IDOR test (404 not 403 for cross-tenant) present? (See `docs/bug-patterns.md` § P1.1-P1.2.)
- **N+1 query check.** Every new serializer field that reads `obj.fk.field` — does the queryset preload via `select_related` / `prefetch_related`? (P2.1.)
- **One-time token race.** Any endpoint that consumes a single-use token wraps in `transaction.atomic()` + `select_for_update()`? (P2.3.)
- **`select_related` + `select_for_update` on nullable FKs.** Did I grep for this combination? It crashes Postgres silently. (P2.4.)
- **Soft-delete flag propagated.** New boolean filter applied to every queryset that surfaces the model? Including aggregates, dashboards, exports? (P1.4.)
- **Migration rolling-deploy-safe.** Drop / rename is in a separate deploy from the code that stops using the column? (P2.6.)
- **Cache invalidation contract.** Any new mutation that changes a cached computation invalidates the right keys for BOTH parties (when a relationship changes)? (P2.2.)
- **RLS still enforces.** If touching tenant tables, does `test_rls_actually_isolates.py` still pass? (ADR-0006.)

**Frontend state / React extras (run when the change touches TanStack Query / hooks / effects):**

- **Tenant slug in query keys.** Every TanStack query key for a tenant-scoped resource includes `activeOrgSlug`. (P3.x via `react-19-patterns`.)
- **Sync effect merges, not replaces.** If a `useEffect` mirrors query data into local state, does it merge (preserving paginated tail) or replace? Replace pattern wipes accumulated data on refetch. (P3.1.)
- **No stale closures in handlers.** Any cross-callback state in touch / drag / async chains uses a `ref` mirror. (P3.2.)
- **No `localStorage` / `Date.now()` / `Math.random()` reads in render.** Moved to `useEffect`. (P3.4.)
- **Render-time global mutations have a `ref` guard.** Otherwise re-renders re-mutate and effect cleanup with `[]` deps fires once. (P3.3.)
- **No `setState` between `router.push()` and route transition.** Animate first, navigate after. (P3.5.)
- **CSS transform check.** Before applying a transform to a container, descendants searched for `position: fixed` / `position: sticky`. (P6.1-P6.2.)

**Auth + sessions extras (run when the change touches OIDC / Authentik / cookies):**

- **Token storage stays httpOnly.** No client-side JS access to access/refresh tokens.
- **Same-origin proxy on path.** Frontend calls go to `/api/v1/*`, not directly to Django.
- **Two-issuer model preserved.** Server-facing URL uses docker service name; browser-facing URL uses host port mapping. (ADR-0009.)
- **State + PKCE on every login.** No OAuth redirect without both.
- **`docker compose up -d --force-recreate` after env_file changes.** Not `restart`. (P5.4.)

**Why:** This is the user's explicit working rule. Failing to self-audit is failing to do the job.

**How to apply:**
- Before the final response in a substantive turn, walk this list.
- For each item, mark `[✓]` or `[N/A]` or `[FOUND]` (with the fix or the surfacing).
- Surface anything `FOUND` to the user explicitly. Don't quietly fix and pretend it never existed — that erodes their trust in audit reports.

Related: [[feedback-audit-methodology]], [[feedback-bloat-control]], [[feedback-no-fake-numbers]]
