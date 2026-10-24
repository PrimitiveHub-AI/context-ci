import type { Metadata } from "next"

/**
 * Per-route metadata for `/skill-ide`. The page itself is a client
 * component (CodeMirror editor + interactive state) so it can't
 * export `metadata` directly; this layout owns the metadata.
 */

export const metadata: Metadata = {
  title: "Skill IDE — PrimitiveHub",
  description:
    "Author AI context primitives safely. A security-first editor with live Context CI validation, inline lint, and section discovery as you type — calibrated to Primitive Spec v0.1.",
}

export default function SkillIdeLayout({ children }: { children: React.ReactNode }) {
  return children
}
