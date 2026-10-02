---
name: feedback-priority-stack
description: "Tiebreaker stack when primitives, principles, or taste calls conflict — security first, taste last, velocity below safety."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

When two principles or two primitives disagree, resolve by this stack.
Higher always wins.

```
1. Security / cryptographic correctness
   — security-engineering-supplychain primitive
   — docs/threat-model.md
   — every "Trusted" badge must be backed by an attestation

2. Truth (no fake numbers, reproducibility)
   — feedback-no-fake-numbers memory
   — every metric is reproducible OR labeled <DemoDataBadge>

3. Tenant isolation
   — ddia-multi-tenant + RLS policy + application scoping
   — never silently leak a row across orgs

4. Spec conformance
   — Primitive Spec v0.1 (docs/spec.md) is the contract
   — implementation matches the spec; if they disagree, the spec is right

5. Stack correctness
   — nextjs-16-app-router, tailwind-v4-mastery, shadcn-ui-composition,
     django-ninja-production, postgresql-production
   — wrong-stack code is wrong, even when it ships

6. Quantitative truth (data display)
   — tufte-data-visualization, dashboard-information-design
   — a more honest chart beats a prettier one that misleads

7. Accessibility
   — accessibility-wcag22 (WCAG 2.2 AA + ARIA APG)
   — every interactive surface is keyboard-navigable + screen-reader-safe

8. Taste / restraint
   — frontend-design-elite
   — less chrome is more; signal over noise

9. Velocity
   — ship cleanly under the priorities above
   — never trade rank 1-7 for rank 9
```

**Why this order specifically:**

- **Security at the top** because PrimitiveHub's entire product is a
  trust layer. A single cross-tenant leak would invalidate the
  paper's claims and the brand.
- **Truth ranks above tenant isolation** because a fake number on a
  surface lies about the system; tenant isolation is one of the
  things being lied about if truth fails.
- **Spec above stack** because the spec is the contract paper readers
  will cite. The stack is implementation detail.
- **Accessibility above taste** because a beautiful UI that excludes
  users isn't elite — it's exclusionary.
- **Velocity at the bottom** because no PR is so urgent that it
  justifies skipping rank 1-7. If the calendar forces a tradeoff,
  cut scope, not safety.

**How to apply:**

When two primitives clash on a recommendation, look up where each
sits in the stack. The higher one wins. State the call explicitly:
"This conflicts — primitive A (taste) says X, primitive B (security)
says Y. Going Y per stack rank 1 > rank 8."

**Anti-pattern:** Resolving conflicts by "whichever is more recent" or
"whichever sounds smarter." The stack is the tiebreaker, not vibes.

Related: [[feedback-bloat-control]], [[feedback-load-primitives]],
[[feedback-self-audit]]
