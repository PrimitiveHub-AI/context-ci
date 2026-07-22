import { ImageResponse } from "next/og"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"
import {
  BG,
  CYAN,
  CYAN_DIM,
  CYAN_SOFT,
  FG,
  FG_DIM,
  FG_MORE_DIM,
  OG_BACKGROUND_GRADIENT,
  OG_CONTENT_TYPE,
  OG_FONT_FAMILY,
  OG_MONO_FAMILY,
  OG_SIZE,
} from "@/lib/og-theme"
import { BrandLockup } from "@/lib/og-brand"

/**
 * /top-10 OG image — the threat-encyclopedia card.
 *
 * Tailored to the category-creator surface: lead with the headline
 * ("Context CI Top 10"), name the artifact ("ten supply-chain attack
 * categories"), and surface the measured F1 + corpus size from the
 * evaluation loader so the social-card first impression is
 * paper-grade truth, not marketing.
 *
 * Pre-launch noindex inherited from middleware; the image only gets
 * fetched on direct link previews.
 */

export const runtime = "nodejs"
export const alt =
  "Context CI Top 10 — ten supply-chain attack categories detected by PrimitiveHub"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function TopTenOG() {
  const s = summarize(loadLatestEvaluation())
  const totalSamples = s.inSampleSamples + s.holdoutSamples

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          backgroundImage: OG_BACKGROUND_GRADIENT,
          padding: "60px 80px",
          fontFamily: OG_FONT_FAMILY,
          color: FG,
        }}
      >
        {/* Top — wordmark + version pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <BrandLockup />
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: FG_MORE_DIM,
                fontFamily: OG_MONO_FAMILY,
              }}
            >
              · /top-10
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid ${CYAN_DIM}`,
              backgroundColor: CYAN_SOFT,
              padding: "8px 16px",
              borderRadius: 999,
              fontSize: 16,
              color: CYAN,
              fontFamily: OG_MONO_FAMILY,
            }}
          >
            <div style={{ display: "flex" }}>v{s.top10Version} · stable IDs · append-only</div>
          </div>
        </div>

        {/* Middle — name the artifact, then prove it */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: -2.4,
              lineHeight: 1,
            }}
          >
            Context CI <span style={{ color: CYAN, marginLeft: 24 }}>Top 10</span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.4,
              color: FG_DIM,
              maxWidth: 980,
            }}
          >
            Ten supply-chain attack categories detected, classified, and gated by Context CI. Stable identifiers CCI-001 through CCI-010 — cited by the Trust Contract attestation predicate.
          </div>

          {/* CCI ID strip — visual evidence the taxonomy is enumerated */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              fontFamily: OG_MONO_FAMILY,
              fontSize: 16,
              color: CYAN,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  border: `1px solid ${CYAN_DIM}`,
                  backgroundColor: CYAN_SOFT,
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                CCI-{String(n).padStart(3, "0")}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — measured headline + provenance */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 24,
            borderTop: `1px solid ${FG_MORE_DIM}`,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 28,
              fontSize: 18,
              color: FG_DIM,
              fontFamily: OG_MONO_FAMILY,
            }}
          >
            <div style={{ display: "flex" }}>
              {s.perfectDetectors}/{s.totalDetectors} detectors
            </div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>
              macro F1 = {s.macroF1InSample.toFixed(3)}
            </div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>{totalSamples} labeled samples</div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: FG_MORE_DIM }}>
            primitivehub.ai/top-10
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
