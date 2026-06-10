/**
 * Shared theme tokens for OG images.
 *
 * All four OG image generators (the global card at
 * `apps/web/app/opengraph-image.tsx` + the per-route cards at
 * `/top-10`, `/check`, `/paper`) import these so the brand palette
 * cannot drift between social-card previews. Adding a new OG card
 * means importing from here — not redefining the cyan-on-dark.
 *
 * Why a module instead of inlining: ImageResponse / Satori renders
 * each card independently; without a shared source, two routes can
 * silently render with two different cyans and nobody notices until
 * the cards land in the same Slack thread. The module enforces
 * one truth.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = "image/png" as const

/** Matches the site's primary accent (oklch 0.78 0.14 195). */
export const CYAN = "#22d3e8"
export const CYAN_DIM = "rgba(34, 211, 232, 0.18)"
export const CYAN_SOFT = "rgba(34, 211, 232, 0.05)"

export const BG = "#050709"
export const FG = "#f5f7fa"
export const FG_DIM = "rgba(245, 247, 250, 0.72)"
export const FG_MORE_DIM = "rgba(245, 247, 250, 0.42)"

export const AMBER = "#f59e0b"
export const SUCCESS = "#22c55e"

/**
 * Standard radial-gradient background string used by every card.
 * Centered ellipse of soft cyan at the top, fading to the dark base.
 */
export const OG_BACKGROUND_GRADIENT =
  "radial-gradient(ellipse 800px 400px at 50% 0%, rgba(34, 211, 232, 0.10), transparent)"

/** System-font stack — ImageResponse falls back to these without a fetch. */
export const OG_FONT_FAMILY = "system-ui, -apple-system, sans-serif"
export const OG_MONO_FAMILY = "ui-monospace, monospace"
