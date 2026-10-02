---
id: phub-check-engine
owns: [apps/api/checks, rules/CCI-*, trust-score, verdict-cache]
depends_on: [phub-platform]
touches: [phub-web, phub-corpus-eval, phub-cli]
transcript: transcripts/phub-check-engine.jsonl
updated: 2026-10-02
---

## Charter
Own the `/check` verdict engine: rules (`CCI-*`), trust-score computation, and the
by-digest verdict cache. Correctness-critical; moves slowly and deliberately.

## Current state (2026-10-02)
- Engine lives in `apps/api/checks`; async scan pipeline per ADR-0044.
- Verdict + scoring semantics per ADR-0041; multi-session isolation per ADR-0042.
- Known: CCI-005 false-positive is in the committed baseline (in-sample F1=0.991 reflects it).
- Trust score renders e.g. "12/100 fail" on high-risk corpora — findings are deterministic per digest.

## Open items
- [ ] CCI-005 false-positive: resolve or document (see docs/false-positive-resolution.md).
- [ ] Trust-score calibration review vs holdout (recall 0.832).
- [ ] Reputation-layer / verdict-cache scope — BLOCKED on phub-strategy decision (see that ledger).

## Decisions / ADRs
ADR-0041 (verdict+scoring), ADR-0042 (session isolation), ADR-0044 (async pipeline).

## HELD / staged
(staged rule variants / guarded verdict-cache code — list before close; never delete)

## Resume prompt
```
Role: lead eng for the phub-check-engine bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-check-engine.md first.
Scope: apps/api/checks + CCI-* rules + trust-score + verdict-cache. UI/corpus → log + flag.
Constraints: pnpm · containerize · 127.0.0.1 only · measured-truth numbers only · never delete HELD.
Task: <this sprint's goal>.
First action: restate current state + known FPs, then plan + open-items priority before editing.
Any public number must trace to bench/baseline. Update this ledger at close.
```
