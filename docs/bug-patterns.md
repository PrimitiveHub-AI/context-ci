# Bug Patterns — Pre-Ship Scan

> **Purpose:** Generalized bug *patterns* (the class, not the instance)
> to scan against before shipping any new feature. Instance-level log
> lives in [`bugs.md`](./bugs.md); this file is the pattern catalog you
> grep before writing the code.
>
> **Discipline:** Before shipping a feature that touches auth, data,
> gestures, navigation, caching, or any tenant boundary — read the
> relevant section here. The patterns are derived from real bugs we
> (or our prior projects) hit. Each one is cheap to check, expensive
> to ship without.

## How to use

1. Find the section that matches what you're building (data layer,
   auth, frontend state, etc.).
2. Read the patterns.
3. For each pattern that could apply, run the named check.
4. If a pattern fits a known bug class, link it in the PR description
   so reviewers see you considered it.

---

## Section 1 — Tenant + authorization

### P1.1 — Cross-tenant queryset leak

**Pattern:** Any queryset accessing a tenant-scoped model that
omits the tenant filter leaks rows across orgs. The application
queryset filter is the first defense; Postgres RLS is the second.

**Check:** Does this query go through `_scoped_*(user)` (or
equivalent)? If you wrote `Model.objects.filter(slug=...)` without
an `organization__in=` clause, it's a leak.

**Defense in depth:** RLS catches it if active (per ADR-0006); the
`test_rls_actually_isolates.py` test catches a regression in the
policy itself.

### P1.2 — IDOR via direct ID lookup

**Pattern:** `Model.objects.get(pk=path_param)` without ownership
check returns rows from any tenant if the caller knows / guesses
the ID.

**Check:** Every endpoint with a user-controllable ID:
- Is the queryset tenant-scoped FIRST, then the ID lookup applied?
- Does cross-tenant access return 404 (NOT 403)?
- Is there a test asserting the 404 for cross-tenant?

### P1.3 — 401-not-403 confusion on un-authenticated reads

**Pattern:** Endpoints that should return 401 for anonymous
sometimes return 200 (with empty list) or 500 (middleware crashes
on `None` user).

**Check:** `@requires_auth` decorator present. Test that hits the
endpoint with `DEV_AUTH_BYPASS=False` asserts 401.

### P1.4 — Soft-delete flag not propagated to all querysets

**Pattern:** A new boolean (`deprecated_at`, `archived`,
`is_active=False`) is filtered in the primary list endpoint but
missed in: aggregates, stats, dashboards, exports, rate-limit
windows. Each missed location surfaces stale data.

**Check:** Grep the entire backend for every queryset on the
model. For each, decide: does this view represent "what the user
sees" (filter it) or "what actually happened" (leave it).
Document the decision per queryset.

### P1.5 — Restriction applied too broadly

**Pattern:** A flag intended to gate ONE action gets copied onto
adjacent buttons that look similar but aren't. Result: legitimate
user actions are silently blocked.

**Check:** Before adding `!feature.isRestricted` to a button's
guard, verify the action that button triggers is actually the one
the flag restricts. "Looks like a publish" ≠ "is a publish."

### P1.6 — Flag not checked on all surfaces

**Pattern:** A new boolean gates behavior on the primary surface
(e.g., the detail page hides Publish for archived primitives). Other
surfaces (registry card menu, search results, long-press) miss the
check. UI offers the action; backend rejects → broken expectation.

**Check:** When adding a UI guard, grep the entire frontend for
every button/menu/link that triggers the same action. Verify each
respects the flag.

---

## Section 2 — Data layer

### P2.1 — N+1 in serializer / view

**Pattern:** Any `_serialize_*` function (or Ninja schema field)
accessing `obj.fk.field` triggers one extra query per row unless
the queryset preloaded with `select_related` / `prefetch_related`.

**Check:** Grep the view's queryset for the FK path. If the
serializer reads `obj.primitive.organization.slug`, the queryset
needs `select_related("primitive__organization")`.

### P2.2 — Cache invalidation missing on mutation

**Pattern:** A cached computation (e.g., `profile_stats:{user_id}`)
is computed in one place but mutated in many. Tasks, signals, and
background jobs are the most-missed mutators.

**Check:** Define a "cache invalidation contract" per cache key:
which mutations must invalidate it? Grep the codebase for those
mutations and confirm each calls the invalidation.

### P2.3 — Race condition on one-time tokens

**Pattern:** Endpoints that consume a single-use token (password
reset, invite, attestation rotate) without `transaction.atomic()` +
`select_for_update()` on the token row can be double-spent under
concurrent requests.

**Check:** Pattern is:
```python
with transaction.atomic():
    token = Model.objects.select_for_update().get(value=token_str)
    if not token.is_valid(): raise HttpError(400)
    token.consume()
```

### P2.4 — `select_related` + `select_for_update` on nullable FK

**Pattern:** Combining `select_related("nullable_fk")` with
`select_for_update()` produces a LEFT OUTER JOIN. Postgres forbids
`FOR UPDATE` on the nullable side; task crashes.

**Check:** Grep for `select_related.*select_for_update`. If found,
remove `select_related` from the locking query; fetch related
objects after the atomic block.

### P2.5 — UPDATE on hot row instead of append-event

**Pattern:** A counter (downloads, views) implemented as
`Primitive.downloads += 1` on every read. Hot-row contention kills
throughput.

**Check:** For any counter / metric / aggregate, prefer append an
event row + aggregate hourly. Per `ddia-multi-tenant` § "Counters".

### P2.6 — Migration drop without rolling-deploy safety

**Pattern:** A migration that drops a column shipped in the same
deploy as code that stops using it. Mid-deploy, old-code pods still
read the column → 500s.

**Check:** Multi-deploy migration: deploy 1 stops writing/reading;
deploy 2 drops the column. Per `ddia-multi-tenant` § Schema evolution.

---

## Section 3 — Frontend state + effects

### P3.1 — Sync effect wipes paginated state

**Pattern:** `useEffect(() => setItems(query.data?.items ?? []))`.
On refetch, the local state (which accumulated 80 items via
infinite scroll) is replaced with 20. Scroll position lost; blank
screen below header.

**Check:** Does the local state accumulate beyond what one query
returns? If yes, the sync effect must MERGE, not replace. Functional
updater compares lengths / IDs and preserves the tail.

### P3.2 — Stale closure in event handler

**Pattern:** `useCallback` captures state at creation time. If
`onTouchMove` sets state and `onTouchEnd` reads it, the read sees
the OLD value. Result: gesture appears to work visually but
threshold check uses 0.

**Check:** For cross-callback state, use a `ref` mirror. State for
re-render, ref for logic.

### P3.3 — Render-time global mutation without re-fire guard

**Pattern:** Code in the render body sets a global (e.g.,
`MotionGlobalConfig.skipAnimations = true`). The cleanup effect has
`[]` deps → fires once → next re-render mutates again → cleanup
never re-runs → global stays mutated permanently.

**Check:** Render-time global mutation needs a `ref` guard that
prevents re-mutation, OR move the mutation into an effect.

### P3.4 — `localStorage` / `sessionStorage` read in render

**Pattern:** `const stored = localStorage.getItem(K)` at the top of
a component → SSR returns one value, client first render returns
another → hydration mismatch.

**Check:** Read storage in `useEffect` after mount; initialize
state to the SSR-safe default. Pattern in `lib/api/org-context.tsx`.

### P3.5 — `setState` between `router.push()` and route transition

**Pattern:** A gesture handler calls `router.back()` then
`setState(0)`. The re-render races the route transition; bfcache
and TanStack hydration are disrupted; destination loads fresh
instead of from cache.

**Check:** Complete visual animations BEFORE navigation, not after.
Pattern: animate to off-screen → `setTimeout(duration)` → navigate.

### P3.6 — URL search params name mismatch

**Pattern:** Source builds `?replyTo=X` but destination reads
`searchParams.get("replyToId")`. Silently ignored — no error, no
crash, feature just doesn't work.

**Check:** When wiring `router.push("?param=value")`, grep the
destination for `searchParams.get(...)` and confirm exact name
match.

### P3.7 — Sync effect rerenders cascade with identical data

**Pattern:** `setState(query.data)` creates a new array reference
every refetch; React triggers re-render of every list item. With
hundreds of items, the main thread stalls.

**Check:** Functional updater compares by ID set; returns `prev` if
identical. React skips the re-render.

---

## Section 4 — UI guards + context menus

### P4.1 — Context menu action skips guards the page enforces

**Pattern:** The page button enforces 4 guards
(`!isDeprecated && hasPermission && !isLocked && isOwner`). The
long-press menu only checks 2. User taps the menu's "Edit" on a
deprecated primitive; page rejects with confusing error.

**Check:** When adding actions to a context menu, find the manual
trigger on the page and copy every guard. Diff the two — if the
menu has fewer checks, it's a bypass.

### P4.2 — Effect auto-trigger skips manual-trigger guards

**Pattern:** `?action=edit` URL param auto-opens an edit sheet.
The effect checks 2 conditions; the manual Edit button checks 4.
Crafted URL bypasses 2 of the guards.

**Check:** Auto-triggering effects must enforce the SAME guards as
the manual trigger. Copy the conditions; never trust the URL.

### P4.3 — Frontend preset out of backend validation range

**Pattern:** UI dropdown offers values that the backend rejects.
User picks "value", request fires, backend 400s. UI never recovers
gracefully.

**Check:** When adding presets, cross-check the backend validator
(serializer / Pydantic schema / Django field constraint). Every UI
option must be within bounds.

---

## Section 5 — Auth + sessions

### P5.1 — Authentik bootstrap env vars only apply on first init

**Pattern:** `AUTHENTIK_BOOTSTRAP_PASSWORD` is set in compose env;
admin password rejects that value. Reason: bootstrap ran before the
env var was set; user was created with defaults.

**Check:** If admin login fails with stated bootstrap password,
reset via `ak shell` (see `apps/web/README.md` troubleshooting).
For new clusters, confirm env vars are present BEFORE first start.

### P5.2 — Reputation policy lockout disguises itself as bad password

**Pattern:** Authentik's default flow includes a reputation policy.
After ~3 failed attempts from one IP, subsequent logins return
"Invalid password" even with the correct password.

**Check:** Clear via `Reputation.objects.all().delete()` in `ak
shell`. Documented in `apps/web/README.md`.

### P5.3 — OIDC same-issuer fails in compose-dev

**Pattern:** Setting one `OIDC_ISSUER_URL` either breaks the
browser redirect (can't resolve `authentik-server`) or the
server-side `/token` POST (container `localhost` is itself).

**Check:** Two-issuer model — `OIDC_ISSUER_URL` (server) +
`OIDC_BROWSER_ISSUER_URL` (browser). ADR-0009.

### P5.4 — `docker compose restart` doesn't reload env_file

**Pattern:** Edit `.env`, run `restart`, container env still shows
old value. `restart` reuses the existing process; env_file is read
at create.

**Check:** After `.env` changes, use `docker compose up -d
--no-deps --force-recreate <service>`.

### P5.5 — Compose `environment:` with empty default overrides env_file

**Pattern:** `S3_ENDPOINT_URL: ${S3_ENDPOINT_URL:-}` in
`compose.yaml` resolves to empty string when the host doesn't have
the var, AND that empty string overrides what env_file would have
injected.

**Check:** For secrets meant to come from env_file, DON'T include
them in the `environment:` block of compose.yaml. Documented in
`docker-compose-discipline` primitive.

---

## Section 6 — Styling + positioning

### P6.1 — CSS `transform` creates containing block; breaks `position: fixed`

**Pattern:** Applying `transform: translateX()` on any ancestor
creates a new containing block. Descendants with `position: fixed`
resolve relative to that ancestor (not the viewport). Combined
with `overflow: hidden`, the fixed child is clipped.

**Check:** Before applying transforms (CSS or `motion.div style={{ x
}}`), grep descendants for `position: fixed` / `position: sticky`.
If present, portal the overlay to `document.body` via React's
`createPortal`.

### P6.2 — `position: sticky` breaks under transformed ancestor

**Pattern:** Same root cause as P6.1 but with `sticky` — stops
sticking when the ancestor uses CSS transforms.

**Check:** Either skip the transform, or restructure so the sticky
element is outside the transformed container.

---

## Section 7 — Privacy + content

### P7.1 — Sealed/unverified content leaks via API list endpoint

**Pattern:** An endpoint returns a list of objects. Some are in a
"not-yet-visible" state. The list serializer doesn't strip those
objects' content fields. Client sees them anyway.

**Check:** For any status that gates visibility, the list serializer
must strip content fields when the object is in the gated state.
Defense in depth: frontend should also filter.

### P7.2 — `navigator.share()` on private content

**Pattern:** A long-press menu includes "Share" using
`navigator.share({ text: primitive.body })`. Leaks content to
external apps.

**Check:** Never `navigator.share()` private content. For
public-only artifacts (a published+attested primitive's public
URL), sharing the URL is fine; sharing the body is not.

---

## Section 8 — Build + CI

### P8.1 — `pytest --create-db` drops role grants

**Pattern:** pytest-django default drops and recreates the test DB.
Any role grants applied to the test DB outside migrations vanish
on the next test run.

**Check:** Use `--reuse-db` in pyproject.toml when test DB has
role-level state. (`docs/bugs.md` #14.)

### P8.2 — Wrong DJANGO_SETTINGS_MODULE

**Pattern:** Container env sets `DJANGO_SETTINGS_MODULE=
primitivehub_api.settings`; pyproject specifies settings_test;
pytest uses the container env (env wins over pyproject).

**Check:** Force the test settings via `--ds=` in pytest addopts.
Don't rely on the env precedence.

### P8.3 — Smoke tests that don't load models hide import bugs

**Pattern:** Tests only hit `/healthz` and `/whoami` — never touch
a model. Import errors in model files (`from apps.X` when X doesn't
exist) never surface.

**Check:** Run `manage.py check --fail-level WARNING` as a separate
verification step. It loads all apps and surfaces import errors
that smoke tests miss.

---

## How to add a pattern

When `docs/bugs.md` accumulates 3+ instances of the same underlying
class — write the pattern here. Generalize the bug into the check
that would have prevented it. Link the instance entries.

Patterns get folded into primitives (`apps/web/content/primitives/*`)
when they become rules instead of checks — i.e., when the project
should never make the call rather than checking before each call.
