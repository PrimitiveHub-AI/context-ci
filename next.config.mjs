/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

export default nextConfig
