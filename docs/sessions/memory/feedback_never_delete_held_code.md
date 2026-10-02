---
name: feedback-never-delete-held-code
description: "NEVER delete code marked \"held\" for next phase — it's staged, not dead"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

If you encounter code marked with comments like `// HELD for Phase X`, `// HELD pending UI`, `// DRAFT — keep for follow-up`, or any equivalent: **do not delete it**. Held code is staged for a specific future use; the author is keeping it warm because deleting and re-creating is more expensive than letting it live in the source tree until the follow-up lands.

**Equally:** if you encounter a file in `_drafts/`, `staged/`, `apps/api/registry/scanners_held/`, or similar — same rule. Don't delete. Don't rename. Don't aggressively "clean up." If the dir is documented as held, it's held.

**Why:** The user has a working pattern of preparing backend code for a frontend that lands a week later (or vice versa). Deleting the held side because "the other side isn't using it yet" doubles the work and destroys staged context. This rule was instituted in their prior project after exactly that happened.

**How to apply:**
- Before deleting any code, check for HELD markers (comment, file path, README mention).
- If a "dead code" cleanup pass is requested, scope it to truly dead code (referenced by nothing, no held marker, no draft directory).
- If unsure whether something is held, ASK rather than delete. The cost of asking is small; the cost of recreating lost code is large.
- If something must be removed (e.g., security risk), discuss with the user first; capture the held code somewhere recoverable (a branch, a gist, the PR description) before deletion.

Related: [[feedback-audit-methodology]], [[feedback-self-audit]], [[feedback-bloat-control]]
