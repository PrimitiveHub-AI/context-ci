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
  // Pre-launch posture: every response declares itself non-indexable as a
  // belt-and-suspenders defense against accidental exposure. Remove this
  // `headers` block on launch day, alongside the `robots` metadata in
  // app/layout.tsx and public/robots.txt.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
        ],
      },
    ]
  },
  // Permanent redirect: the authoring surface renamed from "Workbench"
  // to "Primitive Forge" in PR 5.5.D (ADR-0017). Old bookmarks survive.
  // Drop this redirect after launch-day cache windows close (≥ 6 months
  // post-launch is the conservative call).
  async redirects() {
    return [
      { source: "/workbench", destination: "/forge", permanent: true },
      { source: "/workbench/:path*", destination: "/forge/:path*", permanent: true },
    ]
  },
}

export default nextConfig
