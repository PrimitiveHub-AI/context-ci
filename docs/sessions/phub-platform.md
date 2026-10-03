---
id: phub-platform
owns: [compose*.yaml, infra/, deploy/, scripts/, pnpm-workspace]
depends_on: []
touches: [phub-web, phub-check-engine, phub-cli]
transcript: transcripts/phub-platform.jsonl
updated: 2026-10-02
---

## Charter
The ground everything runs on: Docker compose topology, nginx, deploy/preview workflow,
CI, and the pnpm workspace. Keep the "127.0.0.1:3000 IS production" reality safe to work on.

## Current state (2026-10-02)
- Compose files: compose.yaml + override/preview/launch/prod/deploy-local variants.
- Deploy topology: nginx proxies primitivehub.ai → 127.0.0.1:3000 running `pnpm dev` on the
  LIVE working tree — editing apps/web deploys instantly. Preview safely on a 2nd loopback
  port from a worktree (see docs/dev-host.md, docs/deploy.md).
- Branch of record: launch/noindex-lift-go-live. Analytics self-hosted (Umami, ADR-0046).

## Open items
- [ ] Harden preview-port workflow so dev edits never hit :3000 unintentionally.
- [ ] CI health across phub-* workflows.
- [ ] Irreversible launch flips (repo/npm/DNS/noindex) stay HUMAN-ONLY — document the gate.

## Decisions / ADRs
ADR-0045 (product-first launch + distribution repo), ADR-0046 (analytics).

## HELD / staged
(staged infra / compose variants — list before close)

## Resume prompt
```
Role: lead platform eng for the phub-platform bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-platform.md first.
Scope: compose*.yaml + infra/ + deploy/ + CI + pnpm workspace.
Constraints: containerize everything · bind 127.0.0.1 only · pnpm only (never npm install) ·
irreversible launch flips are human-only · never delete HELD.
Task: <this sprint's goal>.
First action: restate current topology (:3000 = prod), then plan before changing infra.
Update this ledger at close.
```

## Next cycle (ADR-0047) — 🟢 steady

- **Task:** Hold CI green + lean; keep registry/storage/auth/signing code flagged-dormant (not deleted); no MinIO/R2 on critical path.
- **Gain:** Velocity — low maintenance, no dead-weight infra.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
