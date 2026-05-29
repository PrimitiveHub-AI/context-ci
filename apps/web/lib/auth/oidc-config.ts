/**
 * OIDC configuration — read once, frozen.
 *
 * All values come from environment variables. None of them is a secret
 * EXCEPT `OIDC_CLIENT_SECRET`, which is server-side only (no
 * `NEXT_PUBLIC_` prefix, so it stays out of the client bundle).
 *
 * Required in production. In dev, missing values surface as a clear
 * error from `/auth/login` rather than a silent fallback.
 */

interface OidcConfig {
  issuerUrl: string
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
        `Configure Authentik per apps/web/.env.example and restart the dev server.`,
    )
  }
  return value
}

export function getOidcConfig(): OidcConfig {
  for (const name of REQUIRED_ENV) requireEnv(name)
  const issuer = requireEnv("OIDC_ISSUER_URL").replace(/\/+$/, "")
  return {
    issuerUrl: issuer,
    authorizeEndpoint: `${issuer}/authorize/`,
    tokenEndpoint: `${issuer}/token/`,
    endSessionEndpoint: `${issuer}/end-session/`,
    clientId: requireEnv("OIDC_CLIENT_ID"),
    clientSecret: requireEnv("OIDC_CLIENT_SECRET"),
    redirectUri: requireEnv("OIDC_REDIRECT_URI"),
    postLogoutRedirectUri:
      process.env.OIDC_POST_LOGOUT_REDIRECT_URI ?? "http://localhost:3000/",
    scopes: process.env.OIDC_SCOPES ?? "openid profile email",
  }
}
