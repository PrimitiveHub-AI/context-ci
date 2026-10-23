# SSRF #1 — handoff (reporter: abhibughunt3r)

**Status:** routed, not fixed here. **Severity:** high (unauthenticated SSRF).
**Surface:** `POST /api/v1/check` fetches a user-supplied URL server-side, so a
caller can make the server request internal/metadata endpoints (e.g.
`169.254.169.254`, `localhost`, RFC-1918) and read or infer the response.
**Not phub-cli:** the fetch lives in the API/platform, not in the npm packages.

## Primary owner — phub-check-engine (`apps/api/checks`)

The fetch logic itself. Fix must **fail closed**:

1. **Resolve-then-validate, per hop.** Resolve the hostname, reject if ANY
   resolved IP is private/loopback/link-local/CGNAT/ULA or `::1`. Re-validate on
   every redirect hop — validating only the first URL is the classic bypass.
2. **Disable redirect-following** (or cap to 0–1 hop with re-validation each
   time). A 302 to `169.254.169.254` must not be followed blindly.
3. **Scheme + port allow-list** — `https` (and `http` only if required); block
   `file:`, `gopher:`, `ftp:`, etc.
4. **Pin the resolved IP** for the actual connection so DNS can't rebind between
   the check and the fetch (TOCTOU).
5. Short timeout + response-size cap; don't echo raw upstream errors/bodies back
   to the caller (blind-SSRF exfil channel).

## Secondary / defence-in-depth — phub-platform

1. **Egress deny-list** at the network layer: block the app's outbound path to
   `169.254.169.254`, RFC-1918, and loopback regardless of app-layer checks.
2. **`DEBUG=False` in prod** — Django debug pages leak internals and widen SSRF
   impact.

## Verify / exit condition

Repro requests to `169.254.169.254`, `localhost`, an RFC-1918 host, and a public
URL that **302-redirects** to each — all must be refused with a clear error, and
the egress layer must block them even if the app check is bypassed. Add each as a
regression test in `apps/api/checks/tests`.

---

## Platform status (phub-platform, 2026-10-23)

Defence-in-depth half picked up. Delivered in-repo; **live application gated on
human approval** (brief API restart + no passwordless sudo on this host):

- **Egress deny-list** authored: `infra/egress/ssrf-egress-guard.sh` (+ README).
  DOCKER-USER dedicated chain, auto-detects the bridge subnet and carves it out
  (intra-stack api↔db/cache/auth preserved), drops egress to
  `169.254/16`+RFC-1918+CGNAT+loopback (v4+v6). `--dry-run` verified. Needs
  `sudo … --apply` on the prod host (can't self-apply — no passwordless sudo),
  and a re-run after any docker-network recreate.
  **✅ APPLIED + VERIFIED LIVE 2026-10-23:** metadata + RFC-1918 blocked from the
  api container, public egress + intra-stack intact. ⚠️ Rules are NOT
  reboot-persistent yet — must be persisted (netfilter-persistent / systemd /
  deploy.sh hook) or the backstop vanishes on host reboot.
- **`DEBUG=False` + pinned `ALLOWED_HOSTS` — ✅ APPLIED LIVE 2026-10-23.** Found
  live as `DEBUG=True` + `ALLOWED_HOSTS=*` (stopgap dev-image overlay); fixed via
  recreate. Verified: container healthy, all routes 200, `smoke-prod.sh` PASS,
  bad path returns a generic 404 (no debug traceback).
  - **⚠️ GOTCHA for the next deploy:** `DEBUG=False` makes settings.py turn on
    `SECURE_SSL_REDIRECT` (default True) → the API 301-redirects any request
    without `X-Forwarded-Proto: https`, which breaks the Docker healthcheck
    (plain-http curl → unhealthy) and any non-XFP internal caller. First recreate
    did exactly this. Fix: set **`SECURE_SSL_REDIRECT=False`** in the overlay —
    TLS terminates at Cloudflare/nginx, so the app must not self-redirect; HSTS +
    `SECURE_PROXY_SSL_HEADER` stay on. This env is now pinned in
    `compose.deploy-local.yaml`.
- **Regression guard** added: `scripts/check-prod-hardening.sh` fails if
  `DEBUG=True` / wildcard `ALLOWED_HOSTS` appears in the resolved compose config
  OR the running api container. Wire into `deploy.sh` + `smoke-prod.sh`.

### Notes back to phub-check-engine (primary owner)

Read-only review of `apps/api/checks/url_fetcher.py` while scoping the egress
layer — two items for your fix (not edited by platform):

1. **TOCTOU / DNS-rebinding still open (handoff item 1/4).** `_resolve_and_check`
   resolves + validates, then `urlopen` resolves *again* and connects — the
   rebinding window ADR-0044 flagged. **Pin the validated IP** for the actual
   connection (e.g. connect to the checked IP with `Host`/SNI preserved), don't
   just re-resolve. The egress guard backstops this, but the app must still close
   it.
2. **Blind-SSRF exfil channel (handoff item 5).** `url:fetch-failed` echoes
   `{exc.__class__.__name__}: {exc}` and `url:remote-error` echoes the status
   back to the caller — leaks upstream response info. Return a generic message;
   log detail server-side only.

Existing app-layer defenses are otherwise solid (https-only, all-A/AAAA check,
per-redirect re-check, size/timeout caps).
