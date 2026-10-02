---
id: phub-web
owns: [apps/web]
depends_on: [phub-platform]
touches: [phub-check-engine, phub-corpus-eval]
transcript: transcripts/phub-web.jsonl
updated: 2026-10-02
---

## Charter
Make primitivehub.ai the elite category-creator surface — marketing + product UI that
presents `/check` and the `phub` CLI as a new category, not a v0 SaaS toy.

## Current state (2026-10-02)
- Live site served from `apps/web` on 127.0.0.1:3000 (nginx proxies primitivehub.ai → it).
- `components/landing/check-showcase.tsx` and content/primitives under active edit (dirty tree).
- Preview workflow established: 2nd loopback port (e.g. 127.0.0.1:3100) from a worktree.

## Open items
- [ ] Kill "AI-designed kiddy" empty space; tighten visual density.
- [ ] Wire live `/check` demo on landing (consume engine output, not mocked).
- [ ] Credibility pass per expert critique (no unlabeled numbers — DemoDataBadge).

## Decisions / ADRs
ADR-0040 (surface/anti-bloat), ADR-0045 (product-first launch).

## HELD / staged
(record any staged-not-dead components here before close)

## Resume prompt
```
Role: lead PM/eng for the phub-web bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-web.md first.
Scope: you own apps/web only. Engine/corpus changes → log in their ledger + flag, don't cross.
Constraints: pnpm · containerize · 127.0.0.1 only · no fake numbers · never delete HELD · no Claude attribution.
Task: <this sprint's goal>.
First action: restate current state from the ledger, then give me the plan + open-items priority
before touching code. Preview on a 2nd loopback port; show me before production. Update this ledger at close.
```
