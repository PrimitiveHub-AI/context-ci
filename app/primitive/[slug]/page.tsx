import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { primitives, findPrimitiveBySlug } from "@/lib/data/primitives"
import { pipelineStages } from "@/lib/data/pipeline"
import { PrimitiveDetailView } from "@/components/primitives/primitive-detail-view"

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

export default async function PrimitiveDetailPage({ params }: PageProps) {
  const { slug } = await params
  const primitive = findPrimitiveBySlug(slug)
  if (!primitive) notFound()

  return <PrimitiveDetailView primitive={primitive} pipelineStages={pipelineStages} />
}
