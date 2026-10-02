---
name: feedback-audit-methodology
description: Five-layer audit protocol — apply to every non-trivial PR before declaring it done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Before claiming a feature is "done," walk it through the five-layer audit. Each layer is a different lens; a feature can pass code review but fail BA, or pass UX but fail data integrity. All five layers gate "done."

**The five layers:**

1. **Feature Map.** Does this feature actually serve a stated objective in the project, or did it appear out of design momentum? Trace the requirement back to the spec, threat model, or user instruction. If you can't, surface that.

2. **BA (Business Analysis).** Who uses this, when, why? What does success look like in one sentence? What does failure look like? If "the user clicked it" is the only success metric, the BA is incomplete.

3. **SA (Systems Analysis).** What does the feature depend on? What depends on it? What's the failure mode if a dependency is unavailable? What's the migration story if the feature is removed?

4. **UX.** Does the surface match `DESIGN.md` doctrine? Does it match the locked microcopy register (no buzzwords, no exclamation marks, no marketing-AI tone)? Are empty states designed? Are loading states deliberate? Are demo numbers labeled?

5. **Data / API.** What new tables, columns, indexes, endpoints? Are migrations rolling-deploy safe? Are tenant-scoping + RLS policies applied? Are IDOR traces documented? Are caches explicitly invalidated on writes? Is `check-data.mjs` or `check_schema.py` still green?

**Why:** The user has shipped multi-product audits before and this 5-layer framework reliably catches what code review alone misses. The Meteorium project used it; PrimitiveHub adopts it.

**How to apply:**
- Before reporting "ready for review," walk the diff through all five layers in the PR description.
- For each layer, state explicitly: passed / partial / N/A. "Partial" is fine if documented; silent omission is not.
- If two reviewers disagree, the layer they disagree on is the discussion focus.
- The protocol is recursive: a feature's audit can produce findings that become their own mini-features needing their own audits. Bound the recursion at two levels deep — beyond that, file a follow-up.

Related: [[feedback-self-audit]], [[feedback-bloat-control]], [[project-primitivehub]]
