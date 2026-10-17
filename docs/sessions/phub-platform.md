---
id: phub-platform
owns: [compose*.yaml, infra/, deploy/, scripts/, pnpm-workspace]
depends_on: []
touches: [phub-web, phub-check-engine, phub-cli]
transcript: transcripts/phub-platform.jsonl
updated: 2026-10-03
---

## Charter
The ground everything runs on: Docker compose topology, nginx, deploy/preview workflow,
CI, and the pnpm workspace. Keep the "127.0.0.1:3000 IS production" reality safe to work on.

## Current state (2026-10-03)
- Compose files: compose.yaml + override/preview/launch/prod/deploy-local variants.
- Deploy topology (CORRECTED — supersedes prior "pnpm dev = instant deploy" line): nginx →
  127.0.0.1:3000 = `primitivehub-web-1` running the **PROD build** (`ghcr…web:latest`,
  `next start`), NOT `pnpm dev`. `pnpm dev` behind Cloudflare 520s the HMR socket (bug #33), so
  the web container was flipped to prod on 2026-07-22. Deploy via `scripts/deploy.sh` +
  `scripts/smoke-prod.sh`; preview on a 2nd loopback port from a worktree. See
  memory/project_deploy_topology.md (source of truth) + docs/deploy.md.
- api/api-worker still run `primitivehub-api:dev` (runserver) — prod api image broken
  (`No module named uvicorn`); fix before GHCR cutover.
- Branch of record: launch/noindex-lift-go-live. Analytics self-hosted (Umami, ADR-0046).
- **Leanness audit (2026-10-03):** MinIO `profiles:[minio]` opt-in ✅, Umami `profiles:[analytics]`
  opt-in ✅, R2/S3 external (not a container) ✅ — none on the critical path. registry/storage/
  signing Django apps present + feature-dormant (schemas return deferred defaults), NOT deleted ✅.
  All inspected port specs are 127.0.0.1-bound ✅ (Layer-1 posture clean).
- **authentik (server+worker): LIVE, NOT dormant.** Containers up 4 months, healthy, in dev AND
  prod; `DEV_AUTH_BYPASS` retired (Step 7); every read endpoint behind `requires_auth`. It is NOT
  profile-gated and MUST NOT be gated without first enabling the profile in prod `.env` — doing so
  = live auth outage. See Open items.
- CI state: restated from SPINE (real regression gate GREEN @ 2026-10-02). NOT re-verified live —
  `gh` is unauthenticated on this host; no live run query performed this session.

## Open items
- [ ] Harden preview-port workflow so dev edits never hit :3000 unintentionally.
- [ ] CI health across phub-* workflows (cannot query live: `gh` unauthenticated here).
- [ ] Irreversible launch flips (repo/npm/DNS/noindex) stay HUMAN-ONLY — document the gate.
- [ ] **Auth-deferral (ADR-0047) escalated to phub-strategy (owner) + flagged in phub-web.**
      Owner picked "defer auth entirely": make /check + /Forge anonymous-public, retire login.
      This is a product+liability scope call, not a platform flip — I did NOT change infra.
      On ratify, platform will profile-gate authentik (HELD, never delete) + drop OIDC from the
      critical path. Also needs flagging in phub-check-engine.md (its ledger had uncommitted edits
      from another session this session, so I did not touch it — route this there).
- [ ] **FLAG [cross-scope]:** working tree dirty outside my scope — `apps/api/checks/…`,
      `apps/api/scanners/t5…`, `packages/phub/src/scanners/t5…`, untracked `bench/alternatives/`,
      `bench/comparison/`, `bench/scripts/compare.py`, `docs/comparison.md`. Owned by
      phub-check-engine + phub-corpus-eval. Not mine to commit. SPINE "working tree clean @
      2026-10-02" is stale.

## Decisions / ADRs
ADR-0045 (product-first launch + distribution repo), ADR-0046 (analytics).

## HELD / staged
- `authentik-server` + `authentik-worker` (compose.yaml) — currently LIVE, but if auth-deferral
  ratifies these become HELD (profile-gated, never deleted). Do not remove the services or the
  OIDC env wiring.
- registry/storage/signing Django apps (apps/api/{registry,storage,signing}) — feature-dormant,
  in INSTALLED_APPS, schemas return deferred defaults. HELD for later ADR-0047 phases. Never delete.
- MinIO (compose.override.yaml, `profiles:[minio]`) — opt-in offline-dev storage. Staged, not dead.

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
