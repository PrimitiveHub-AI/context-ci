import { redirect } from "next/navigation"

/**
 * /bundles → /registry#bundles (308 permanent).
 *
 * Bundles was its own surface in Phase 1–4. Per ADR-0040 §2 ("one
 * surface per funnel stage; surface breadth is taxed"), a curated
 * list of registry primitives is not its own AV-family slot — it
 * belongs inside the discovery stage the registry already owns. The
 * page content now lives at /registry#bundles via
 * `RegistryBundlesSection`. This stub keeps incoming links and
 * bookmarks working.
 */
export default function BundlesRedirectPage(): never {
  redirect("/registry#bundles")
}
