/**
 * Logout — clears the local session cookies and (optionally) calls
 * Authentik's end-session endpoint to invalidate the IdP-side session.
 *
 * Without the end-session call, the user would stay signed in to
 * Authentik and a subsequent `/auth/login` would silently re-authenticate
 * without a password prompt. The redirect-back via
 * `post_logout_redirect_uri` brings the user back to PrimitiveHub.
 */

import { NextRequest, NextResponse } from "next/server"

import { COOKIES } from "@/lib/auth/cookies"
import { getOidcConfig } from "@/lib/auth/oidc-config"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  const config = getOidcConfig()
  const endSession = new URL(config.endSessionEndpoint)
  endSession.searchParams.set(
    "post_logout_redirect_uri",
    config.postLogoutRedirectUri,
  )
  endSession.searchParams.set("client_id", config.clientId)

  const response = NextResponse.redirect(endSession)
  // Clear all auth cookies regardless of whether Authentik redirect
  // succeeds — local session is gone either way.
  response.cookies.delete(COOKIES.accessToken)
  response.cookies.delete(COOKIES.refreshToken)
  response.cookies.delete(COOKIES.pkceVerifier)
  response.cookies.delete(COOKIES.oauthState)
  response.cookies.delete(COOKIES.returnTo)
  return response
}
