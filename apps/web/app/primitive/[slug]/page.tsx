import { readFile } from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { primitives, findPrimitiveBySlug } from "@/lib/data/primitives"
import { pipelineStages } from "@/lib/data/pipeline"
import { PrimitiveDetailView } from "@/components/primitives/primitive-detail-view"
import { ComingSoonPanel } from "@/components/ui/coming-soon"
import { isEnabled } from "@/lib/flags"
import { Package } from "lucide-react"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return primitives.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const primitive = findPrimitiveBySlug(slug)
  if (!primitive) return {}

  const title = `${primitive.name} — ${primitive.fileName}`
  const description = primitive.description

  return {
    title,
    description,
    openGraph: {
      title: `${title} — PrimitiveHub`,
      description,
      type: "article",
      authors: [primitive.author],
    },
    twitter: {
      card: "summary",
      title: `${title} — PrimitiveHub`,
      description,
    },
    other: {
      "primitive:version": primitive.version,
      "primitive:status": primitive.status,
      "primitive:category": primitive.category,
      "primitive:license": primitive.license,
      "primitive:content-digest": primitive.contentDigest,
    },
  }
}

// Read the real domain-specific markdown from content/primitives/<slug>.md
// at build time. Returns null if the file does not exist — the view falls
// back to a generic template with a "template fallback" badge.
async function loadPrimitiveMarkdown(slug: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "content", "primitives", `${slug}.md`)
    return await readFile(filePath, "utf-8")
  } catch {
    return null
  }
}

export default async function PrimitiveDetailPage({ params }: PageProps) {
  if (!isEnabled("registry")) {
    return (
      <ComingSoonPanel
        icon={Package}
        label="Planned · with publishing"
        title="Primitive pages"
        description="Individual primitive pages open when the registry ships. You can scan any primitive now at /check."
        backHref="/check"
        backLabel="Go to /check"
      />
    )
  }
  const { slug } = await params
  const primitive = findPrimitiveBySlug(slug)
  if (!primitive) notFound()

  const markdownContent = await loadPrimitiveMarkdown(slug)

  return (
    <PrimitiveDetailView
      primitive={primitive}
      pipelineStages={pipelineStages}
      markdownContent={markdownContent}
    />
  )
}
