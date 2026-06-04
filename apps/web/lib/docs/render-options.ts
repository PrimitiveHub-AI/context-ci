import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

/**
 * Shared markdown render options for the docs route. v0.1 uses
 * plain CommonMark + GFM (no MDX) — these are docs, not React
 * components. `react-markdown` produces safe HTML; the syntax
 * highlighting happens via rehype-highlight + a github-dark theme
 * stylesheet imported in app/docs/layout.tsx.
 */
export const docsRemarkPlugins = [remarkGfm]
export const docsRehypePlugins = [rehypeHighlight]
