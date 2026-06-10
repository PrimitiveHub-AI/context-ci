import { ImageResponse } from "next/og"

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

/**
 * /check OG image — the public funnel-entry card.
 *
 * Tailored to the AV-cloud-lookup surface. The headline echoes
 * /check's binary-safety-corrected copy ("show the risk before your
 * agent reads it") and the subhead names the artifact families a
 * visitor can paste — same recognition primitives the /check page
 * shows above the form. No measured-F1 pill here: /check serves a
 * different funnel stage than /top-10, and the measurement claim
 * belongs on the threat-encyclopedia card.
 */

export const runtime = "nodejs"
export const alt =
  "PrimitiveHub /check — paste anything, see the risk before your agent reads it"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function CheckOG() {
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
        {/* Top — wordmark + route + posture pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L21 7L21 17L12 22L3 17L3 7L12 2Z"
                stroke={CYAN}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: -0.2 }}>
              PrimitiveHub
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: FG_MORE_DIM,
                fontFamily: OG_MONO_FAMILY,
              }}
            >
              · /check
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
            <div style={{ display: "flex" }}>no account · no install · no execution</div>
          </div>
        </div>

        {/* Middle — the pitch */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 82,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            <div style={{ display: "flex" }}>Paste anything.</div>
            <div style={{ display: "flex", color: CYAN }}>
              See the risk before your agent reads it.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.4,
              color: FG_DIM,
              maxWidth: 1000,
            }}
          >
            Drop in a skill, a URL, a GitHub repo, an{" "}
            <span style={{ color: FG, fontFamily: OG_MONO_FAMILY, marginLeft: 6, marginRight: 6 }}>npx</span>{" "}
            command, or a{" "}
            <span style={{ color: FG, fontFamily: OG_MONO_FAMILY, marginLeft: 6, marginRight: 6 }}>
              claude skill install
            </span>{" "}
            line. We scan it against the Context CI Top 10 before any agent reads it.
          </div>
        </div>

        {/* Bottom — surface name + URL */}
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
            <div style={{ display: "flex" }}>10 detectors</div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>auto-detect input</div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>fetched, never executed</div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: FG_MORE_DIM }}>
            primitivehub.ai/check
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
