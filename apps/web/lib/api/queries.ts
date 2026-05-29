/**
 * TanStack Query hooks for the PrimitiveHub API.
 *
 * Each hook reads the active org slug from `useActiveOrg()` and:
 *   - includes the slug in the query key so switching org invalidates
 *     the cache (instead of leaving stale data visible across tenants)
 *   - forwards the slug into `apiFetch`, which sends it as the
 *     `X-Organization-Slug` header
 *
 * The keys follow `[resource, orgSlug, ...params]` so cache scoping is
 * tenant-aware and a future mutation can invalidate by `[resource, slug]`.
 */

"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import {
  api,
  type OrganizationMembershipOut,
  type PrimitiveListParams,
  type PrimitivePage,
} from "@/lib/api/client"
import { useActiveOrg } from "@/lib/api/org-context"
import type {
  Bundle,
  Contributor,
  PipelineStage,
  Primitive,
  ReviewItem,
} from "@/lib/types"

const STALE_TIME_MS = 5 * 60 * 1000 // 5 min — registry data updates slowly

export function useOrganizations(): UseQueryResult<OrganizationMembershipOut[]> {
  // Memberships are a property of the user, not of any one org —
  // intentionally NOT scoped by activeOrgSlug. This is the picker's
  // source of truth.
  return useQuery({
    queryKey: ["organizations"],
    queryFn: ({ signal }) => api.listOrganizations({ signal }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePrimitives(
  params: PrimitiveListParams = {},
): UseQueryResult<PrimitivePage> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["primitives", activeOrgSlug, params],
    queryFn: ({ signal }) =>
      api.listPrimitives(params, { signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePrimitive(slug: string): UseQueryResult<Primitive> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["primitive", activeOrgSlug, slug],
    queryFn: ({ signal }) =>
      api.getPrimitive(slug, { signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
    enabled: Boolean(slug),
  })
}

export function useBundles(): UseQueryResult<Bundle[]> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["bundles", activeOrgSlug],
    queryFn: ({ signal }) => api.listBundles({ signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
  })
}

export function useReviews(): UseQueryResult<ReviewItem[]> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["reviews", activeOrgSlug],
    queryFn: ({ signal }) => api.listReviews({ signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePipelineStages(
  slug: string,
  semver: string,
): UseQueryResult<PipelineStage[]> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["pipeline-stages", activeOrgSlug, slug, semver],
    queryFn: ({ signal }) =>
      api.listPipelineStages(slug, semver, { signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
    enabled: Boolean(slug && semver),
  })
}

export function useContributors(): UseQueryResult<Contributor[]> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["contributors", activeOrgSlug],
    queryFn: ({ signal }) =>
      api.listContributors({ signal, orgSlug: activeOrgSlug }),
    staleTime: STALE_TIME_MS,
  })
}
