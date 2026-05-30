# ADR-0010: Tokens in httpOnly cookies + same-origin Next.js proxy

**Status:** Accepted
**Date:** 2026-05-30

## Context

After OIDC sign-in, the frontend has an access token (and refresh
token) and needs to attach them to every API call. Three patterns
exist:

1. **localStorage / sessionStorage** — Client JS reads tokens, attaches
   them as Bearer headers. Convenient. **XSS-vulnerable by
   construction** — any malicious script in the page can read the
   token.

2. **In-memory only** — Tokens held in a React context. Survives
   page lifetime but not refreshes. No XSS surface BUT terrible UX
   (every reload = re-auth).

3. **httpOnly cookies + same-origin proxy** — Tokens stored as cookies
   the browser sends automatically; client JS cannot read them
   (`httpOnly` flag). API requests go to the same Next.js origin,
   which proxies to the Django backend and attaches the Authorization
   header server-side.

PrimitiveHub's threat model includes "compromised author with stolen
session" and "XSS via malicious primitive content rendered in the
Workbench". Token theft via XSS is a class we must defend against.

## Decision

**httpOnly cookies + same-origin Next.js proxy.**

- `pa.access_token` and `pa.refresh_token` cookies are set by the
  `/auth/callback` route handler with `httpOnly: true; sameSite: lax;
  secure (in prod); path: /`.
- The frontend's `apiFetch` calls `/api/v1/*` (same origin). Cookies
  are sent automatically.
- The Next.js route `apps/web/app/api/v1/[...path]/route.ts` reads the
  access-token cookie, attaches `Authorization: Bearer <token>`, and
  forwards to the Django backend.
- Hop-by-hop headers (Connection, Transfer-Encoding) and `Set-Cookie`
  from Django are stripped — only Next sets cookies on this origin.
- Transparent refresh: on 401 from Django, the proxy attempts a
  refresh via Authentik's `/token` with `grant_type=refresh_token`,
  retries the original request once, and updates the access-token
  cookie on success. (See ADR-0010-adjacent: Step 8 / auth-polish.)

## Alternatives considered

1. **localStorage + Authorization header from client** — Simplest
   wiring. Rejected because:
   - XSS-vulnerable. A single malicious script can read the token,
     bypass any in-app auth check, and impersonate the user.
   - The Workbench renders user-controllable markdown. Even with
     scrubbing, the XSS surface area is non-trivial.

2. **In-memory only** — XSS-safe (tokens don't survive a page refresh)
   but UX is terrible. Users would re-auth on every reload. Rejected.

3. **localStorage for access token, httpOnly cookie for refresh
   token** — Compromise. Access token is XSS-readable; refresh token
   isn't. Rejected because the XSS that reads the access token can
   also exfiltrate live API data while the access token is valid;
   the refresh-token protection limits damage but doesn't prevent it.

4. **httpOnly cookies BUT no proxy** — Cookies + CORS so the browser
   sends them to Django directly. Rejected because:
   - CORS preflight overhead on every API call.
   - Cookies for a different origin (3000 vs 8000) require third-party-
     cookie permission in modern browsers, which Safari and Firefox
     are increasingly hostile toward.
   - Same-origin via Next.js proxy avoids all of this AND positions us
     for prod where browser + backend share an origin.

## Consequences

**Positive:**
- XSS-safe by construction. A malicious script in the page can't read
  the access token even if it executes.
- Same-origin = no CORS, no third-party-cookie permission, no preflight.
- The proxy is the natural place for transparent token refresh —
  refresh logic lives once (`apps/web/lib/auth/refresh.ts`) instead of
  in every client call site.
- Future programmatic API access (CLI, service-to-service) can use
  Authorization headers directly (skipping the proxy) without changing
  the cookie-based browser path.

**Negative:**
- More moving parts: the proxy route, cookie helpers, refresh logic.
  Code review surface is larger than localStorage would be.
- Body capture for retry: request bodies are streams that can't be
  re-read. We `await request.arrayBuffer()` once and replay the buffer
  on the refresh-retry path. Memory cost is proportional to body size;
  uploads are capped at 1 MiB (PRIMITIVE_MAX_BYTES), so it's fine.
- ATOMIC_REQUESTS in the backend + the test fixture's SET ROLE pattern
  interact — required ATOMIC_REQUESTS=False in tests (see ADR-0006
  consequences).

## References

- `apps/web/lib/auth/cookies.ts` — cookie name + option constants.
- `apps/web/lib/auth/refresh.ts` — transparent refresh helper.
- `apps/web/app/auth/login/route.ts` — sets transient PKCE + state +
  return-to cookies.
- `apps/web/app/auth/callback/route.ts` — exchanges code for tokens,
  sets access + refresh cookies.
- `apps/web/app/auth/logout/route.ts` — clears all auth cookies +
  redirects to Authentik end-session.
- `apps/web/app/api/v1/[...path]/route.ts` — the proxy itself.
- `apps/web/lib/api/client.ts` — `apiFetch` calls same-origin
  `/api/v1/*`.
- `apps/web/content/primitives/security-engineering-supplychain.md`
  § Side-channel metadata budget — tokens that can't be read by JS
  also can't be read by side-channel scripts.
- ADR-0007 — Authentik as the OIDC provider.
- ADR-0009 — Two-issuer model that makes the proxy + browser work
  together in compose.
- `docs/bugs.md` #1, #3 — discoveries from the OIDC integration that
  led to the current cookie + proxy shape.
