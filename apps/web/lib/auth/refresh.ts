/**
 * Server-side token refresh.
 *
 * Called by the API proxy when Django returns 401: try to mint a new
 * access token using the refresh-token cookie, then retry the original
 * request once. Transparent to the client when it works; surfaces the
 * 401 unchanged when it doesn't (the client-side handler then redirects
 * to /auth/login).
 *
 * Why server-side: the refresh token is httpOnly. Client JS can't see
 * it; refreshing has to happen here.
 */

import { getOidcConfig } from "@/lib/auth/oidc-config"

export interface RefreshResult {
  /** New access token to set in cookies + use on retry. */
  accessToken: string
  /** Lifetime in seconds — sets the cookie's maxAge. */
  expiresIn: number
  /** New refresh token if the IdP rotates; undefined otherwise. */
  refreshToken?: string
}

/**
 * Exchange a refresh_token for a new access_token at Authentik's /token.
 * Returns `null` on any failure (network, 4xx, malformed body) — caller
 * treats that as "session over, redirect to login".
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult | null> {
  const config = getOidcConfig()
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  let response: Response
  try {
    response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
  } catch {
    // Network failure reaching Authentik — fail closed, session ends.
    return null
  }

  if (!response.ok) return null

  try {
    const data = (await response.json()) as {
      access_token?: string
      expires_in?: number
      refresh_token?: string
    }
    if (!data.access_token) return null
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
      refreshToken: data.refresh_token,
    }
  } catch {
    return null
  }
}
