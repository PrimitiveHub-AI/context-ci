/**
 * Canonical external URLs for the public project — single source of truth.
 *
 * The org/repo is flipped in ONE place at go-public. Per Hard rule #5 the
 * actual repo push / org claim is owner-triggered; this constant only keeps
 * the site internally consistent and off the stale `DevXYZx/primitivehub`
 * placeholder that had drifted across ~11 files (the navbar already used the
 * canonical value).
 *
 * Canonical repo per DESIGN.md §0 + the launch-posture memory:
 * `PrimitiveHub-AI/context-ci` (the one public OSS repo, assembled from this
 * monorepo). NOTE: the deep blob/tree sub-paths callers append (docs/*,
 * paper/, SECURITY.md) assume the monorepo doc layout; the public `context-ci`
 * tree is owner-finalized at launch — revisit the sub-paths at that point.
 */
export const GITHUB_REPO_URL = "https://github.com/PrimitiveHub-AI/context-ci"
export const GITHUB_BLOB_BASE = `${GITHUB_REPO_URL}/blob/main`
export const GITHUB_TREE_BASE = `${GITHUB_REPO_URL}/tree/main`
export const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`

/**
 * Public in-app home for a monorepo doc/artifact path.
 *
 * The public `context-ci` repo is a SUBSET (verify + phub + mcp-server +
 * the action) — it never ships `docs/`, `bench/`, or `paper/`. So a GitHub
 * blob link into those 404s permanently, before AND after the repo is
 * pushed. The website is the public home for that content, so every proof
 * link resolves here instead. Unmapped paths fall back to /paper (the
 * scoreboard) rather than a dead GitHub URL.
 *
 * - ADRs map 1:1 to /decisions/<slug>
 * - FP/FN ledgers, bugs, SECURITY* → /security (topical home)
 * - OWASP crosswalk → /top-10
 * - evaluation, corpus, corpus-map, paper source, anything else → /paper
 */
export function docRoute(repoPath: string): string {
  const p = repoPath.replace(/^\/+/, "")
  const adr = /^docs\/decisions\/(.+)\.md$/.exec(p)
  if (adr) return `/decisions/${adr[1]}`
  if (/false-(positive|negative)-resolution|(^|\/)bugs\.md$|SECURITY/i.test(p)) return "/security"
  if (/owasp/i.test(p)) return "/top-10"
  return "/paper"
}
