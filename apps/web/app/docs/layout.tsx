import { ReactNode } from "react"

import "highlight.js/styles/github-dark.css"

export const metadata = {
  title: "Documentation — PrimitiveHub",
  description:
    "User documentation for PrimitiveHub: phub CLI, Context Policy Language, phub.lock, GitHub Action, MCP server, verify library, recipes, troubleshooting.",
  robots: { index: false, follow: false },
}

interface DocsLayoutProps {
  children: ReactNode
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-[260px_1fr]">
        {children}
      </div>
    </div>
  )
}
