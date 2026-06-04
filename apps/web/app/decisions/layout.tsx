import { ReactNode } from "react"

import { SearchTrigger } from "@/components/docs/search-trigger"

import "highlight.js/styles/github-dark.css"

export const metadata = {
  title: "Decisions — PrimitiveHub",
  description:
    "Architecture Decision Records (ADRs) for PrimitiveHub. Why each load-bearing choice was made + the alternatives that were rejected + the consequences.",
  robots: { index: false, follow: false },
}

interface DecisionsLayoutProps {
  children: ReactNode
}

export default function DecisionsLayout({ children }: DecisionsLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex justify-end pt-6">
        <SearchTrigger />
      </div>
      <div className="grid grid-cols-1 gap-8 pb-12 pt-6 lg:grid-cols-[280px_1fr]">
        {children}
      </div>
    </div>
  )
}
