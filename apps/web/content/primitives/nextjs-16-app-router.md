---
spec_version: "0.1"
name: nextjs-16-app-router
version: 0.1.0
type: engineering
domain: frontend
author: PrimitiveHub Labs (synthesized from wsimmonds/claude-nextjs-skills + vercel-labs/next-skills + maintainer knowledge)
license: CC-BY-4.0
tokens: 4800
token_budget: 6500
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
  - v0
  - windsurf
use_when:
  - "Creating or modifying any file under app/"
  - "Choosing between server and client components"
  - "Adding generateStaticParams or generateMetadata"
  - "Working with async params/searchParams in Next.js 16"
  - "Implementing route handlers (app/**/route.ts)"
  - "Migrating a page from client to server (or vice versa)"
  - "Implementing layouts, loading, error, not-found special files"
do_not_use_when:
  - "Pages Router projects (this project is App Router only)"
  - "Non-Next.js React applications"
  - "Static-site generators that aren't Next.js"
attestation: cci-v0.1
description: "Next.js 16 App Router engineering — server-first by default, async params, generateStaticParams, generateMetadata, route handlers, and the React 19 patterns that ship with Next 16."
keywords: [nextjs, nextjs-16, app-router, server-components, react-19, static-generation]
references:
  - "https://nextjs.org/docs/app"
  - "https://react.dev/blog/2024/04/25/react-19"
---

# Next.js 16 App Router

## Purpose

This primitive teaches an AI agent how to build with Next.js 16's App
Router on top of React 19. It covers the server-by-default model, the
async-params change (Next 15+), `generateStaticParams` and
`generateMetadata`, route handlers, and the special files that compose
a route. It assumes Turbopack as the build system.

The most common mistakes when an AI writes Next.js code: (a) defaulting
to `"use client"` for files that don't need it, (b) treating params as
sync when they're now async-Promise, (c) inventing Pages-Router APIs
like `getStaticProps` / `getStaticPaths` / `getServerSideProps` that
don't exist in App Router, (d) using `next/head` instead of metadata
exports, (e) forgetting to add `generateStaticParams` for dynamic routes
the team wants prerendered.

This primitive eliminates those.

## Core Principles

- **Server components are the default.** Files in `app/` are server
  components unless they declare `"use client"` on the first line.
  Server components: can be `async`, can read from a database directly,
  cannot use hooks or browser APIs, ship zero client JS. Most pages
  should be server components.

- **Client component scope = the boundary, not the leaf.** Adding
  `"use client"` to a deeply nested component requires its parent
  (transitively) to import it from a client context too. Often the
  better pattern: keep the page server-rendered, lift only the
  interactive island into a small `"use client"` component, pass the
  data into it as serializable props.

- **`params` and `searchParams` are async (Promise) in Next 15+.** Page
  components signature is now
  `async function Page({ params, searchParams }: { params: Promise<{slug: string}>, searchParams: Promise<…> })`.
  You must `await params` before accessing `params.slug`. This is the
  single biggest source of confusion in modern Next code.

- **`generateStaticParams` replaces `getStaticPaths`.** Returns an array
  of param objects. Each becomes a prerendered route. Only works in
  server components (no `"use client"`). Pair with `dynamicParams =
  false` to 404 anything not in the list, or leave default (`true`) to
  generate on-demand for new slugs.

- **`generateMetadata` is async + per-route.** Lives in the same file
  as the page. Reads the same async `params`. Returns a `Metadata`
  object. Stop using `next/head`.

- **Route handlers replace API routes.** `app/api/<x>/route.ts` exports
  named `GET`/`POST`/etc. functions returning `Response` or
  `Response.json(…)`. The file we shipped for the health endpoint
  follows this exactly.

- **Caching defaults changed in Next 15.** `fetch()` is now no-store by
  default (was force-cache). Opt into caching explicitly with
  `{ next: { revalidate: <seconds> } }` or `{ cache: "force-cache" }`.

## Decision Rules

- **IF a component uses `useState`, `useEffect`, event handlers, or
  browser APIs THEN** mark it `"use client"`.
- **IF a page is mostly static content rendered from data THEN** keep
  it a server component, lift interactive bits into a small client
  island, pass data in via props.
- **IF a dynamic route should be prerendered at build THEN** export
  `generateStaticParams` returning `{ slug }[]`. We did this for
  `app/primitive/[slug]/page.tsx` in PR #1.
- **IF the route should 404 for any slug not in
  `generateStaticParams` THEN** add `export const dynamicParams =
  false`.
- **IF accessing `params.slug` THEN** the function must be `async` and
  you must `await params` first. Type the signature as
  `params: Promise<{slug: string}>`.
- **IF per-page metadata is needed THEN** export `generateMetadata` (or
  static `metadata`) from the page; do not use `next/head`.
- **IF the user asks for `getStaticProps`/`getServerSideProps`/
  `getStaticPaths` THEN** clarify that App Router doesn't have those;
  fetch directly in the async server component instead.
- **IF data must always be fresh THEN** rely on the Next-15 default
  no-store fetch behavior, or use `fetch(url, { cache: "no-store" })`
  explicitly for clarity.
- **IF data can be cached THEN** specify
  `fetch(url, { next: { revalidate: 3600 } })` and document the TTL.
- **IF an API endpoint is needed THEN** create `app/<path>/route.ts`
  with named exports `GET`/`POST`/etc. that return `Response`.

## Anti-Patterns

- **Defaulting to `"use client"` on every page.** Wastes the
  zero-JS-by-default benefit. Server-first.
- **Treating `params` as sync.** In Next 15+, `params.slug` without
  awaiting throws a runtime error in production.
- **Using `getStaticProps`, `getServerSideProps`, or `getStaticPaths`.**
  Pages Router only. Don't propose them.
- **Using `next/head`.** Replaced by `metadata` / `generateMetadata`.
- **`fetch()` without thinking about caching.** Pick: no-store (default
  Next 15) for fresh, revalidate-seconds for cached, force-cache for
  immutable. Comment which you chose.
- **`Link href="…"`-equivalent with raw `<a>`.** Full reload, loses
  client-side nav benefit. Always `<Link>`.
- **Putting `generateStaticParams` in a client component.** It silently
  doesn't work. Server components only.
- **Putting business logic in `route.ts` directly.** Route handlers
  should be thin glue calling lib/* helpers, so the same logic can be
  unit-tested without the route layer.

## Review Checklist

- [ ] Every `"use client"` directive is justified — interactivity,
      hooks, or browser APIs are actually used.
- [ ] Async server components correctly `await params` before access.
- [ ] Dynamic routes have `generateStaticParams` if they should
      prerender, with explicit `dynamicParams` choice.
- [ ] Per-page metadata via `generateMetadata` (async) or static
      `metadata` export. No `next/head`.
- [ ] `fetch()` calls have a deliberate cache choice with a comment if
      the choice isn't obvious.
- [ ] Internal navigation uses `<Link>`, not `<a>`.
- [ ] Route handlers return `Response` (often `Response.json(…)`).
- [ ] Server/client boundary kept small — interactive islands, not
      whole pages.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Read `app/layout.tsx` first to learn the project's root metadata and
   font wiring before touching any page.
2. For new pages, default to a server component. Add `"use client"`
   only when justified.
3. Always type `params` as `Promise<{ … }>` and `await` it in the body.
4. For dynamic routes, explicitly think about whether
   `generateStaticParams` should exist and recommend it when prerender
   makes sense (lists of known items, primitive slugs, etc.).
5. Co-locate `generateMetadata` with the page that produces it; never
   define page metadata in a layout if it varies per-page.
6. When refactoring a `"use client"` page to be partially server,
   extract the interactive parts into a small `*-view.tsx` or
   `*-tabs.tsx` client component the server page renders.

## Expected Output Format

For new page files, the structure is:

```tsx
// app/<route>/page.tsx (server component)
import type { Metadata } from "next"
import { notFound } from "next/navigation"

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return primitives.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const primitive = findPrimitiveBySlug(slug)
  if (!primitive) return {}
  return { title: primitive.name, description: primitive.description }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const primitive = findPrimitiveBySlug(slug)
  if (!primitive) notFound()
  return <PrimitiveDetailView primitive={primitive} />
}
```

The client view (`components/primitives/primitive-detail-view.tsx`) is
a separate `"use client"` component receiving `primitive` as a prop.

## Examples

A correct migration of a `"use client"` page to server-with-island is
in this very repo: `feat/server-split-and-demo-labels` PR moved
`/primitive/[slug]` from `ƒ Dynamic` to `● SSG` — the page split into
`page.tsx` (server) + `components/primitives/primitive-detail-view.tsx`
(client). 9 → 21 static pages at build.

## References

- Next.js 16 docs: https://nextjs.org/docs/app
- React 19 release notes: https://react.dev/blog/2024/04/25/react-19
- This repo's own server-split example: `app/primitive/[slug]/page.tsx`
  on `feat/server-split-and-demo-labels` (PR #1)
