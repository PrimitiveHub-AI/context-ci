/**
 * Cookie names + standard options.
 *
 * Naming: `pa.*` (PrimitiveAuth) so they're greppable and easy to clear
 * en-masse on logout.
 *
 * Security defaults:
 *   - httpOnly:  always — tokens never reach client JS (XSS-safe)
 *   - sameSite:  "lax" — strict would break the auth redirect from
 *                Authentik; lax allows top-level GET nav cookies
 *   - secure:    true in production (NODE_ENV); false in dev so localhost
 *                http works without TLS
 *   - path:      "/" — apiFetch makes requests to /api/v1/* so cookies
 *                must apply across the whole app
 */

export const COOKIES = {
  accessToken: "pa.access_token",
  refreshToken: "pa.refresh_token",
  pkceVerifier: "pa.pkce_verifier",
  oauthState: "pa.oauth_state",
  returnTo: "pa.return_to",
} as const

const isProd = process.env.NODE_ENV === "production"

export interface CookieOptions {
  httpOnly: boolean
  sameSite: "lax" | "strict" | "none"
  secure: boolean
  path: string
  maxAge: number
}

const BASE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/",
} as const

export const SHORT_LIVED_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  maxAge: 60 * 5, // 5 min — covers the user redirecting to Authentik + back
}

export const ACCESS_TOKEN_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  maxAge: 60 * 60, // 1 hour — refresh-token flow can extend later
}

export const REFRESH_TOKEN_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  maxAge: 60 * 60 * 24 * 7, // 1 week
}
