#!/usr/bin/env bash
#
# session-worktree.sh — hard file-isolation for concurrent agent/dev sessions.
#
# The README "Multi-session coordination" board prevents file clobbering by
# *convention* (claim-before-edit). This script removes the need to trust the
# convention: each session gets its own `git worktree` — a separate checkout on
# its own branch, in its own directory — so two sessions editing the same file
# is physically impossible. See docs/decisions/0042-multi-session-isolation.md.
#
# Worktrees live OUTSIDE the main checkout (a sibling `*-sessions/` dir) so the
# dev stack's docker bind mount never recurses into them.
#
# THE SINGLE-STACK RULE: worktrees isolate *files*, not *ports/RAM*. Only ONE
# worktree may run `docker compose up` / `pnpm dev` at a time — they all share
# host port 3000 and the ~8 GB RAM floor (see CLAUDE.md § "Dev host minimum").
# Edit in parallel worktrees; run the stack in exactly one.
#
# Usage:
#   scripts/session-worktree.sh new <name> [base-ref]   # default base: main
#   scripts/session-worktree.sh list
#   scripts/session-worktree.sh rm  <name>
#
# Exit codes:
#   0  success.
#   1  bad usage or git error.
#   2  not inside a git repository.

set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "error: not inside a git repository" >&2
  exit 2
}
cd "$root"

repo_name="$(basename "$root")"
sessions_dir="$(dirname "$root")/${repo_name}-sessions"

usage() {
  sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

cmd="${1:-}"
case "$cmd" in
  new)
    name="${2:-}"
    base="${3:-main}"
    [ -n "$name" ] || { echo "error: 'new' needs a <name>" >&2; usage 1; }
    branch="session/${name}"
    path="${sessions_dir}/${name}"

    if [ -e "$path" ]; then
      echo "error: worktree path already exists: $path" >&2
      exit 1
    fi
    if git show-ref --verify --quiet "refs/heads/${branch}"; then
      echo "error: branch '${branch}' already exists — pick another <name> or rm it first" >&2
      exit 1
    fi

    mkdir -p "$sessions_dir"
    git worktree add -b "$branch" "$path" "$base"

    echo ""
    echo "✓ session worktree ready"
    echo "    branch:  ${branch}  (off ${base})"
    echo "    path:    ${path}"
    echo ""
    echo "  next:  cd ${path}"
    echo ""
    echo "  ⚠ SINGLE-STACK RULE: do NOT run 'docker compose up' or 'pnpm dev'"
    echo "    here if another worktree is already running the stack — they"
    echo "    collide on port 3000 and the ~8 GB RAM floor. Edit here; run the"
    echo "    stack in exactly one worktree. Localhost-only binding still applies."
    ;;

  list)
    git worktree list
    ;;

  rm)
    name="${2:-}"
    [ -n "$name" ] || { echo "error: 'rm' needs a <name>" >&2; usage 1; }
    path="${sessions_dir}/${name}"
    branch="session/${name}"

    git worktree remove "$path"
    echo "✓ removed worktree ${path}"
    echo "  branch '${branch}' is kept (never auto-delete code). When it has"
    echo "  landed or you are sure it is disposable:  git branch -d ${branch}"
    ;;

  ""|-h|--help|help)
    usage 0
    ;;

  *)
    echo "error: unknown command '${cmd}'" >&2
    usage 1
    ;;
esac
