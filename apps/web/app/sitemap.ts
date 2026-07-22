import type { MetadataRoute } from "next"

import { primitives } from "@/lib/data/primitives"
import { DOC_PAGES } from "@/lib/docs"
import { ADR_PAGES } from "@/lib/decisions"
import { SPEC_PAGES } from "@/lib/specs"

/**
 * /sitemap.xml — the canonical crawl surface submitted to Google Search
 * Console + Bing Webmaster Tools on go-live.
 *
 * Built from the SAME data sources the routes render from
 * (`generateStaticParams` reads these too), so the sitemap can never
 * drift from what actually resolves 200. Add a primitive / doc / ADR /
 * spec and it appears here automatically — no second list to maintain.
 *
 * Deliberately EXCLUDED (would be thin or non-canonical in the index):
 *   - /registry /contributors /status /validation — flag-gated
 *     `<ComingSoonPanel>` shells (lib/flags: registry/contributors/
 *     status/contextCi are off for v1). No content to index yet.
 *   - /bundles — 308 permanent redirect to /registry (ADR-0040 §2).
 *   - /api/* — JSON surface, not a page.
 * Flip a flag on and add the route here in the same PR when it ships.
 */

const BASE = "https://primitivehub.ai"

/** Parse a "YYYY-MM-DD" string to a Date; undefined if absent/malformed. */
function asDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/check`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/forge`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/top-10`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/security`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/paper`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/decisions`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/specs`, changeFrequency: "monthly", priority: 0.7 },
  ]

  const primitiveRoutes: MetadataRoute.Sitemap = primitives.map((p) => ({
    url: `${BASE}/primitive/${p.slug}`,
    lastModified: asDate(p.lastUpdated),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  const docRoutes: MetadataRoute.Sitemap = DOC_PAGES.map((page) => ({
    url: `${BASE}/docs/${page.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const decisionRoutes: MetadataRoute.Sitemap = ADR_PAGES.map((adr) => ({
    url: `${BASE}/decisions/${adr.slug}`,
    lastModified: asDate(adr.date),
    changeFrequency: "yearly",
    priority: 0.3,
  }))

  const specRoutes: MetadataRoute.Sitemap = SPEC_PAGES.map((spec) => ({
    url: `${BASE}/specs/${spec.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [
    ...staticRoutes,
    ...primitiveRoutes,
    ...docRoutes,
    ...decisionRoutes,
    ...specRoutes,
  ]
}
