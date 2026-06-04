import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"

import { DecisionsNav } from "../decisions-nav"
import { PageToc } from "@/components/docs/page-toc"
import { ADR_PAGES, getAdrPage } from "@/lib/decisions"
import { readAdrSource } from "@/lib/decisions/load"
import { findDocsRoot } from "@/lib/markdown/discovery"
import { rewriteMarkdownLinks } from "@/lib/markdown/link-rewriter"
import { extractToc } from "@/lib/markdown/toc"
import { docsRehypePlugins, docsRemarkPlugins } from "@/lib/docs/render-options"
import { join } from "node:path"

export function generateStaticParams() {
  return ADR_PAGES.map((adr) => ({ slug: adr.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const adr = getAdrPage(slug)
  if (!adr) return { robots: { index: false, follow: false } }
  return {
    title: `ADR-${adr.number}: ${adr.title} — PrimitiveHub`,
    description: `Architecture Decision Record ${adr.number}: ${adr.title} (${adr.status})`,
    robots: { index: false, follow: false },
  }
}

const DECISIONS_DIR = join(findDocsRoot(), "decisions")

export default async function AdrSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const adr = getAdrPage(slug)
  if (!adr) notFound()

  const raw = readAdrSource(adr.file)
  const source = rewriteMarkdownLinks(raw, join(DECISIONS_DIR, adr.file))
  const toc = extractToc(source)

  // Previous / next by ADR number order (newest-first list, so prev =
  // newer ADR, next = older).
  const idx = ADR_PAGES.findIndex((p) => p.slug === slug)
  const prev = idx > 0 ? ADR_PAGES[idx - 1] : undefined
  const next = idx < ADR_PAGES.length - 1 ? ADR_PAGES[idx + 1] : undefined

  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <DecisionsNav currentSlug={slug} />
      </aside>

      <main className="min-w-0">
        <header className="mb-8 space-y-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/decisions" className="hover:text-foreground">
              Decisions
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="font-mono text-xs tabular-nums opacity-60">
              ADR-{adr.number}
            </span>
          </nav>
        </header>

        <div className="grid gap-10 xl:grid-cols-[1fr_220px]">
          <article className="prose-docs min-w-0">
            <ReactMarkdown
              remarkPlugins={docsRemarkPlugins}
              rehypePlugins={docsRehypePlugins}
            >
              {source}
            </ReactMarkdown>
          </article>
          {toc.length > 0 ? (
            <aside className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
              <PageToc entries={toc} />
            </aside>
          ) : null}
        </div>

        <nav
          aria-label="Page navigation"
          className="mt-16 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/decisions/${prev.slug}`}
              className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                ← Newer
              </span>
              <span className="mt-1 block text-sm font-medium text-foreground group-hover:text-primary">
                ADR-{prev.number}: {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/decisions/${next.slug}`}
              className="group block rounded-lg border border-border bg-card p-4 text-right transition-all hover:border-primary"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Older →
              </span>
              <span className="mt-1 block text-sm font-medium text-foreground group-hover:text-primary">
                ADR-{next.number}: {next.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      </main>
    </>
  )
}
