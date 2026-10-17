import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@/components/analytics"
import { Navbar } from "@/components/navbar"
import { Providers } from "@/components/providers"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://primitivehub.ai"),
  title: {
    default: "PrimitiveHub — the Context Firewall for AI agents",
    template: "%s — PrimitiveHub",
  },
  description:
    "We inspect the agent-context artifacts we discover — AGENTS.md, SKILL.md, .cursor/rules, mcp.json — against the Context CI Top 10 before you ship them to an agent. Open-source verifier kernel, CLI, GitHub Action, and MCP server (advisory). A CyberOrca Labs initiative.",
  applicationName: "PrimitiveHub",
  authors: [{ name: "CyberOrca Labs" }],
  // Identity assets live in `public/brand/` (drop-zone — see its README).
  // Replacing a file there with the same name updates the site with no
  // code change. SVG is the primary favicon; .ico/.png are fallbacks.
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/brand/apple-icon.png", sizes: "180x180" }],
  },
  keywords: [
    "Context Firewall",
    "Context CI",
    "Context CI Top 10",
    "AI agent context",
    "agent-context supply chain",
    "Trust Bundle",
    "CBOM",
    "Sigstore",
    "AGENTS.md",
    "SKILL.md",
    "Claude Code",
    "Cursor",
    "MCP",
    "PrimitiveHub",
    "CyberOrca",
  ],
  // Launch posture: the pre-launch `robots` noindex block was removed on
  // launch day alongside public/robots.txt and the X-Robots-Tag header in
  // next.config.mjs. Pages are now indexable (Next.js default).
  openGraph: {
    type: "website",
    title: "PrimitiveHub — the Context Firewall for AI agents",
    description:
      "Inspect the agent-context artifacts you discover — AGENTS.md, SKILL.md, .cursor/rules, mcp.json — against the Context CI Top 10 before you ship them to an agent.",
    siteName: "PrimitiveHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrimitiveHub — the Context Firewall for AI agents",
    description:
      "Inspect agent-context artifacts against the Context CI Top 10 before you ship them to an agent. Open-source verifier kernel, CLI, GitHub Action, MCP server (advisory).",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {/* Bypass-blocks: keyboard/AT users jump straight past the navbar to
            the page content (WCAG 2.4.1). Visually hidden until focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:border focus:border-border focus:bg-secondary focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <Providers>
          <Navbar />
          <div id="main-content" tabIndex={-1} className="outline-none">
            {children}
          </div>
        </Providers>
        {/* Self-hosted Umami — renders only when the launch image is built
            with NEXT_PUBLIC_UMAMI_* set; beacon-free otherwise (ADR-0046). */}
        <Analytics />
      </body>
    </html>
  )
}
