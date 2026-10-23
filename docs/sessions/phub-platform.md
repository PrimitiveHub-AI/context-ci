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
- api/api-worker still run `primitivehub-api:dev` (runserver) via the stopgap overlay.
  **Prod image FIXED 2026-10-23** (`c72ec4d`): root cause was `uvicorn` never declared
  as a dependency (runner CMD runs `python -m uvicorn`, deps stage installs `--no-dev`
  → `No module named uvicorn`). Added `uvicorn[standard]` to prod deps + regen uv.lock;
  `docker build --target runner` now boots uvicorn + serves healthz 200 with DEBUG=False
  (verified against live DB/cache). **Cross-scope flag:** edited `apps/api/pyproject.toml`
  + `apps/api/uv.lock` (phub-check-engine's path) — platform-required runtime dep; logged
  here per the cross-session rule. **Live GHCR cutover still PENDING + human-gated** (flips
  live api/worker off the dev image + drops the source bind-mount — a topology change).
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
- [ ] **SSRF handoff, network half `[from: phub-check-engine]` (security — top of stack).** I closed the
      application-layer SSRF in `apps/api/checks/url_fetcher.py` (the `/check` `mode=url` fetcher now pins the
      actual connected peer IP + refuses non-https/redirect-bypass; was DNS-rebinding + redirect-auto-follow
      exploitable to reach the cloud metadata endpoint). **Your half:** block outbound egress from the api
      container to **169.254.169.254 / fd00:ec2::254 (IMDS)** and **RFC1918 + loopback** at the
      network/firewall layer, so a future fetch-guard regression still can't reach internal services. Fits the
      127.0.0.1-only bind posture. Originated by phub-cli; infra portion routed here.
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

## SSRF #1 — defence-in-depth (2026-10-23, security > all)

Handoff: docs/security/2026-10-23-ssrf-01-handoff.md (reporter abhibughunt3r,
high/unauth). Primary app-layer fix = phub-check-engine. Platform half:

- **DELIVERED in-repo** (safe, reviewable):
  - `infra/egress/ssrf-egress-guard.sh` + README — DOCKER-USER egress deny-list,
    subnet-aware (carves out the bridge so intra-stack survives), dry-run/apply/
    remove, idempotent. Dry-run verified (subnet 172.18.0.0/16).
  - `compose.deploy-local.yaml` — `DEBUG=True→False`, `ALLOWED_HOSTS=*`→pinned.
  - `scripts/check-prod-hardening.sh` — fails on DEBUG=True / wildcard hosts in
    resolved config OR live container.
- ✅ **LIVE FINDING FIXED 2026-10-23:** `primitivehub-api-1` was running
  `DEBUG=True` + `ALLOWED_HOSTS=*` (dev-image stopgap). Recreated with
  `DEBUG=False` + pinned ALLOWED_HOSTS + `SECURE_SSL_REDIRECT=False`. Verified
  healthy, all routes 200, smoke-prod PASS, no debug-page leak.
  - **Scar:** `DEBUG=False` auto-enables `SECURE_SSL_REDIRECT` (settings.py:281,
    default True) → 301s every non-`X-Forwarded-Proto:https` request, which killed
    the healthcheck on the first recreate (→ unhealthy). TLS is terminated at the
    edge, so the app must not self-redirect — pin `SECURE_SSL_REDIRECT=False`.
    First recreate was correctly BLOCKED from rolling back to DEBUG=True by the
    safety classifier; fixed forward instead.
- ✅ **EGRESS GUARD APPLIED + VERIFIED 2026-10-23** (human-run w/ sudo).
  From the api container: metadata 169.254.169.254 + RFC-1918 10.0.0.1 BLOCKED
  (timeout), public example.com 200, api/postgres/valkey/authentik all healthy
  (intra-stack intact). PHUB_EGRESS chain live in DOCKER-USER.
- **Persistence addressed (artifacts shipped 2026-10-23):**
  `infra/egress/phub-egress-guard.service` (systemd oneshot, re-applies on boot
  after docker) + `scripts/deploy.sh` hook (fail-closed `check-prod-hardening.sh`
  gate, then egress `--apply` after `up -d`). ⚠️ **One human step left:** install
  + enable the systemd unit on the host (`systemctl enable --now`) — until then
  the rules still vanish on reboot. Install cmds in infra/egress/README.md.
- **Latent landmine found:** `deploy.sh` regenerates a STRIPPED
  `compose.deploy-local.yaml` (web-only, no api hardening + no dev-image stopgap)
  if the file is ever missing — would ship DEBUG default + the broken prod api
  image. The new fail-closed hardening gate in deploy.sh now catches the DEBUG
  half; the dev-image-stopgap half is subsumed by the GHCR-cutover open item.
- **Open follow-ups:** wire `check-prod-hardening.sh` + egress `--apply` into
  `scripts/deploy.sh`; persist iptables across reboot (netfilter-persistent/
  systemd); re-run egress guard after any docker-network recreate.
- **Flagged to phub-check-engine** (in handoff doc, not their ledger — it had
  another session's uncommitted edits): TOCTOU IP-pin still open; url_fetcher
  echoes upstream errors (blind-SSRF exfil). Fail-closed per handoff.

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
