/**
 * Recursive directory walker for `phub audit`.
 *
 * Zero deps, hand-rolled. Honors the documented skip-list and
 * meaningful-dotfile allowlist from ADR-0025 § "Walker discipline".
 *
 * Security choices:
 * - Does NOT follow symlinks. A symlink that crosses the project
 *   boundary is a distinct threat class outside v0.1 audit scope.
 * - Depth-bounded (default 12) and file-bounded (default 5000) so a
 *   pathological repository can't exhaust resources. Bounds are
 *   diagnostic, not security — exceeding them yields a truncated
 *   result + a warning, not a hard failure.
 * - Skip-list and dotfile-allowlist are vendored constants here, not
 *   user-configurable in v0.1. A future ADR adds `.phubignore`.
 */

import { readdirSync, lstatSync, type Dirent } from "node:fs"
import { join, relative } from "node:path"

/** Directory basenames that are always skipped. */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "target",
  "__pycache__",
  "venv",
  ".venv",
  ".tox",
  ".pytest_cache",
  ".cache",
])

/**
 * Dot-prefixed directory basenames that ARE walked because they hold
 * meaningful agent-context artifacts. Any other dot-prefixed directory
 * is silently skipped.
 */
export const KEEP_DOT_DIRS: ReadonlySet<string> = new Set([
  ".claude",
  ".cursor",
  ".github",
  // ADR-0028: `phub install` writes verified primitives into
  // `.primitivehub/installed/primitives/...` and re-audit must
  // discover them so drift detection survives reinstall + edit
  // attacks.
  ".primitivehub",
])

export interface WalkOptions {
  /** Hard cap on directory depth. 0 = root only. Default 12. */
  maxDepth: number
  /** Hard cap on file count returned. Default 5000. */
  maxFiles: number
}

export interface SkippedEntry {
  /** Path relative to walk root. */
  path: string
  /** Reason — one of: "skip-list", "hidden-dir", "symlink", "depth", "limit". */
  reason: SkipReason
}

export type SkipReason = "skip-list" | "hidden-dir" | "symlink" | "depth" | "limit"

export interface WalkResult {
  /** Absolute paths of every file the walker visited. */
  files: string[]
  /** Each entry the walker chose not to descend into, with reason. */
  skipped: SkippedEntry[]
  /** True iff the walker hit `maxFiles` before exhausting the tree. */
  truncated: boolean
}

export const DEFAULT_WALK_OPTIONS: WalkOptions = {
  maxDepth: 12,
  maxFiles: 5000,
}

/**
 * Walk `root` and return every file beneath it that survives the
 * skip-list + dot-prefix rules. Caller is expected to absolute-ize
 * `root` first (e.g. `path.resolve(userInput)`).
 */
export function walk(root: string, opts: WalkOptions = DEFAULT_WALK_OPTIONS): WalkResult {
  const files: string[] = []
  const skipped: SkippedEntry[] = []
  let truncated = false

  function pushSkipped(absPath: string, reason: SkipReason): void {
    skipped.push({ path: relative(root, absPath) || ".", reason })
  }

  function shouldKeepDir(name: string): boolean {
    if (SKIP_DIRS.has(name)) return false
    if (name.startsWith(".") && !KEEP_DOT_DIRS.has(name)) return false
    return true
  }

  function walkDir(dir: string, depth: number): void {
    if (truncated) return
    if (depth > opts.maxDepth) {
      pushSkipped(dir, "depth")
      return
    }

    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      // Unreadable directory (permissions etc.) — treat as skip.
      pushSkipped(dir, "skip-list")
      return
    }

    // Stable order so test snapshots and JSON output are reproducible.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const ent of entries) {
      if (truncated) return
      const abs = join(dir, ent.name)

      if (ent.isSymbolicLink()) {
        pushSkipped(abs, "symlink")
        continue
      }
      if (ent.isDirectory()) {
        if (!shouldKeepDir(ent.name)) {
          pushSkipped(abs, SKIP_DIRS.has(ent.name) ? "skip-list" : "hidden-dir")
          continue
        }
        walkDir(abs, depth + 1)
        continue
      }
      if (ent.isFile()) {
        if (files.length >= opts.maxFiles) {
          pushSkipped(abs, "limit")
          truncated = true
          return
        }
        files.push(abs)
        continue
      }
      // Sockets, FIFOs, block/char devices — silently ignored.
    }
  }

  // Verify the root exists and is a directory before walking; if it's a
  // single file, return it directly so `phub audit <file>` degrades to
  // `phub scan <file>` semantics on the discovery side.
  let rootStat
  try {
    rootStat = lstatSync(root)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`audit walk: cannot stat ${root}: ${msg}`)
  }
  if (rootStat.isSymbolicLink()) {
    pushSkipped(root, "symlink")
    return { files, skipped, truncated }
  }
  if (rootStat.isFile()) {
    files.push(root)
    return { files, skipped, truncated }
  }
  if (!rootStat.isDirectory()) {
    return { files, skipped, truncated }
  }

  walkDir(root, 0)
  return { files, skipped, truncated }
}
