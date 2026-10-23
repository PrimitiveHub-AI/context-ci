# SSRF egress guard (phub-platform · defence-in-depth)

Network-layer backstop for the `/check` URL fetcher. Partner to the app-layer
fix in `apps/api/checks/url_fetcher.py` (phub-check-engine). Handoff:
`docs/security/2026-10-23-ssrf-01-handoff.md`.

## Why

The app validates resolved IPs, but there is a TOCTOU / DNS-rebinding window
(ADR-0044): the fetcher resolves + checks, then `urlopen` resolves **again**
and connects — an attacker can flip the record in between. A kernel egress
deny-list closes that window regardless of app behaviour: the container simply
cannot open a socket to cloud-metadata (`169.254.169.254`), loopback, or
RFC-1918 / CGNAT ranges.

## What it does

Installs a dedicated `PHUB_EGRESS` chain jumped from `DOCKER-USER` (the chain
Docker never clobbers). For every container on the compose bridge network it:

1. lets established/related replies back through,
2. **allows intra-stack traffic** (bridge-subnet → bridge-subnet) so
   api↔postgres/valkey/authentik keep working — critical, because the bridge
   subnet is itself inside `172.16.0.0/12`,
3. **drops** egress to `169.254.0.0/16`, `127.0.0.0/8`, `10.0.0.0/8`,
   `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `0.0.0.0/8` (and the v6
   equivalents),
4. allows everything else (public internet — the fetcher's legitimate target).

The blocked set mirrors `_BLOCKED_V4` in `url_fetcher.py` so both layers agree.

## Use

```bash
# 1. Preview the exact ruleset (safe, no changes):
infra/egress/ssrf-egress-guard.sh --dry-run

# 2. Install (root; iptables):
sudo infra/egress/ssrf-egress-guard.sh --apply

# 3. Verify:
sudo iptables -L PHUB_EGRESS -n --line-numbers

# 4. Roll back:
sudo infra/egress/ssrf-egress-guard.sh --remove
```

Override detection if needed: `--net <docker-network>` or `--subnet <CIDR>`.

## Persistence (required — rules are runtime-only)

iptables rules do NOT survive a host reboot or a docker-network recreate. Two
mechanisms keep the guard durable; install both:

1. **Boot persistence — systemd oneshot** (`phub-egress-guard.service`):
   ```bash
   sudo cp infra/egress/phub-egress-guard.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now phub-egress-guard.service
   systemctl status phub-egress-guard.service   # active (exited)
   ```
   Re-applies on every boot after Docker creates the network.

2. **Post-deploy re-apply — wired into `scripts/deploy.sh`:** after `up -d` the
   deploy runs `check-prod-hardening.sh` (fail-closed) then re-applies this
   guard, so a network recreate during deploy can't leave the rules stale.

Rules are **idempotent** — re-applying flushes and rebuilds the chain and keeps
exactly one `DOCKER-USER` jump, so the two mechanisms never conflict.

## Verify the guard actually blocks (post-apply)

```bash
# metadata + an RFC-1918 host must FAIL from inside the api container;
# a public host must still succeed.
docker exec primitivehub-api-1 sh -c '
  curl -s -m 3 -o /dev/null -w "metadata:%{http_code} " http://169.254.169.254/ || echo "metadata:BLOCKED";
  curl -s -m 3 -o /dev/null -w "rfc1918:%{http_code} "  http://10.0.0.1/      || echo "rfc1918:BLOCKED";
  curl -s -m 5 -o /dev/null -w "public:%{http_code}\n"   https://example.com/'
# intra-stack must still work:
docker exec primitivehub-api-1 sh -c 'curl -s -o /dev/null -w "pg:%{http_code}\n" http://postgres:5432 || true'
```
