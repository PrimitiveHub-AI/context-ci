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
  type AttestationOut,
  type OrganizationMembershipOut,
  type PrimitiveListParams,
  type PrimitivePage,
  type WhoamiResponse,
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

export function useWhoami(): UseQueryResult<WhoamiResponse> {
  // The whoami endpoint is the source of truth for "is anyone signed in
  // right now?". Short staleTime so logout / login reflect promptly in
  // the navbar; retry: false so anonymous reads don't waste ops.
  return useQuery({
    queryKey: ["whoami"],
    queryFn: ({ signal }) => api.whoami({ signal }),
    staleTime: 30 * 1000,
    retry: false,
  })
}

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

/**
 * Attestation lifecycle hook.
 *
 * Polls while the Procrastinate task is in-flight (`pending`/`signing`)
 * so the badge transitions from shimmer → signed/failed without a page
 * refresh. Stops polling once the row reaches a terminal state.
 *
 * Returns the full AttestationOut shape per AttestationBadge's needs.
 * 404 (no attestation row — legacy primitive without one) bubbles up as
 * a query error; the badge's `unsigned` empty-state distinguishes that
 * case from `null` data.
 */
export function useAttestation(
  slug: string,
  semver: string,
): UseQueryResult<AttestationOut> {
  const { activeOrgSlug } = useActiveOrg()
  return useQuery({
    queryKey: ["attestation", activeOrgSlug, slug, semver],
    queryFn: ({ signal }) =>
      api.getAttestation(slug, semver, { signal, orgSlug: activeOrgSlug }),
    enabled: Boolean(slug && semver),
    // Stop polling once we've reached a terminal state. Both `pending`
    // and `signing` are in-flight — Procrastinate flips signing→signed
    // (or →failed) within seconds in dev.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "signed" || status === "failed") return false
      return 5_000
    },
    staleTime: 0, // always fetch fresh — status drives UI affordance
    retry: (count, err) => {
      // 404 = no attestation row exists (legacy primitive); don't retry.
      // Other errors retry up to 2 times to absorb transient network blips.
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("404")) return false
      return count < 2
    },
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
