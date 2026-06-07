import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
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
    "We verify every byte of context an AI agent consumes — AGENTS.md, SKILL.md, .cursor/rules, mcp.json — against the Context CI Top 10, before the agent reads it. Open-source verifier kernel, CLI, GitHub Action, and MCP runtime gate. A CyberOrca Labs initiative.",
  applicationName: "PrimitiveHub",
  authors: [{ name: "CyberOrca Labs" }],
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
  // Pre-launch posture: every page declares itself non-indexable.
  // Remove this `robots` block on launch day, alongside public/robots.txt
  // and the X-Robots-Tag header in next.config.mjs.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "PrimitiveHub — the Context Firewall for AI agents",
    description:
      "Every byte of agent context — AGENTS.md, SKILL.md, .cursor/rules, mcp.json — verified against the Context CI Top 10 before the agent reads it.",
    siteName: "PrimitiveHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrimitiveHub — the Context Firewall for AI agents",
    description:
      "Every byte of agent context verified against the Context CI Top 10 before the agent reads it. Open-source verifier kernel, CLI, GitHub Action, MCP runtime gate.",
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
        <Providers>
          <Navbar />
          {children}
        </Providers>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
