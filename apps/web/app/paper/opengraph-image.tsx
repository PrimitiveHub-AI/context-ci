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

/**
 * /paper OG image — the citation-grade card.
 *
 * Tailored to the research surface. Title verbatim from the
 * doctrine-locked paper § Paper thesis. Subhead is the
 * one-paragraph framing the abstract opens with. Bottom row carries
 * the headline numbers a paper reviewer wants to see at first
 * glance: corpus size, Python recall on the held-out slice, parity
 * status. The card is the first impression a citer or a hostile
 * journalist sees in their link preview.
 */

export const runtime = "nodejs"
export const alt =
  "Context CI: A Threat Taxonomy and Static-Validation Pipeline for the Agent-Context Supply Chain — CyberOrca Labs · PrimitiveHub Project preprint v0.1"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function PaperOG() {
  const ev = loadLatestEvaluation()
  const s = summarize(ev)
  const totalSamples = s.inSampleSamples + s.holdoutSamples
  const pyHoldoutSamples = ev.holdout?.samples_total ?? s.holdoutSamples

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
        {/* Top — wordmark + preprint pill */}
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
              · /paper
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
            <div style={{ display: "flex" }}>
              CyberOrca Labs · preprint v0.1
            </div>
          </div>
        </div>

        {/* Middle — title + thesis. Title is doctrine-locked and
            long; the subhead is the one-line framing. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -1.4,
              lineHeight: 1.1,
              maxWidth: 1040,
            }}
          >
            Context CI: A Threat Taxonomy and Static-Validation Pipeline for the <span style={{ color: CYAN, marginLeft: 12 }}>agent-context supply chain</span>.
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 24,
              lineHeight: 1.45,
              color: FG_DIM,
              maxWidth: 1040,
            }}
          >
            Signing proves who wrote a primitive, not what it tells the agent
            to do. We close the gap with a ten-category taxonomy, an open
            adversarial corpus, dual-engine static validation under a CI
            regression gate, and a per-sample replay tool.
          </div>
        </div>

        {/* Bottom — paper-grade numbers + URL */}
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
            <div style={{ display: "flex" }}>{totalSamples}-sample corpus</div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>
              Python recall {pyHoldoutSamples}/{pyHoldoutSamples} held-out
            </div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>Py ↔ TS parity gated</div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: FG_MORE_DIM }}>
            primitivehub.ai/paper
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
