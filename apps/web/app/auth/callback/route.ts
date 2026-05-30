/**
 * OIDC callback — exchanges the authorization code for access + refresh
 * tokens, sets them as httpOnly cookies, and redirects to the original
 * return-to URL.
 *
 * Security checks
 *   - `state` cookie must match the `state` query parameter (CSRF)
 *   - `code` and PKCE verifier are both required
 *   - Token-endpoint POST is server-side; client_secret never reaches
 *     the browser
 */

import { NextRequest, NextResponse } from "next/server"

import {
  ACCESS_TOKEN_OPTIONS,
  COOKIES,
  REFRESH_TOKEN_OPTIONS,
} from "@/lib/auth/cookies"
import { getOidcConfig } from "@/lib/auth/oidc-config"

export const dynamic = "force-dynamic"

function failureResponse(reason: string): NextResponse {
  // Brief HTML error page. Production polish: a real error route at
  // /auth/error?reason=... that renders inside the shell. Acceptable
  // for v1 because most failures are user-correctable (clock skew,
  // back-button replay, etc.).
  const body = `<!doctype html><html><body style="font-family: monospace; padding: 2rem;">
    <h1>Sign-in failed</h1>
    <p>${reason}</p>
    <p><a href="/">Return home</a></p>
  </body></html>`
  return new NextResponse(body, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(request: NextRequest) {
  const config = getOidcConfig()

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  if (!code || !state) return failureResponse("Missing code or state.")

  const storedState = request.cookies.get(COOKIES.oauthState)?.value
  const verifier = request.cookies.get(COOKIES.pkceVerifier)?.value
  const returnTo = request.cookies.get(COOKIES.returnTo)?.value ?? "/registry"

  if (!storedState || storedState !== state)
    return failureResponse("State mismatch — possible CSRF; sign in again.")
  if (!verifier) return failureResponse("Missing PKCE verifier; sign in again.")

  // Exchange the code for tokens at Authentik's /token endpoint.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: verifier,
  })

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text()
    return failureResponse(`Token exchange failed: ${errorBody}`)
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
  }

  // Set the token cookies + clear the transient ones from /login.
  const response = NextResponse.redirect(new URL(returnTo, request.nextUrl.origin))
  response.cookies.set(COOKIES.accessToken, tokens.access_token, {
    ...ACCESS_TOKEN_OPTIONS,
    maxAge: tokens.expires_in ?? ACCESS_TOKEN_OPTIONS.maxAge,
  })
  if (tokens.refresh_token) {
    response.cookies.set(
      COOKIES.refreshToken,
      tokens.refresh_token,
      REFRESH_TOKEN_OPTIONS,
    )
  }
  response.cookies.delete(COOKIES.pkceVerifier)
  response.cookies.delete(COOKIES.oauthState)
  response.cookies.delete(COOKIES.returnTo)
  return response
}
