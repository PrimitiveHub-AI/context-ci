import { readFile } from "node:fs/promises"
import path from "node:path"

import type { Metadata } from "next"

/**
 * /top-10 — public-facing page for the Context CI Top 10 v0.1 spec.
 *
 * Per docs/execution-plan.md Gate G-G, this page flips from noindex
 * (inherited from layout.tsx's robots block — pre-launch posture is
 * absolute) to indexable on launch day. Until then, the page renders
 * in production-parity form so we can rehearse the launch surface
 * without exposing it.
 *
 * Source: docs/context-ci-top-10-v0.1.md (the normative spec). Reading
 * the spec at build time keeps the page in lockstep with the document
 * — no parallel hand-written copy to drift from canon.
 */

export const metadata: Metadata = {
  title: "Context CI Top 10 v0.1 — PrimitiveHub",
  description:
    "The ten supply-chain attack categories Context CI detects. Stable identifiers (CCI-001..CCI-010), severity ranges, prevention guidance.",
}

// Read the spec at module evaluation (build-time). Server Component.
async function loadSpecMarkdown(): Promise<string> {
  // The repo root is two levels up from apps/web/ at build time and
  // at runtime under Next's standalone output.
  const candidates = [
    // dev (next dev): cwd is apps/web
    path.resolve(process.cwd(), "../../docs/context-ci-top-10-v0.1.md"),
    // standalone runtime: docs may be copied alongside or at repo root
    path.resolve(process.cwd(), "docs/context-ci-top-10-v0.1.md"),
    "/repo/docs/context-ci-top-10-v0.1.md",
  ]
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8")
    } catch {
      // try next
    }
  }
  return "# Context CI Top 10 v0.1\n\n_Spec source not reachable at build time. See docs/context-ci-top-10-v0.1.md in the repository._\n"
}

export default async function TopTenPage() {
  const spec = await loadSpecMarkdown()
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Versioned public spec · v0.1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Context CI Top 10
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The ten supply-chain attack categories Context CI detects.
          Stable IDs <span className="font-mono">CCI-001</span>..
          <span className="font-mono">CCI-010</span>. Cited by the
          Trust Contract attestation predicate.
        </p>
      </header>
      <article className="prose prose-sm max-w-none font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/80">
        {spec}
      </article>
    </main>
  )
}
