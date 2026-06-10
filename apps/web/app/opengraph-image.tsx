import { ImageResponse } from "next/og"

import { loadLatestEvaluation, summarize } from "@/lib/evaluation"
import {
  BG,
  CYAN,
  CYAN_DIM,
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
 * Open Graph image — the social-card first impression.
 *
 * Pre-launch posture (CLAUDE.md hard rule #5 + ADR-0042) keeps this
 * surface behind noindex; the image only gets fetched when someone
 * with the link previews it (Slack, internal share). Even so, the
 * card needs to read as the locked thesis on first glance — the
 * doctrine § Category statement headline, plus the measured pill
 * the homepage already foregrounds.
 *
 * Image is regenerated per request, so the measured number tracks
 * the embedded baseline. No drift.
 *
 * Next.js routes this file at `/opengraph-image` and exposes it via
 * the openGraph.images metadata field auto-injected by app/layout.tsx.
 * twitter card falls back to the OG image when no twitter-image.tsx
 * sibling exists, so this single file covers both Slack/LinkedIn/FB
 * and X/Twitter.
 */

export const runtime = "nodejs"
export const alt = "PrimitiveHub — the Context Firewall for AI agents"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function OGImage() {
  const summary = summarize(loadLatestEvaluation())
  const f1 = summary.macroF1InSample.toFixed(3)

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
          backgroundImage:
            "radial-gradient(ellipse 800px 400px at 50% 0%, rgba(34, 211, 232, 0.10), transparent)",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: FG,
        }}
      >
        {/* Top row — wordmark + status pill */}
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
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid ${CYAN_DIM}`,
              backgroundColor: "rgba(34, 211, 232, 0.05)",
              padding: "8px 16px",
              borderRadius: 999,
              fontSize: 16,
              color: CYAN,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: CYAN,
              }}
            />
            <div style={{ display: "flex" }}>
              {summary.totalDetectors}/{summary.totalDetectors} detectors · macro F1 = {f1} · {summary.measuredAt}
            </div>
          </div>
        </div>

        {/* Middle — headline + subhead. Doctrine § Category statement
            verbatim ("The Context Firewall for AI agents"), and below
            it the named-enemy artifacts. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            The <span style={{ color: CYAN, marginLeft: 18, marginRight: 18 }}>Context Firewall</span> for AI agents.
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
            Every byte of agent context — AGENTS.md, SKILL.md, .cursor/rules,
            mcp.json — verified against the Context CI Top 10 before the
            agent reads it.
          </div>
        </div>

        {/* Bottom row — surfaces + project attribution */}
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
              gap: 32,
              fontSize: 18,
              color: FG_DIM,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <div style={{ display: "flex" }}>/check</div>
            <div style={{ display: "flex" }}>phub audit</div>
            <div style={{ display: "flex" }}>GitHub Action</div>
            <div style={{ display: "flex" }}>MCP runtime gate</div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: FG_MORE_DIM }}>
            A CyberOrca Labs initiative · primitivehub.ai
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
