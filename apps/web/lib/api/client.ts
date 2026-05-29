/**
 * Typed fetch wrapper for the PrimitiveHub Ninja API.
 *
 * Single source of truth for: base URL, default headers, Bearer-token
 * injection, error → typed-exception conversion.
 *
 * In dev: the backend has DEV_AUTH_BYPASS=True and accepts any request as
 * the configured DEV_OIDC_SUBJECT. No Authorization header is needed.
 *
 * In prod: the caller is expected to supply a Bearer token via the
 * `authToken` option. The real OIDC login flow (Authentik redirect →
 * callback → token storage) lands in a follow-up Step 5 PR; this client
 * is the seam where that wires in.
 */

import type {
  Bundle,
  Contributor,
  PipelineStage,
  Primitive,
  ReviewItem,
} from "@/lib/types"

const DEFAULT_BASE_URL = "http://localhost:8000/api/v1"

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL

export class ApiError extends Error {
  readonly status: number
  readonly url: string

  constructor(status: number, url: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.url = url
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  searchParams?: Record<string, string | number | undefined>
  authToken?: string
  signal?: AbortSignal
}

async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, searchParams, authToken, signal } = options
  const url = new URL(`${apiBaseUrl}${path}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    credentials: "include",
    signal,
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const errorJson = await response.json()
      if (typeof errorJson?.detail === "string") detail = errorJson.detail
    } catch {
      // body wasn't JSON; keep the status line
    }
    throw new ApiError(response.status, url.toString(), detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint contract — keys camelCase, mirror apps/api/registry/schemas.py.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrimitivePage {
  items: Primitive[]
  nextCursor: string | null
  pageSize: number
}

export interface PrimitiveListParams {
  cursor?: string
  pageSize?: number
  category?: string
  agent?: string
  status?: string
  search?: string
}

export interface OrganizationOut {
  id: string
  slug: string
  name: string
  visibility: string
  createdAt: string
  memberRoleCount: number
}

export interface OrganizationMembershipOut {
  organization: OrganizationOut
  roles: string[]
  joinedAt: string
}

export const api = {
  listOrganizations: (options: ApiRequestOptions = {}) =>
    apiFetch<OrganizationMembershipOut[]>("/organizations", options),

  listPrimitives: (
    params: PrimitiveListParams = {},
    options: ApiRequestOptions = {},
  ) =>
    apiFetch<PrimitivePage>("/primitives", {
      ...options,
      searchParams: {
        cursor: params.cursor,
        page_size: params.pageSize,
        category: params.category,
        agent: params.agent,
        status: params.status,
        search: params.search,
      },
    }),

  getPrimitive: (slug: string, options: ApiRequestOptions = {}) =>
    apiFetch<Primitive>(`/primitives/${encodeURIComponent(slug)}`, options),

  listBundles: (options: ApiRequestOptions = {}) =>
    apiFetch<Bundle[]>("/bundles", options),

  getBundle: (slug: string, options: ApiRequestOptions = {}) =>
    apiFetch<Bundle>(`/bundles/${encodeURIComponent(slug)}`, options),

  listReviews: (options: ApiRequestOptions = {}) =>
    apiFetch<ReviewItem[]>("/reviews", options),

  listPipelineStages: (
    slug: string,
    semver: string,
    options: ApiRequestOptions = {},
  ) =>
    apiFetch<PipelineStage[]>(
      `/primitives/${encodeURIComponent(slug)}/versions/${encodeURIComponent(semver)}/pipeline-stages`,
      options,
    ),

  listContributors: (options: ApiRequestOptions = {}) =>
    apiFetch<Contributor[]>("/contributors", options),
}
