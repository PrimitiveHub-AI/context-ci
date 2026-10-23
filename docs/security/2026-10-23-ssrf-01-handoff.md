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
