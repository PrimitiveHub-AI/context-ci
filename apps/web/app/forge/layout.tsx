import type { Metadata } from "next"

/**
 * Per-route metadata for `/forge`. The page itself is a client
 * component (CodeMirror editor + interactive state) so it can't
 * export `metadata` directly; this layout owns the metadata.
 */

export const metadata: Metadata = {
  title: "Primitive Forge — PrimitiveHub",
  description:
    "Author, scan, attest, and publish AI context primitives. Live Context CI feedback as you type. One-click signed publish.",
}

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  return children
}
