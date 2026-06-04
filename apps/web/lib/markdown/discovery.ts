import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Discover the repo's docs/ directory. Walks up from the compiled
 * module location and from process.cwd(). Returns the absolute path
 * to the docs/ directory; throws if not found within 10 levels.
 *
 * Used by docs/usage/, docs/decisions/, and the spec routes —
 * everything inside docs/ is reachable from this anchor.
 */
export function findDocsRoot(): string {
  const candidates: string[] = []

  try {
    const __filename = fileURLToPath(import.meta.url)
    let cursor = dirname(__filename)
    for (let i = 0; i < 10; i++) {
      candidates.push(join(cursor, "docs"))
      const parent = resolve(cursor, "..")
      if (parent === cursor) break
      cursor = parent
    }
  } catch {
    // ESM unavailable; fall through.
  }

  let cursor = process.cwd()
  for (let i = 0; i < 10; i++) {
    candidates.push(join(cursor, "docs"))
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }

  for (const candidate of candidates) {
    // Distinguishing marker: docs/README.md exists at the repo root's docs/.
    if (existsSync(join(candidate, "README.md"))) return candidate
  }
  throw new Error(
    `could not locate docs/ — searched ${candidates.length} candidates: ${candidates.slice(0, 5).join(", ")}…`,
  )
}
