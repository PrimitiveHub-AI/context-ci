---
name: feedback-skill-consumption-receipt
description: "When consuming an external skill (Hard rule #6), log a Fetch→Audit→Distill→Delete receipt, audit the WHOLE tree (not just SKILL.md), and record a disposition (merge/new/reject)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fa7bef1c-831a-45c0-b362-b4e7a9c6fa5b
---

When ingesting an external AI skill under Hard rule #6, the user wants
each consumption **logged as a structured receipt** in this exact shape:

- **Fetched, didn't install** — cloned to `/tmp/primitivehub-skills/` at a
  pinned commit SHA; never the network `npx` execution path.
- **Audited it** — `phub audit` result **+ a whole-tree threat scan**
  (every file, not only `SKILL.md`).
- **Distilled, didn't copy** — what transferable signal landed where
  (merge into an existing primitive / new primitive), with version bump.
- **Deleted the source** — staging dir removed.
- **Disposition** — merge / new-primitive / **reject-as-redundant**.
  Disposition is a first-class step, not an afterthought.

**Why:** Three lessons came out of consuming 4 skills in one session
(2026-06-09):
1. **`phub audit` only inventories agent-context artifacts.** It reported
   "1/1 clean" on a skill dir while `skill.sh` and an auto-loaded
   `.github/copilot-instructions.md` sat un-scanned. "Clean" from phub is
   NOT "the skill is safe" — executable scripts + agent-instruction files
   (the real T5 surface) need a separate manual/code review.
2. **Pin the source SHA.** We clone a moving HEAD then delete it; without
   the commit SHA the provenance isn't reproducible (violates our
   content-addressing doctrine).
3. **"Reject" must be an allowed outcome.** Some skills overlap or
   conflict with existing primitives (e.g. a warm light-editorial skill
   vs our dark trust-infra theme) — admitting them is bloat. Per
   [[feedback-bloat-control]] + [[feedback-extract-reusable]], default to
   merge-or-reject, not auto-create.

**How to apply:** On every `npx skills add …` request, run the receipt
flow, scan the whole tree (warn on any executable / auto-loaded
instruction file phub didn't classify), decide disposition before
distilling, and surface the receipt to the user. Relates to Hard rule #6
(the policy), [[feedback-load-primitives]], and the
`discovery-and-design-discipline` primitive (the design-gate for any
phub/CLI change that comes out of this).
