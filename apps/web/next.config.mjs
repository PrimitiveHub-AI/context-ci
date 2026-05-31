/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
