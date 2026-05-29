/**
 * Same-origin Django proxy.
 *
 * Why a proxy?
 *   The access token lives in an httpOnly cookie (XSS-safe). Client JS
 *   can't read it. So API requests can't carry an Authorization header
 *   from the browser. Instead, the browser hits Next.js (same origin →
 *   cookies sent automatically), and Next reads the cookie, attaches
 *   the Bearer header, and forwards to the Django API container.
 *
 * Transparency
 *   Status code, response body, and most response headers are passed
 *   through unchanged. We strip hop-by-hop headers (Connection,
 *   Transfer-Encoding) and any Set-Cookie from Django — only Next sets
 *   cookies on this origin.
 */

import { NextRequest, NextResponse } from "next/server"

import { COOKIES } from "@/lib/auth/cookies"

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

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params
  const url = new URL(`${DJANGO_BASE_URL}/${path.join("/")}`)
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.set(key, value)
  }

  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value)
  }

  const accessToken = request.cookies.get(COOKIES.accessToken)?.value
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  // X-Organization-Slug is sent by the client as a regular header and is
  // already preserved by the loop above.

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer()
  }

  const upstream = await fetch(url, init)

  const responseHeaders = new Headers()
  for (const [key, value] of upstream.headers.entries()) {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const HEAD = proxy
