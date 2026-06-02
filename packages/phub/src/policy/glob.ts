/**
 * Minimal glob matcher for Context Policy v0.1 path patterns.
 *
 * Spec § 4.2 — supports:
 *   *    one segment (no /)
 *   **   any number of segments
 *   ?    one character (no /)
 *
 * Matches if EITHER the full path OR the basename matches the glob.
 * Per spec: a pattern like `CLAUDE.md` matches the file at any depth.
 */

/** Convert a glob pattern to a RegExp anchored at start + end. */
function globToRegex(glob: string): RegExp {
  let pattern = ""
  let i = 0
  while (i < glob.length) {
    const ch = glob[i]
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // ** — any number of segments (including zero)
        pattern += ".*"
        i += 2
        // Skip a trailing / after ** to allow "docs/**/file.md" to match "docs/file.md"
        if (glob[i] === "/") i++
      } else {
        // * — any chars except /
        pattern += "[^/]*"
        i += 1
      }
    } else if (ch === "?") {
      pattern += "[^/]"
      i += 1
    } else if (ch !== undefined && /[.+^$()|[\]{}\\]/.test(ch)) {
      pattern += "\\" + ch
      i += 1
    } else if (ch !== undefined) {
      pattern += ch
      i += 1
    }
  }
  return new RegExp("^" + pattern + "$")
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? path : path.slice(slash + 1)
}

/** True when `path` matches `glob` per spec § 4.2. */
export function matchGlob(glob: string, path: string): boolean {
  const re = globToRegex(glob)
  if (re.test(path)) return true
  if (re.test(basename(path))) return true
  return false
}

/** True when any glob in `globs` matches `path`. */
export function matchAnyGlob(globs: readonly string[], path: string): boolean {
  return globs.some((g) => matchGlob(g, path))
}
