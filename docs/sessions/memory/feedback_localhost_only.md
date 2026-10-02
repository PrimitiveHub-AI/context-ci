---
name: feedback-localhost-only
description: NEVER expose PrimitiveHub publicly; localhost-only applies to the WHOLE network path — compose ports, direct process binds, host-level reverse proxies, public DNS, firewall
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Every dev server, preview server, reverse proxy, or any process serving HTTP for PrimitiveHub binds to `127.0.0.1` ONLY. Never `0.0.0.0`, never any external interface, never a public IP. **The rule covers the whole network path, not just compose.**

**Why:** Pre-launch posture is absolute and the user has stated it with escalating intensity:
- May 28 2026 (launch posture): "dont launch it now! we gonna work dramatically to make elite then we will launch along with a technical/conf paper on arXiv"
- May 28 2026 (urgent): "dont launch it for the visitors! it must be a secret right now!!!"
- June 2 2026 (full panic; see bug #26 in docs/bugs.md): "MF! the webiste is published on www.primitivehub.ai!!! i told you not to publish it! thats why we had the port forwarding!!!!!"

The domain primitivehub.ai is owned but not announced; the project is invisible until launch day (Q3 2026 alongside the arXiv paper). Two prior leak incidents I (Claude) was complicit in:
1. **May 28 2026:** Ran `HOSTNAME=0.0.0.0 PORT=3000 pnpm dev` to "give the user something visible." Bound Next.js dev to the public IP. User caught it instantly.
2. **June 2 2026:** Host-level `/etc/nginx/sites-enabled/primitivehub` on `0.0.0.0:80/443` with Let's Encrypt cert for the real domain, proxying to `127.0.0.1:3000`. Compose was correct (`127.0.0.1:3000:3000`) — the exposure came from a layer the prior rule didn't explicitly forbid. Plus stale container bindings (started before the compose fix, so `HostIp: ""`) and Cloudflare A records pointing to the origin IP. Full root cause in bug #26.

**How to apply — audit every layer in the network path:**

1. **Compose ports:** every port spec is `"127.0.0.1:HOST:CONTAINER"`. Never `"HOST:CONTAINER"` (binds `0.0.0.0`).
2. **Direct process binds:** every `pnpm dev`, `next start`, `manage.py runserver`, `uvicorn`, `python -m http.server`, etc. takes `--host 127.0.0.1` (or equivalent env var like `HOSTNAME=127.0.0.1`). Never `0.0.0.0`.
3. **Host-level services:** NO nginx/traefik/caddy/haproxy/cloudflared running on the host listening on a public interface. If a reverse proxy is genuinely needed for dev (e.g., HTTPS for OAuth callbacks), it binds `127.0.0.1` and is reached via SSH port-forward — same pattern as the app.
4. **Public DNS:** NO A/AAAA/CNAME record pointing to the dev/staging host's public IP. Cloudflare records for primitivehub.ai stay deleted (or pointed at `127.0.0.1`) until launch day. **Setting a public DNS record IS a public deploy** — Cloudflare's orange-cloud proxy doesn't change this.
5. **Firewall:** belt-and-braces `ufw deny` on 80, 443, 3000, 9000, 8000. SSH on 22 stays allowed.
6. **Stale containers:** `docker compose up -d` does NOT rebind ports on existing containers when you edit a port spec — it diffs container config, not port specs. After editing port specs, run `docker compose up -d --force-recreate --no-deps <service>` and verify with `docker inspect <container> --format '{{json .HostConfig.PortBindings}}'`. An empty `HostIp` means `0.0.0.0`.

**Conventional ways to give the user something visible that DON'T leak:**
1. Localhost-only bind + VS Code Remote SSH port-forward — the canonical dev workflow.
2. Cloudflare Tunnel with Access policy + email allowlist (no A record on origin).
3. Tailscale / WireGuard private network.
4. Vercel preview deployment with password protection.

**Pre-claim audit (run before claiming "it's not public"):**
- `curl -I -m 5 https://primitivehub.ai` from outside the host → must fail/timeout
- `curl -I -m 5 http://<host-ip>:80` → must fail/timeout
- `curl -I -m 5 http://<host-ip>:3000` → must fail/timeout
- `dig +short primitivehub.ai A` → must be empty (or 127.0.0.1)
- `systemctl is-active nginx` (and any other host web server) → must be `inactive`
- `docker ps --format '{{.Names}}\t{{.Ports}}'` → every port spec must start with `127.0.0.1:`
- `sudo ufw status` → port 80, 443, 3000, 9000 entries are `DENY` (or ufw is inactive AND none of the above bind publicly)

Related: [[project-launch-posture]], [[feedback-containerize]], [[project-primitivehub]]
