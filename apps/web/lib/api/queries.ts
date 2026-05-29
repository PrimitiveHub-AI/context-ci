/**
 * TanStack Query hooks for the PrimitiveHub API.
 *
 * Each hook returns a strongly-typed UseQueryResult that consumers can
 * spread into loading / error / data branches. The query keys follow
 * the TanStack convention: `[resource, ...params]` so cache invalidation
 * is straightforward when a future mutation lands.
 */

"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import {
  api,
  type OrganizationMembershipOut,
  type PrimitiveListParams,
  type PrimitivePage,
} from "@/lib/api/client"
import type {
  Bundle,
  Contributor,
  PipelineStage,
  Primitive,
  ReviewItem,
} from "@/lib/types"

const STALE_TIME_MS = 5 * 60 * 1000 // 5 min — registry data updates slowly

export function useOrganizations(): UseQueryResult<OrganizationMembershipOut[]> {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: ({ signal }) => api.listOrganizations({ signal }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePrimitives(
  params: PrimitiveListParams = {},
): UseQueryResult<PrimitivePage> {
  return useQuery({
    queryKey: ["primitives", params],
    queryFn: ({ signal }) => api.listPrimitives(params, { signal }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePrimitive(slug: string): UseQueryResult<Primitive> {
  return useQuery({
    queryKey: ["primitive", slug],
    queryFn: ({ signal }) => api.getPrimitive(slug, { signal }),
    staleTime: STALE_TIME_MS,
    enabled: Boolean(slug),
  })
}

export function useBundles(): UseQueryResult<Bundle[]> {
  return useQuery({
    queryKey: ["bundles"],
    queryFn: ({ signal }) => api.listBundles({ signal }),
    staleTime: STALE_TIME_MS,
  })
}

export function useReviews(): UseQueryResult<ReviewItem[]> {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: ({ signal }) => api.listReviews({ signal }),
    staleTime: STALE_TIME_MS,
  })
}

export function usePipelineStages(
  slug: string,
  semver: string,
): UseQueryResult<PipelineStage[]> {
  return useQuery({
    queryKey: ["pipeline-stages", slug, semver],
    queryFn: ({ signal }) => api.listPipelineStages(slug, semver, { signal }),
    staleTime: STALE_TIME_MS,
    enabled: Boolean(slug && semver),
  })
}

export function useContributors(): UseQueryResult<Contributor[]> {
  return useQuery({
    queryKey: ["contributors"],
    queryFn: ({ signal }) => api.listContributors({ signal }),
    staleTime: STALE_TIME_MS,
  })
}
