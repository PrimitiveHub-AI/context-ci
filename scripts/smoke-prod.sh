#!/usr/bin/env bash
#
# smoke-prod.sh — post-deploy smoke test against the LIVE public surface.
#
# This is the guard for bugs.md #33 (live domain accidentally served
# `pnpm dev`; its HMR WebSocket died through Cloudflare → dead editor) and
# #25 (prod image 404'd /docs). Both hid on `localhost` and only showed
# through the CDN edge, so this script hits the surface the way a real
# browser does: through the domain, through Cloudflare.
#
# Checks:
#   1. Key routes return 200 (catches missing-in-image regressions, #25).
#   2. /forge does NOT ship `webpack-hmr` (catches dev-on-prod, #33).
#   3. (--browser) a real headless browser mounts + types in the Forge
#      editor (catches half-hydration that a curl can't see).
#
# Usage:
#   scripts/smoke-prod.sh [BASE_URL]            # curl checks (default domain)
#   scripts/smoke-prod.sh --browser [BASE_URL]  # + headless editor check
#
# Exit: 0 all pass · 1 a check failed.

set -euo pipefail

BROWSER=0
if [[ "${1:-}" == "--browser" ]]; then BROWSER=1; shift; fi
BASE_URL="${1:-https://primitivehub.ai}"

ROUTES=(/ /check /top-10 /forge /docs /registry /paper)
fail=0

echo "== smoke: $BASE_URL =="

# 1. routes 200
for p in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$BASE_URL$p" || echo 000)
  if [[ "$code" == 200 ]]; then
    printf '  ok    %-12s %s\n' "$p" "$code"
  else
    printf '  FAIL  %-12s %s\n' "$p" "$code"; fail=1
  fi
done

# 2. prod-mode assertion — dev serves the HMR WebSocket client; prod never does
if curl -s --max-time 25 "$BASE_URL/forge" 2>/dev/null | grep -q 'webpack-hmr'; then
  echo "  FAIL  /forge is serving the DEV build (webpack-hmr present) — bug #33 regression"
  fail=1
else
  echo "  ok    /forge is the PROD build (no webpack-hmr)"
fi

# 3. optional: a real browser mounts + types in the editor (needs docker + the
#    playwright image; pw-forge.js lives in /tmp during a dev session).
if [[ "$BROWSER" == 1 ]]; then
  if [[ -f /tmp/pw-forge.js ]] && command -v docker >/dev/null 2>&1; then
    echo "  .. headless editor check (Forge)"
    out=$(docker run --rm --network host -v /tmp/pw-forge.js:/pw-forge.js:ro \
      -e TARGET="$BASE_URL/forge" mcr.microsoft.com/playwright:v1.48.0-jammy bash -c \
      'mkdir -p /w && cp /pw-forge.js /w/ && cd /w && npm init -y >/dev/null 2>&1 && \
       PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.48.0 >/dev/null 2>&1 && \
       PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node /w/pw-forge.js' 2>/dev/null || true)
    echo "$out" | sed 's/^/     /'
    echo "$out" | grep -q 'TYPING_WORKS: YES' || { echo "  FAIL  editor not typeable through the edge"; fail=1; }
  else
    echo "  skip  --browser (need docker + /tmp/pw-forge.js)"
  fi
fi

if [[ "$fail" == 0 ]]; then echo "== PASS =="; else echo "== FAIL =="; fi
exit "$fail"
