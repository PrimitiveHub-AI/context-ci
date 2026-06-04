import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { join } from "node:path"

import { SpecsNav } from "../specs-nav"
import { PageToc } from "@/components/docs/page-toc"
import { findDocsRoot } from "@/lib/markdown/discovery"
import { rewriteMarkdownLinks } from "@/lib/markdown/link-rewriter"
import { extractToc } from "@/lib/markdown/toc"
import { docsRehypePlugins, docsRemarkPlugins } from "@/lib/docs/render-options"
import { SPEC_PAGES, getSpecPage, readSpecSource } from "@/lib/specs"

export function generateStaticParams() {
  return SPEC_PAGES.map((spec) => ({ slug: spec.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const spec = getSpecPage(slug)
  if (!spec) return { robots: { index: false, follow: false } }
  return {
    title: `${spec.title} — PrimitiveHub Specs`,
    description: spec.description,
    robots: { index: false, follow: false },
  }
}

const DOCS_DIR = findDocsRoot()

export default async function SpecSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const spec = getSpecPage(slug)
  if (!spec) notFound()

  const raw = readSpecSource(spec.file)
  const source = rewriteMarkdownLinks(raw, join(DOCS_DIR, spec.file))
  const toc = extractToc(source)

  const idx = SPEC_PAGES.findIndex((p) => p.slug === slug)
  const prev = idx > 0 ? SPEC_PAGES[idx - 1] : undefined
  const next = idx < SPEC_PAGES.length - 1 ? SPEC_PAGES[idx + 1] : undefined

  return (
    <>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SpecsNav currentSlug={slug} />
      </aside>

      <main className="min-w-0">
        <header className="mb-8 space-y-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/specs" className="hover:text-foreground">
              Specs
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="font-mono text-xs tabular-nums opacity-60">
              v{spec.version}
            </span>{" "}
            <span className="text-foreground">{spec.title}</span>
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
              href={`/specs/${prev.slug}`}
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
              href={`/specs/${next.slug}`}
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
