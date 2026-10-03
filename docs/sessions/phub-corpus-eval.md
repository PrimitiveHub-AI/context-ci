---
id: phub-corpus-eval
owns: [apps/web/content/primitives, bench/, paper/]
depends_on: [phub-check-engine]
touches: [phub-web, phub-strategy]
transcript: transcripts/phub-corpus-eval.jsonl
updated: 2026-10-02
---

## Charter
The "measured truth" domain: the expert primitive corpus plus the evaluation harness
(`bench/`) and paper. Every public/UI number originates here and must be reproducible.

## Current state (2026-10-02)
- Primitives under `apps/web/content/primitives/*` (many dirty — active authoring).
- Eval harness in `bench/` (baseline, corpus, cli, scripts); `bench/baseline` is the source of record.
- Committed baseline: in-sample F1=0.991 (reflects CCI-005 FP); TS holdout recall 0.832.
- Paper numbers echo this baseline — NOT the stale all-1.000 claim.

## Open items
- [ ] Grow/curate corpus; keep top10-corpus-map.md in sync.
- [ ] Re-run bench on any rule change from phub-check-engine; update baseline + paper together.
- [ ] Resolve stale-number references site-wide (coordinate with phub-web).

## Decisions / ADRs
docs/evaluation.md, docs/paper-bibliography.md, project memory: paper_measured_truth.

## HELD / staged
(staged corpus entries / fixtures — list before close)

## Resume prompt
```
Role: lead for the phub-corpus-eval bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-corpus-eval.md first.
Scope: content/primitives + bench/ + paper/. Engine/UI changes → log + flag.
Constraints: NO fake numbers — every metric traces to bench/baseline or is a labeled DemoDataBadge.
pnpm · never delete HELD · measured-truth only.
Task: <this sprint's goal>.
First action: restate current baseline (F1 0.991 / recall 0.832) + what's reproducible,
then plan before editing. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🔴 spearhead

- **Task:** Public, reproducible ADVERSARIAL BENCHMARK — grow labeled attack corpus, per-detector precision/recall, 'what we catch vs others' report.
- **Gain:** Detection credibility — the proof incumbents can't fake; earns the 'firewall' claim.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
