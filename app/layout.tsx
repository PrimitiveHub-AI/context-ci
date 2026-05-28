import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Navbar } from "@/components/navbar"
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
  metadataBase: new URL("https://primitivehub.dev"),
  title: {
    default: "PrimitiveHub — Trusted Registry for AI Context Primitives",
    template: "%s — PrimitiveHub",
  },
  description:
    "The trusted registry for AI Context Primitives. Expert-authored Markdown cognition modules — validated, versioned, attested, scored, and installable into any compatible AI agent. A CyberOrca Labs initiative.",
  applicationName: "PrimitiveHub",
  authors: [{ name: "CyberOrca Labs" }],
  keywords: [
    "AI Context Primitives",
    "AI agent context",
    "context supply chain",
    "Context CI",
    "AI registry",
    "Claude Code",
    "Cursor",
    "agent governance",
    "PrimitiveHub",
    "CyberOrca",
  ],
  openGraph: {
    type: "website",
    title: "PrimitiveHub — Trusted Registry for AI Context Primitives",
    description:
      "Treats agent context as supply-chain material, not disposable prompt text. Validated, versioned, attested cognition for AI agents.",
    siteName: "PrimitiveHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrimitiveHub — Trusted Registry for AI Context Primitives",
    description:
      "Treats agent context as supply-chain material. Validated, versioned, attested cognition for AI agents.",
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
        <Navbar />
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
