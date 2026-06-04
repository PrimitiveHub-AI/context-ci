import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

/**
 * Shared markdown render options for the docs route. v0.1 uses
 * plain CommonMark + GFM (no MDX) — these are docs, not React
 * components. `react-markdown` produces safe HTML; the syntax
 * highlighting happens via rehype-highlight + a github-dark theme
 * stylesheet imported in app/docs/layout.tsx.
 *
 * `rehype-slug` assigns `id` attributes to every heading using the
 * same GitHub-style algorithm the TOC extractor uses (see
 * `lib/markdown/toc.ts`). This keeps in-page anchors and the
 * sidebar TOC links in lockstep — if the slugs ever diverge, the
 * TOC link breaks visibly.
 */
export const docsRemarkPlugins = [remarkGfm]
export const docsRehypePlugins = [rehypeSlug, rehypeHighlight]
