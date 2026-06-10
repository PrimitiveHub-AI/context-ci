/**
 * Docs page registry. The single source of truth for which pages
 * exist, in what order, and where their markdown lives on disk.
 *
 * Markdown source: <repo-root>/docs/usage/*.md
 * URL surface:     /docs/<slug>
 *
 * Adding a page = one entry here + the corresponding markdown file.
 * The repo-side numeric prefix (01-, 02-, …) preserves source-order
 * in the file tree; the URL drops it for clean links.
 */

export interface DocPage {
  slug: string
  title: string
  /** Filename in docs/usage/ */
  file: string
  /** Display order in the sidebar (1-indexed). */
  order: number
  /** One-line description shown on the docs index. */
  description: string
}

export const DOC_PAGES: readonly DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    file: "01-getting-started.md",
    order: 1,
    description:
      "Install pre-launch from the monorepo or post-launch via npm. Three install paths + smoke verification.",
  },
  {
    slug: "trust-contract",
    title: "Trust Contract",
    file: "02-trust-contract.md",
    order: 2,
    description:
      "The wire format every surface speaks: Content Digest + Signature + Attestation + Provenance Chain. How to verify, how to read a bundle, how refusals work.",
  },
  {
    slug: "phub-cli",
    title: "phub CLI",
    file: "03-phub-cli.md",
    order: 3,
    description:
      "Complete reference for every phub subcommand: scan, audit, watch, install, verify, init. Flags, exit codes, examples.",
  },
  {
    slug: "context-policy",
    title: "Context Policy Language",
    file: "04-context-policy.md",
    order: 4,
    description:
      "The .primitivehub/policy.yaml spec: per-file allows, severity overrides, glob matching, FP-NNN ledger discipline.",
  },
  {
    slug: "phub-lock",
    title: "phub.lock",
    file: "05-phub-lock.md",
    order: 5,
    description:
      "The canonical lockfile for AI agent context. Drift detection, the four lock flags, integration workflows.",
  },
  {
    slug: "github-action",
    title: "GitHub Action",
    file: "06-github-action.md",
    order: 6,
    description:
      "primitivehub/phub-scan composite Action. SARIF upload to Code Scanning, gating PRs, inputs + outputs.",
  },
  {
    slug: "mcp-server",
    title: "MCP Server",
    file: "07-mcp-server.md",
    order: 7,
    description:
      "Model Context Protocol server exposing PrimitiveHub to AI agents. Five JSON-RPC tools. Claude / Cursor / Aider integration.",
  },
  {
    slug: "verify-library",
    title: "verify Library",
    file: "08-verify-library.md",
    order: 8,
    description:
      "@primitivehub/verify — embeddable Trust Bundle verifier. 30-line embed pattern, error codes, TypeScript types.",
  },
  {
    slug: "recipes",
    title: "Recipes",
    file: "09-recipes.md",
    order: 9,
    description:
      "End-to-end workflows: CI-gated project, Claude Code workspace, runtime-checking agent, FP triage cycle.",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    file: "10-troubleshooting.md",
    order: 10,
    description:
      "Every error message v0.1 emits + the fix. Organized by surface (install / scan / lock / MCP / Action / verify).",
  },
] as const

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug)
}

/**
 * Map "01-getting-started.md" → "getting-started" the same way the
 * registry does, so link rewriting in markdown bodies stays in sync.
 */
export function fileToSlug(file: string): string | null {
  const page = DOC_PAGES.find((p) => p.file === file)
  return page?.slug ?? null
}
