import Script from "next/script"

/**
 * Self-hosted Umami analytics (ADR-0046). First-party, privacy-first page
 * analytics — replaces `@vercel/analytics`, which was a no-op third-party
 * beacon off-Vercel (we deploy on Hetzner + Caddy, not Vercel).
 *
 * Config is read from build-time NEXT_PUBLIC_ constants, not runtime env,
 * because the root layout is statically rendered for the SSG content pages
 * (`generateStaticParams`) — a runtime `process.env` read would never reach
 * the baked HTML. Both values are public (an analytics website id is not a
 * secret) and stable per deploy.
 *
 * Renders NOTHING unless BOTH are set. Every dev/CI build ships them empty,
 * so no script and no beacon load until the owner wires a website in the
 * Umami dashboard and rebuilds the launch image with the two build args
 * (see docs/decisions/0046-self-hosted-analytics-umami.md). This keeps the
 * pre-launch posture beacon-free by default (Hard rule #3 + launch doctrine).
 */
export function Analytics() {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  if (!src || !websiteId) return null

  return (
    <Script
      src={`${src.replace(/\/$/, "")}/script.js`}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  )
}
