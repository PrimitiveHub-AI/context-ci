---
name: feedback-bloat-control
description: "Doctrine bloat-control — max 5-10 primitives per feature, defensive-not-generative, compress-before-advise"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

When designing a feature or reviewing a primitive, the doctrine is **defensive-not-generative**: don't pile principles on; remove the ones that don't load-bear. Maximum **5-10 primitives per feature decision**. Beyond that, the cognition is noise and the agent dilutes attention across too many rules.

**Three governing rules:**

1. **Max 5-10 primitives per feature decision.** When you go to apply primitives, the touching→primitive map in CLAUDE.md should point to at most 5-10 entries for the change in front of you. If more match, the change is too broad — split it.

2. **Compress before advise.** When two primitives overlap heavily, restate the principle once instead of citing both. The reader's attention is finite; cite the one whose vocabulary fits the situation better.

3. **Priority stack tiebreaker.** If primitives conflict, the tiebreaker stack is:
   - **`security-engineering-supplychain`** (security wins over everything)
   - **`feedback-no-fake-numbers`** (truth over polish)
   - **`tailwind-v4-mastery` / `nextjs-16-app-router` / `shadcn-ui-composition`** (stack correctness over taste)
   - **`tufte-data-visualization` / `dashboard-information-design`** (quantitative truth over composition)
   - **`frontend-design-elite`** (taste over default)
   - Everything else.

4. **Elite hallucination ban.** Don't manufacture sophistication ("Tufte recommends...", "Per Anderson §17...") without the citation actually backing the claim. If you can't trace the recommendation to the primitive, don't credit it — argue from first principles instead.

**Why:** The user's prior project (Meteorium) accumulated 1,065 primitives across 17 books. Useful as a reference library, fatal as an operational guide if every PR consulted all of them. The corpus that landed in PrimitiveHub's `content/primitives/` is intentionally narrower (~12 primitives) and stays narrow by enforcing this rule.

**How to apply:**
- `discovery-and-design-discipline` is a **phase-0** primitive: it's loaded *before* you pick the surface's stack (to decide what to build and when to ask), so it does **not** count against the 5-10 per-feature cap — it precedes selection rather than joining the stack.
- Before citing a primitive in a PR or code review, check that it's actually load-bearing for the change at hand.
- When tempted to add a new primitive, ask: does this fit inside an existing one? If yes, update the existing one.
- When tempted to extend an existing primitive past ~5000 tokens, ask: are there two principles inside that should split?
- Reject "more is more" by default. The cost of an extra principle is attention; the cost of attention is wrong code.

Related: [[feedback-audit-methodology]], [[feedback-load-primitives]], [[feedback-never-delete-held-code]]
