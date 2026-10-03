# Session tabs — how to run them (hub-and-spoke)

PrimitiveHub = **Context Firewall for AI agents** (ADR-0047): scan (/check) · author-safe
(/Forge) · block-at-load (phub/MCP/CI gate). Registry/marketplace = deferred/dormant.

**Model:** 1 orchestrator (`phub-strategy`) + focused work-tabs opened on demand. Each tab
reads `SPINE.md` + its ledger + `memory/*` first, stays in its lane, updates its ledger at close.
The ledgers are the durable memory — a fresh tab reconstructs full context from the repo.

**Open a tab:** `cd /srv/primitivehub/app && claude -n "<id>"` then paste its prompt below
(VSCode: "Claude Code: Open in New Tab"). **Resume later:** `claude --resume "<id>"`.
**Parallel edits:** give each tab its own branch/worktree (`git worktree add ../<id>-wt feat/<id>`).

Start the cycle with the two 🔴 tabs.

---

### 🔴 phub-corpus-eval  (BENCHMARK — detection credibility)
```
Role: lead for the phub-corpus-eval context of PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-corpus-eval.md before anything.
Scope: bench/, apps/web/content/primitives, paper/. Cross-scope → log in that ledger + flag; don't edit it.
Constraints: measured-truth only (no fake numbers) · never delete HELD · no Claude attribution · keep bench/scripts/gate.sh green.
Task: build a public, reproducible ADVERSARIAL BENCHMARK — grow the labeled attack corpus, emit per-detector precision/recall, and a "what we catch vs alternatives" report.
First action: restate the current baseline (F1 / Py↔TS parity) from the ledger, then give your plan + priority before editing. Update the ledger at close.
```

### 🔴 phub-cli  (RUNTIME GATE — the actual firewall)
```
Role: lead eng for the phub-cli context of PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-cli.md before anything.
Scope: packages/phub, packages/mcp-server, actions/phub-scan. Cross-scope → log + flag; don't edit it.
Constraints: pnpm · never delete HELD · no Claude attribution · ship a copy-paste "Try it now" for every surface.
Task: make `verify-before-load` the one-line inline Context Firewall — MCP middleware + CI action + CLI, inline BLOCKING, crisp low-false-positive verdicts, trivial install.
First action: restate current CLI/MCP/action state from the ledger, then plan + priority before editing. Update the ledger at close.
```

### 🟠 phub-check-engine  (DETECTORS + telemetry flywheel)
```
Role: lead eng for the phub-check-engine context of PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-check-engine.md before anything.
Scope: apps/api/checks, CCI-* rules, trust score. Cross-scope → log + flag; don't edit it.
Constraints: measured-truth numbers only · keep Py↔TS parity (gate green) · never delete HELD.
Task: close known FP/FN gaps, add attack classes, and design the anonymized /check-telemetry → threat-intel loop.
First action: restate current detectors + known FPs (e.g. CCI-005) from the ledger, then plan before editing. Update the ledger at close.
```

### 🟡 phub-web  (FUNNEL — /check demo + /Forge, firewall messaging)
```
Role: lead PM/eng for the phub-web context of PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-web.md before anything.
Scope: apps/web only. Engine/corpus changes → log in their ledger + flag; don't edit them.
Constraints: pnpm · 127.0.0.1 only · no fake numbers (DemoDataBadge) · never delete HELD · no Claude attribution.
Task: reframe the hero to "firewall"; polish the public /check demo and the /Forge live-as-you-type DX. Preview on a 2nd loopback port before production.
First action: restate current state from the ledger, then plan + priority before editing. Update the ledger at close.
```

### 🟢 phub-platform  (INFRA — keep CI green + lean)
```
Role: lead platform eng for the phub-platform context of PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-platform.md before anything.
Scope: compose*.yaml, infra/, deploy/, .github/workflows/, pnpm workspace. Cross-scope → log + flag.
Constraints: containerize · bind 127.0.0.1 only · pnpm only · irreversible flips are human-only · never delete HELD.
Task: hold CI green + lean; keep registry/storage/auth/signing code flagged-dormant (not deleted); no MinIO/R2 on the critical path (ADR-0047).
First action: restate current CI/topology state from the ledger, then plan before changing infra. Update the ledger at close.
```

### 🟢 phub-strategy  (ORCHESTRATOR — brand, flywheel, pricing; no code)
```
Role: founding strategist/PM for PrimitiveHub — a Context Firewall for AI agents (ADR-0047). No code; advise + decide.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-strategy.md before anything.
Scope: docs/decisions/*, positioning, vision, roadmap. Priority stack: security > truth > tenant > spec > stack > data > a11y > taste > velocity.
Task: reframe brand to "firewall"; design the /check-telemetry flywheel and the pricing model (free gate → paid enterprise). Set cross-session priorities.
First action: restate the current north star (ADR-0047) from the ledger, then give a sharp recommendation + the next-cycle priority order. Update the ledger at close.
```
