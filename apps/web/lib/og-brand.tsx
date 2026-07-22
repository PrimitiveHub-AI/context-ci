import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { CSSProperties } from "react"

import { CYAN } from "./og-theme"

/**
 * Shared brand lockup for OG images — the pHub mark + two-tone wordmark.
 *
 * All four OG cards (`app/opengraph-image.tsx` + the per-route cards at
 * `/top-10`, `/check`, `/paper`) render <BrandLockup/> so the mark and
 * wordmark cannot drift between social-card previews — the same reason
 * the palette lives in `og-theme.ts`. Adding a new OG card means
 * importing this, not re-pasting the mark.
 *
 * The mark is read off disk once at module load and inlined as a base64
 * data URI — Satori (next/og) can't resolve `/brand/*` public URLs during
 * render. Every OG route is `runtime = "nodejs"`, so fs is available. The
 * read is guarded: if the path ever shifts in a future standalone build
 * layout, we fall back to the inline hexagon rather than 500-ing the card
 * (bug #34). cwd is the web app root in both dev and the prod image.
 */
const LOGO_MARK: string | null = (() => {
  try {
    const bytes = readFileSync(join(process.cwd(), "public", "brand", "logo-mark.png"))
    return `data:image/png;base64,${bytes.toString("base64")}`
  } catch {
    return null
  }
})()

export function BrandLockup() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {LOGO_MARK ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_MARK} width={34} height={50} alt="" />
      ) : (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L21 7L21 17L12 22L3 17L3 7L12 2Z"
            stroke={CYAN}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: -0.2 }}>
        <span style={{ display: "flex" }}>Primitive</span>
        <span style={{ display: "flex", color: CYAN }}>Hub</span>
      </div>
    </div>
  )
}

/**
 * Wrapping multi-segment text for OG cards (bug #34).
 *
 * Satori lays flex children out in a row and does NOT line-wrap across
 * them — a `display:flex` container mixing a text node with a colored /
 * monospace `<span>` overflows and the pieces overlap into garbage. This
 * renders every WORD as its own `display:flex` span inside a
 * `flexWrap:"wrap"` container, so the line breaks between words like real
 * text while still letting any segment carry its own color/font. Use this
 * for any OG headline or subhead that spans more than one line or mixes
 * styled inline runs — never a bare flex row of text + span.
 *
 * `columnGap` stands in for the inter-word space (flex strips whitespace);
 * default suits large headlines, drop it for smaller body copy via `style`.
 */
export function WrappingText({
  segments,
  style,
}: {
  segments: { text: string; style?: CSSProperties }[]
  style: CSSProperties
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        rowGap: 4,
        columnGap: 14,
        ...style,
      }}
    >
      {segments.flatMap((seg, si) =>
        seg.text
          .split(" ")
          .filter(Boolean)
          .map((word, wi) => (
            <span key={`${si}_${wi}`} style={{ display: "flex", ...seg.style }}>
              {word}
            </span>
          )),
      )}
    </div>
  )
}
