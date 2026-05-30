/**
 * Same-origin Django proxy with transparent token refresh.
 *
 * Why a proxy?
 *   The access token lives in an httpOnly cookie (XSS-safe). Client JS
 *   can't read it. So API requests can't carry an Authorization header
 *   from the browser. Instead, the browser hits Next.js (same origin →
 *   cookies sent automatically), and Next reads the cookie, attaches
 *   the Bearer header, and forwards to the Django API container.
 *
 * Refresh flow
 *   1. Forward request with current access_token.
 *   2. If Django returns 401:
 *      a. Read refresh_token cookie. If absent → 401 bubbles unchanged.
 *      b. POST refresh_token → Authentik /token. If that fails → 401
 *         bubbles, client redirects to /auth/login.
 *      c. If refresh succeeds: forward the original request ONCE more
 *         with the new access_token. Whatever Django returns this time
 *         is what the client sees.
 *   Set-Cookie on the final response updates access_token (and
 *   refresh_token if Authentik rotated it).
 *
 * Transparency
 *   Status code, response body, and most response headers are passed
 *   through unchanged. We strip hop-by-hop headers (Connection,
 *   Transfer-Encoding) and any Set-Cookie from Django — only Next sets
 *   cookies on this origin.
 */

import { NextRequest, NextResponse } from "next/server"

import {
  ACCESS_TOKEN_OPTIONS,
  COOKIES,
  REFRESH_TOKEN_OPTIONS,
} from "@/lib/auth/cookies"
import { refreshAccessToken } from "@/lib/auth/refresh"

export const dynamic = "force-dynamic"

const DJANGO_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://api:8000/api/v1"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  // Don't forward client cookies — Django doesn't use them; the
  // Authorization header carries identity now.
  "cookie",
])

const STRIPPED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "transfer-encoding",
  "connection",
  "keep-alive",
])

interface ProxyAttemptResult {
  response: Response
  bodyBuffer: ArrayBuffer | null
}

/**
 * Issue the upstream request once. `bodyBuffer` is captured + returned so
 * we can replay the same body on a retry (Request body streams aren't
 * re-readable after the first consume).
 */
async function attempt(
  url: URL,
  method: string,
  headers: Headers,
  bodyBuffer: ArrayBuffer | null,
): Promise<ProxyAttemptResult> {
  const init: RequestInit = { method, headers, redirect: "manual" }
  if (bodyBuffer && method !== "GET" && method !== "HEAD") {
    init.body = bodyBuffer
  }
  const response = await fetch(url, init)
  return { response, bodyBuffer }
}

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params
  const url = new URL(`${DJANGO_BASE_URL}/${path.join("/")}`)
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.set(key, value)
  }

  const baseHeaders = new Headers()
  for (const [key, value] of request.headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) baseHeaders.set(key, value)
  }

  // Capture the body once — Next.js request bodies are streams; if we
  // need to retry after a refresh, we replay this buffer instead of
  // re-reading the stream.
  const bodyBuffer =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.arrayBuffer()

  const accessToken = request.cookies.get(COOKIES.accessToken)?.value
  const refreshToken = request.cookies.get(COOKIES.refreshToken)?.value

  const headers = new Headers(baseHeaders)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)

  let upstreamResult = await attempt(url, request.method, headers, bodyBuffer)
  let refreshed: Awaited<ReturnType<typeof refreshAccessToken>> = null

  // Try ONCE more after a successful refresh. The retry replaces the
  // first response — its status + body become the user-visible result.
  if (upstreamResult.response.status === 401 && refreshToken) {
    refreshed = await refreshAccessToken(refreshToken)
    if (refreshed) {
      const retryHeaders = new Headers(baseHeaders)
      retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`)
      upstreamResult = await attempt(
        url,
        request.method,
        retryHeaders,
        upstreamResult.bodyBuffer,
      )
    }
  }

  const responseHeaders = new Headers()
  for (const [key, value] of upstreamResult.response.headers.entries()) {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  }

  const out = new NextResponse(upstreamResult.response.body, {
    status: upstreamResult.response.status,
    statusText: upstreamResult.response.statusText,
    headers: responseHeaders,
  })

  if (refreshed) {
    out.cookies.set(COOKIES.accessToken, refreshed.accessToken, {
      ...ACCESS_TOKEN_OPTIONS,
      maxAge: refreshed.expiresIn,
    })
    if (refreshed.refreshToken) {
      out.cookies.set(
        COOKIES.refreshToken,
        refreshed.refreshToken,
        REFRESH_TOKEN_OPTIONS,
      )
    }
  }

  return out
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const HEAD = proxy
