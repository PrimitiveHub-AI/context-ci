/**
 * OIDC configuration — read once, frozen.
 *
 * Two-issuer model (load-bearing for compose dev)
 * -----------------------------------------------
 * Browser-facing and server-facing endpoints live at DIFFERENT hostnames
 * in compose:
 *   - The browser redirects to Authentik via `localhost:9000` (the host
 *     port mapping). It can't resolve `authentik-server` — that's a
 *     compose-internal name.
 *   - Server-side code (e.g. `/auth/callback` POSTing the code for
 *     tokens) runs inside the `web` container and reaches Authentik via
 *     the compose service name `authentik-server:9000`. It can't reach
 *     `localhost:9000` — localhost inside the container is the container
 *     itself.
 *
 * Without separating these, you get one of two symptoms:
 *   - `OIDC_ISSUER_URL=http://localhost:9000/...` → server-side token
 *     exchange fails with "connection refused" (the container loops
 *     back to itself, no Authentik there).
 *   - `OIDC_ISSUER_URL=http://authentik-server:9000/...` → browser hangs
 *     on /authorize redirect (host can't resolve `authentik-server`).
 *
 * Solution: `OIDC_ISSUER_URL` is server-facing (used for /token,
 * end-session). `OIDC_BROWSER_ISSUER_URL` overrides the browser-facing
 * /authorize endpoint. In production (single hostname for both
 * browser + backend), leave the override unset.
 *
 * Secrets policy
 * --------------
 * `OIDC_CLIENT_SECRET` is server-only (no `NEXT_PUBLIC_` prefix).
 * Required in production. In dev, missing values surface as a clear
 * error from `/auth/login` rather than a silent fallback.
 */

interface OidcConfig {
  /** Server-facing endpoints (web container → Authentik). */
  authorizeEndpoint: string
  tokenEndpoint: string
  endSessionEndpoint: string
  clientId: string
  clientSecret: string
  redirectUri: string
  postLogoutRedirectUri: string
  scopes: string
}

const REQUIRED_ENV = [
  "OIDC_ISSUER_URL",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_REDIRECT_URI",
] as const

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `OIDC_LOGIN: missing required env var ${name}. ` +
        `Configure Authentik per apps/web/README.md and restart the dev server.`,
    )
  }
  return value
}

export function getOidcConfig(): OidcConfig {
  for (const name of REQUIRED_ENV) requireEnv(name)
  const serverIssuer = requireEnv("OIDC_ISSUER_URL").replace(/\/+$/, "")
  const browserIssuer = (
    process.env.OIDC_BROWSER_ISSUER_URL ?? serverIssuer
  ).replace(/\/+$/, "")
  return {
    // /authorize MUST be reachable from the browser → use browserIssuer.
    authorizeEndpoint: `${browserIssuer}/authorize/`,
    // /token + end-session run server-side from the web container.
    tokenEndpoint: `${serverIssuer}/token/`,
    endSessionEndpoint: `${browserIssuer}/end-session/`,
    clientId: requireEnv("OIDC_CLIENT_ID"),
    clientSecret: requireEnv("OIDC_CLIENT_SECRET"),
    redirectUri: requireEnv("OIDC_REDIRECT_URI"),
    postLogoutRedirectUri:
      process.env.OIDC_POST_LOGOUT_REDIRECT_URI ?? "http://localhost:3000/",
    scopes: process.env.OIDC_SCOPES ?? "openid profile email",
  }
}
