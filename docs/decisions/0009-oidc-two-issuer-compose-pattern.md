# ADR-0009: OIDC two-issuer model for compose-dev networking

**Status:** Accepted
**Date:** 2026-05-30

## Context

Step 7 wired the real OIDC Authorization Code + PKCE flow against
Authentik (ADR-0007). The first end-to-end attempt failed with one of
two symptoms depending on which value we put in `OIDC_ISSUER_URL`:

- `OIDC_ISSUER_URL=http://localhost:9000/...` → server-side `/token`
  POST failed with "connection refused". The `web` container's
  `localhost` is the container itself; Authentik isn't there.
- `OIDC_ISSUER_URL=http://authentik-server:9000/...` → browser hung
  on the `/authorize` redirect. The user's host can't resolve
  `authentik-server` — that's a compose-internal hostname.

OIDC issuer URL serves two distinct callers with different network
positions. They need different URLs.

## Decision

Two env vars:

- `OIDC_ISSUER_URL` — server-facing. Used by the web container for the
  POST to `/token` and (optionally) the redirect to `/end-session/`
  when end-session is server-driven. Reaches Authentik via the
  compose service hostname.
- `OIDC_BROWSER_ISSUER_URL` — browser-facing. Used to construct the
  `/authorize` redirect URL and the `/end-session` URL when the user
  is sent there via a redirect. Uses the host-port-mapped URL.

In production with a single public hostname for both browser and
backend, `OIDC_BROWSER_ISSUER_URL` is left unset and defaults to
`OIDC_ISSUER_URL`.

Implemented in `apps/web/lib/auth/oidc-config.ts` with:

```ts
authorizeEndpoint:    `${browserIssuer}/authorize/`
tokenEndpoint:        `${serverIssuer}/token/`
endSessionEndpoint:   `${browserIssuer}/end-session/`
```

The `oidc-config.ts` header comment + the README "Why the two-issuer
model" section both document the failure modes if anyone re-merges the
two.

## Alternatives considered

1. **Same hostname everywhere** — Configure Authentik to be reachable
   at the same hostname from both contexts (e.g., add
   `authentik-server` to the host's `/etc/hosts`, point at 127.0.0.1).
   Rejected because:
   - Requires per-host setup for every developer.
   - Doesn't solve the prod story (where browser sees public DNS, server
     sees internal hostname).
   - Hacky; the two-issuer model is the canonical fix.

2. **Browser redirect via Next.js proxy** — Have the browser hit
   `http://localhost:3000/oidc/authorize` and have Next 302-redirect
   to Authentik's actual `/authorize` URL. Rejected because:
   - Adds a hop the user notices in the address bar.
   - Doesn't actually fix the underlying duality; the redirect URL still
     needs to be reachable by the browser.

3. **Authentik reverse-proxied through Next** — Put Authentik behind
   the same Next.js origin so localhost:3000/auth/* maps to Authentik.
   Rejected because:
   - Authentik becomes a sub-path of Next; complicates Authentik's
     own routing assumptions.
   - Doesn't generalize to prod where Authentik lives at its own
     subdomain.

4. **Hardcode both URLs in code** — Reject for the same reason we
   don't hardcode any env-dependent value.

## Consequences

**Positive:**
- Works in compose-dev (where browser and server have different views
  of Authentik) and in prod (where they share one view) with the same
  code path.
- The model is documented exactly once (`oidc-config.ts` header +
  README + this ADR), so future engineers don't re-derive it from
  failure.
- New developers can follow the README's two-issuer `.env` block and
  the flow works on first try.

**Negative:**
- Two env vars instead of one. Mitigation: prod doesn't need to set
  the override; it falls back cleanly.
- If `OIDC_BROWSER_ISSUER_URL` and `OIDC_ISSUER_URL` resolve to different
  Authentik instances by mistake, the user gets a confusing failure
  (the token from one instance won't validate at the other). Mitigation:
  the README warns to keep both pointing at the same logical Authentik.

## References

- `apps/web/lib/auth/oidc-config.ts` — implementation + header comment.
- `apps/web/README.md` § Why the two-issuer model — explains failure
  modes.
- `apps/web/.env.example` — both vars present with comments.
- `docs/bugs.md` #1 — the discovery + diagnosis trail.
- ADR-0007 — Authentik chosen as the OIDC provider.
