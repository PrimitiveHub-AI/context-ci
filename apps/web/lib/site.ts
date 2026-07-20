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
