import { readFile } from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-dynamic"

// Strict slug pattern — must match the Primitive Spec's name shape.
// Prevents path traversal: only [a-z0-9-] is acceptable.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!SLUG_RE.test(slug)) {
    return new Response("Invalid slug", { status: 400 })
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "content",
      "primitives",
      `${slug}.md`,
    )
    const content = await readFile(filePath, "utf-8")
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
