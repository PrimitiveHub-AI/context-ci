---
name: feedback-no-fake-numbers
description: Never present unverified numbers as fact; either reproduce them or label them as demo/seed data
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Every benchmark percentage, scanner false-positive rate, validation stage score, install count, or quality metric on a PrimitiveHub surface must either be:
- (a) backed by a reproducible measurement we can defend in the arXiv paper, OR
- (b) clearly labeled as `[demo]` via `<DemoDataBadge>` with explanatory text

**Why:** The product's entire value proposition is *trust*. The launch is coordinated with an arXiv paper claiming PrimitiveHub addresses real supply-chain attacks on AI agent context. The user has explicitly framed this as a research contribution. Any number presented as fact that we can't reproduce becomes a credibility-killing footnote in the paper review — or worse, a Twitter callout post-launch. We already added DemoDataBadge to 9 sites in feat/server-split-and-demo-labels for exactly this reason.

**How to apply:**
- Any new metric in UI: ask "can we reproduce this for the paper?" If no → DemoDataBadge.
- Any number cited in marketing copy: same question.
- Any "+X% improvement" claim: must come from a real validation/benchmark run, not seeded constants.
- Before paper submission: audit every visible number, remove DemoDataBadge from anything we can now reproduce, keep DemoDataBadge on anything still synthetic (or remove the synthetic display entirely).
- When in doubt: prefer "no number" over "fake number."

Related: [[project-launch-posture]], [[project-primitivehub]]
