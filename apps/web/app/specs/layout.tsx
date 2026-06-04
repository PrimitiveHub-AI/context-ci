import { ReactNode } from "react"

import "highlight.js/styles/github-dark.css"

export const metadata = {
  title: "Specs — PrimitiveHub",
  description:
    "Canonical, citable, versioned specifications for PrimitiveHub: Trust Contract v0.1, Context CI Top 10 v0.1, Context Policy Language v0.1, Primitive Spec, Threat Model.",
  robots: { index: false, follow: false },
}

interface SpecsLayoutProps {
  children: ReactNode
}

export default function SpecsLayout({ children }: SpecsLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-[260px_1fr]">
        {children}
      </div>
    </div>
  )
}
