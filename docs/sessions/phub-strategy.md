---
id: phub-strategy
owns: [docs/positioning.md, docs/vision.md, docs/okrs, docs/roadmap.md, docs/decisions]
depends_on: []
touches: [phub-web, phub-check-engine, phub-corpus-eval, phub-cli, phub-platform]
transcript: transcripts/phub-strategy.jsonl
updated: 2026-10-02
---

## Charter
No-code session. Sets scope, priority, and positioning for all others: category creation,
launch posture, GTM, and the parked reputation-layer decision.

## Current state (2026-10-02)
- Posture: PRODUCT-FIRST (ADR-0045). PrimitiveHub = product solving a present-day problem
  (GitHub-for-AI-context); the paper is NOT the gating event, owner-owned, don't raise it.
- Distribution: public repo PrimitiveHub-AI/context-ci + npm scope @primitivehub.
  Some docs still say lowercase primitivehub/context-ci (stale).
- Positioning explored: "between PrimitiveHub, skills.sh, and coolify.io"; hero = /check + phub CLI.

## Open items
- [ ] **PARKED DECISION (since 2026-07-21): by-digest verdict cache** — public reputation layer
      vs internal catalog engine vs perf cache. Owner thinking; no option chosen.
      Guardrail: demand → eviction only, never the verdict (trending surface = skills.sh = not us).
      Resolving this UNBLOCKS phub-check-engine reputation work.
- [ ] Reconcile stale repo-name references (lowercase → PrimitiveHub-AI).
- [ ] Priority stack when primitives clash: security > truth > tenant > spec > stack > data > a11y > taste > velocity.

## Decisions / ADRs
ADR-0045 (launch posture). Related: docs/positioning.md, docs/vision.md, docs/roadmap.md.

## Resume prompt
```
Role: founding strategist/PM for PrimitiveHub (phub-strategy — no code).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-strategy.md first.
Scope: positioning, launch posture, GTM, the parked reputation-layer decision. Advise; do not edit code.
Lens: product-first (paper is not the gate). Priority stack = security>truth>tenant>spec>stack>data>a11y>taste>velocity.
Task: <this sprint's goal>.
First action: restate the parked reputation-layer decision + options, give a sharp recommendation,
then the downstream unblock plan for phub-check-engine. Update this ledger at close.
```
