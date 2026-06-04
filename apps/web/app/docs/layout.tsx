import { ReactNode } from "react"

import { SearchTrigger } from "@/components/docs/search-trigger"

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
      <div className="flex justify-end pt-6">
        <SearchTrigger />
      </div>
      <div className="grid grid-cols-1 gap-8 pb-12 pt-6 lg:grid-cols-[260px_1fr]">
        {children}
      </div>
    </div>
  )
}
