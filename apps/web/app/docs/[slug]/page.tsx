import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"

import { DocsNav } from "../docs-nav"
import { DOC_PAGES, getDocPage } from "@/lib/docs"
import { preprocessDocMarkdown, readDocSource } from "@/lib/docs/load"
import { docsRehypePlugins, docsRemarkPlugins } from "@/lib/docs/render-options"

export function generateStaticParams() {
  return DOC_PAGES.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getDocPage(slug)
  if (!page) return { robots: { index: false, follow: false } }
  return {
    title: `${page.title} — PrimitiveHub Docs`,
    description: page.description,
    robots: { index: false, follow: false },
  }
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getDocPage(slug)
  if (!page) notFound()

  const raw = readDocSource(page.file)
  const source = preprocessDocMarkdown(raw)

  const prevIndex = DOC_PAGES.findIndex((p) => p.slug === slug) - 1
  const nextIndex = prevIndex + 2
  const prev = prevIndex >= 0 ? DOC_PAGES[prevIndex] : undefined
  const next = nextIndex < DOC_PAGES.length ? DOC_PAGES[nextIndex] : undefined

  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <DocsNav currentSlug={slug} />
      </aside>

      <main className="min-w-0">
        <header className="mb-8 space-y-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="font-mono text-xs tabular-nums opacity-60">
              {String(page.order).padStart(2, "0")}
            </span>{" "}
            <span className="text-foreground">{page.title}</span>
          </nav>
        </header>

        <article className="prose-docs">
          <ReactMarkdown
            remarkPlugins={docsRemarkPlugins}
            rehypePlugins={docsRehypePlugins}
          >
            {source}
          </ReactMarkdown>
        </article>

        <nav
          aria-label="Page navigation"
          className="mt-16 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                ← Previous
              </span>
              <span className="mt-1 block text-sm font-medium text-foreground group-hover:text-primary">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group block rounded-lg border border-border bg-card p-4 text-right transition-all hover:border-primary"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Next →
              </span>
              <span className="mt-1 block text-sm font-medium text-foreground group-hover:text-primary">
                {next.title}
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
