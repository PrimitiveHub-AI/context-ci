/**
 * Launch feature flags — the single gate for v1 scope.
 *
 * v1 ships the defense layer (verifier kernel, `/check`, Context CI Top
 * 10, scanners, corpus + eval) plus the launch gate (Primitive Explorer,
 * Forge author→validate→export round-trip, seed catalog). Everything
 * below is postponed until its dependency lands.
 *
 * This is the ONE place scope is decided. To take a service live, change
 * its value to `true` — one line — and the `<PlannedBadge>` /
 * `<ComingSoonPanel>` surfaces gated on it light up automatically.
 */
export const FEATURE_FLAGS = {
  /** Authentik / OIDC sign-in + accounts·orgs multi-tenancy (heaviest infra). */
  auth: false,
  /** Sigstore keyless signing + Rekor transparency log. */
  signing: false,
  /** Forge → registry publish (needs auth + signing). */
  publish: false,
  /** Trust Bundle compose / install. */
  bundles: false,
  /** Contributor + review + governance dashboard. */
  contributors: false,
  /** One-click multi-agent export (manual copy still works without it). */
  multiAgentExport: false,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/** True iff the feature is live in this build. */
export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}
