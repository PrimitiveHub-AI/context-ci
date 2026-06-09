import { permanentRedirect } from "next/navigation"

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
 *
 * `permanentRedirect()` emits HTTP 308 (vs `redirect()` which emits
 * 307 temporary). The merge is a deliberate doctrinal call, not a
 * temporary outage — search engines and bookmark stores should
 * forget the old URL.
 */
export default function BundlesRedirectPage(): never {
  // Target /registry (not #bundles): the bundles section is flag-gated
  // (off for v1) so the anchor may not exist. The merge into the registry
  // surface is permanent regardless (ADR-0040 §2); the section reappears
  // in place when `bundles` is flipped on.
  permanentRedirect("/registry")
}
