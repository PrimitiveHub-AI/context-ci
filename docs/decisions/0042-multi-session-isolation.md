# ADR-0042: Multi-session isolation — coordination board + git-worktree hard isolation

**Status:** Accepted
**Date:** 2026-06-05
**Related:** `README.md` § "Multi-session coordination",
`scripts/session-worktree.sh`, CLAUDE.md § "Workflow", CLAUDE.md §
"Dev host minimum", `docs/decisions/0031-pre-launch-posture-automation.md`
(localhost-only binding the runtime rule inherits).

## Context

More than one agent/dev session now works this repository at once. Two
distinct failures result, and they have different root causes:

1. **Lost continuity.** A fresh session has no memory of what the last
   one did, so it re-does landed work or contradicts an open decision.
2. **Clobbered files.** Two sessions edit the same file; the second
   write silently overwrites the first.

A third, frequently-conflated symptom is **runtime contention** — the
dev stack OOMs or two `next dev` servers fight for port 3000. This is
*not* a source-control problem and no documentation artifact fixes it;
it is governed by the host-headroom rules in CLAUDE.md § "Dev host
minimum" and the localhost-only binding of ADR-0031.

This very ADR is a worked example of failure (1)+(2): at authoring time
`main` carried ADRs through 0036, while 0037–0040 sat unmerged on
`feat/corpus-steering-wheel` and 0041 existed only as an untracked file
from a third session. Picking the "next" ADR number required reconciling
three concurrent worktrees by hand — exactly the coordination cost this
ADR exists to bound.

## Decision

Adopt a **two-layer** model. Each layer answers one failure; neither
pretends to answer the runtime symptom.

### Layer 1 — the coordination board (convention, continuity)

A live board in `README.md` § "Multi-session coordination": on start,
read it + `git log`; before editing, add a claim row; on stop, clear or
update the row. It is **current-state only**, never a changelog — git
history and ADRs remain the permanent record. The board is cheap and
sufficient when sessions are *cooperative* (they reliably read + claim).

Its limit is honesty about its own nature: it is an honor system. It
cannot *prevent* an overwrite, only make one less likely.

### Layer 2 — git-worktree isolation (mechanism, no overwrites)

When cooperation cannot be assumed, `scripts/session-worktree.sh new
<name>` gives a session its own `git worktree`: a separate checkout on
its own `session/<name>` branch off `main`, in a sibling
`<repo>-sessions/<name>/` directory. Two sessions editing the same path
is then *physically impossible* — they hold different files on different
branches. Merge resolves divergence through review, where it belongs.

Worktrees live outside the main checkout so the dev stack's docker bind
mount (`apps/web/`) never recurses into them.

### The single-stack rule (closes the runtime half)

Worktrees isolate *files*, not *ports or RAM*. The rule, enforced by
loud script output and documented in README § "Runtime hygiene":
**exactly one worktree runs the dev stack at a time.** Edit in parallel
worktrees; run `docker compose up` / `pnpm dev` in one. This is what
keeps Layer 2 from re-introducing the port-3000 / 8-GB contention it
would otherwise cause.

## Consequences

- **Positive.** Overwrites become impossible under Layer 2, not merely
  discouraged. Continuity is recorded without duplicating git. Runtime
  contention is named and bounded rather than blamed on app code.
- **Cost.** Each worktree needs its own `node_modules` / `.next` (disk +
  one `pnpm install`). Acceptable: it is opt-in, only for genuinely
  concurrent work.
- **Discipline.** Layer 1 decays if sessions skip claiming; Layer 2 only
  helps if sessions actually use the script. Both are wired into
  CLAUDE.md § "Workflow" so every session reads the rule at startup.
- **Bloat.** One script + one README section + this ADR. No new
  dependency (`git worktree` is built in). Honors `feedback-bloat-control`.

## Alternatives considered

- **Board only (no Layer 2).** Rejected as the *sole* answer: the user
  reported real overwrites, so honor-system alone is insufficient. Kept
  as Layer 1 because it is the right tool for continuity and the cheap
  default for cooperative sessions.
- **A file lock / lease file in-repo.** Rejected: a lock file is itself
  shared mutable state two sessions can race on, and a stale lock blocks
  work with no clean owner. Worktrees push isolation down to the
  filesystem + git, which already have the right primitives.
- **One worktree per session running its own full stack.** Rejected: it
  multiplies the 8-GB RAM floor per session and needs per-worktree port
  remapping. The single-stack rule is strictly cheaper and sufficient.
