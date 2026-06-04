import { ReactNode } from "react"

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
      <div className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-[280px_1fr]">
        {children}
      </div>
    </div>
  )
}
