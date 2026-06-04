/**
 * Server-component wrapper. Loads the search index at render time
 * (Node.js fs read of the docs corpus), passes it as a plain JSON
 * prop to the client-side palette.
 *
 * The index is ~800 entries × ~80 chars each ≈ 60 KB raw / ~15 KB
 * gzipped. Shipped to the client once per layout render.
 */

import { getSearchIndex } from "@/lib/docs/search-index"

import { SearchPalette } from "./search-palette"

export function SearchTrigger() {
  const index = getSearchIndex()
  return <SearchPalette index={index} />
}
