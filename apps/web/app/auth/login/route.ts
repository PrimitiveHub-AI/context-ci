/**
 * Initiates the OIDC Authorization Code + PKCE flow.
 *
 * 1. Generate a PKCE verifier/challenge pair and a random state.
 * 2. Store the verifier + state + return-to URL in short-lived httpOnly
 *    cookies (so the callback can validate them).
 * 3. Redirect the browser to Authentik's /authorize endpoint with the
 *    challenge.
 *
 * Authentik authenticates the user (form-based, or via a federated
 * IdP if configured), then redirects back to /auth/callback with a
 * one-time code + the same state.
 */

import { NextRequest, NextResponse } from "next/server"

import { COOKIES, SHORT_LIVED_OPTIONS } from "@/lib/auth/cookies"
import { getOidcConfig } from "@/lib/auth/oidc-config"
import { generatePkcePair, generateState } from "@/lib/auth/pkce"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const config = getOidcConfig()
  const { verifier, challenge } = generatePkcePair()
  const state = generateState()

  // Where to send the user after a successful login. Falls back to the
  // registry page so login lands somewhere immediately useful.
  const returnTo = request.nextUrl.searchParams.get("return") ?? "/registry"

  const authorizeUrl = new URL(config.authorizeEndpoint)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", config.clientId)
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizeUrl.searchParams.set("scope", config.scopes)
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("code_challenge", challenge)
  authorizeUrl.searchParams.set("code_challenge_method", "S256")

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(COOKIES.pkceVerifier, verifier, SHORT_LIVED_OPTIONS)
  response.cookies.set(COOKIES.oauthState, state, SHORT_LIVED_OPTIONS)
  response.cookies.set(COOKIES.returnTo, returnTo, SHORT_LIVED_OPTIONS)
  return response
}
