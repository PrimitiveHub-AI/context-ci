# Dev host requirements & memory-pressure troubleshooting

> Extracted from `CLAUDE.md` to keep the contract lean (ADR-0040
> anti-bloat). **Load-bearing: read this before diagnosing slow auth or
> builds** — half the apparent bugs are actually memory exhaustion.

The full stack (web dev + api + postgres + valkey + authentik-server +
authentik-worker) needs **≥8 GB RAM + swap** to run together without
memory pressure. Resident set sizes under typical load:

- web (Next.js dev): ~1 GB     — heaviest; stop when not actively building UI
- authentik-server: ~340 MB
- authentik-worker: ~440 MB
- api (Django + uv): ~150 MB
- postgres: ~100 MB
- valkey: ~10 MB
- **Total + host overhead: ~2.5–3 GB resident, peaks higher under load.**

If the dev host is below this:

- **Symptom**: Authentik login spinner, slow `next dev` HMR, postgres
  pg_repack stalls, OOM-killed `next-server` workers.
- **First triage**: `free -h`. If `available` < 500 MB while load is
  light, the host is too small — don't blame the application code.
- **Fast mitigations** (in order of cost):
  1. `docker compose stop web` while doing auth/admin work
     (frees ~1 GB instantly).
  2. Add swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600
     /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
     (persist via `/etc/fstab`).
  3. Upgrade the host to ≥8 GB before claiming the stack "works on this
     box".

Do NOT diagnose Authentik login issues, Next compilation hangs, or
postgres connection storms without first confirming the host has
headroom.
