/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Hide the Next.js dev overlay indicator (the bottom-left "N" build/route
  // button). Dev-only; never rendered in production, but kept off so the
  // local view matches the shipped UI.
  devIndicators: false,
  // Dev-only: allow the localhost origins we reach the dev server from, so
  // Next 16 does not block cross-origin dev requests (HMR + client-hydration
  // assets). Without this, client components — e.g. the Forge CodeMirror
  // editor — can fail to hydrate when the box is reached via 127.0.0.1 or an
  // SSH tunnel, leaving an empty, un-typable editor. No effect on the
  // production build.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    unoptimized: true,
  },
  // Launch posture: the pre-launch `X-Robots-Tag: noindex` header was
  // removed on launch day alongside the `robots` metadata in app/layout.tsx
  // and public/robots.txt. Pages are now indexable.
  // Permanent redirects for the authoring surface's renames: "Workbench"
  // → "Primitive Forge" (PR 5.5.D, ADR-0017), then "Forge" → "Skill IDE"
  // (2026-10-24). Old bookmarks + inbound links survive; /workbench points
  // straight at the current route (no hop through the retired /forge).
  async redirects() {
    return [
      { source: "/forge", destination: "/skill-ide", permanent: true },
      { source: "/forge/:path*", destination: "/skill-ide/:path*", permanent: true },
      { source: "/workbench", destination: "/skill-ide", permanent: true },
      { source: "/workbench/:path*", destination: "/skill-ide/:path*", permanent: true },
    ]
  },
}

export default nextConfig
