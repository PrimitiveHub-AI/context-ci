#!/usr/bin/env bash
#
# check-prod-hardening.sh — assert the API ships hardened in prod.
#
# SSRF #1 (docs/security/2026-10-23-ssrf-01-handoff.md) flagged two app-config
# regressions that widen SSRF/info-leak impact and must never ship to prod:
#
#   1. DEBUG=True        — Django debug pages leak settings/env/tracebacks.
#   2. ALLOWED_HOSTS=*   — wildcard host acceptance (Host-header abuse).
#
# Both were found LIVE on 2026-10-23 (injected by the host-local
# compose.deploy-local.yaml stopgap). This guard fails if either reappears,
# checking BOTH the resolved compose config (what the next `up` will apply) and
# the running api container (what is applied now).
#
# Run on the prod host (reads the COMPOSE_FILE pin); call from deploy.sh and
# smoke-prod.sh. Non-destructive — reports only.
#
# Exit: 0 safe · 1 unsafe · 2 could not determine (docker/compose missing).
set -euo pipefail

CONTAINER="${API_CONTAINER:-primitivehub-api-1}"
fail=0
determined=0

say() { printf '[%s] %s\n' "$1" "$2"; }

strip_quotes() { printf '%s' "$1" | tr -d '"'"'"; }

check_env_pair() {
  # $1 = source label, $2 = DEBUG value, $3 = ALLOWED_HOSTS value
  local src="$1" debug hosts
  debug="$(strip_quotes "$2")"   # compose config emits quoted scalars ("True")
  hosts="$(strip_quotes "$3")"
  determined=1
  case "$(printf '%s' "$debug" | tr '[:upper:]' '[:lower:]')" in
    true|1|yes|on)
      say fail "$src DEBUG=$debug — must be False in prod"; fail=1 ;;
    *)
      say ok "$src DEBUG=$debug" ;;
  esac
  if printf '%s' "$hosts" | grep -q '\*'; then
    say fail "$src ALLOWED_HOSTS='$hosts' — wildcard forbidden in prod"; fail=1
  else
    say ok "$src ALLOWED_HOSTS='$hosts'"
  fi
}

# --- Source 1: resolved PROD compose config (next `up`) ----------------------
# Resolve the prod file set explicitly, not the ambient default (which picks up
# the dev compose.override.yaml → DEBUG=True and gives a false positive off the
# prod host). Mirrors the host COMPOSE_FILE pin: base + prod + host-local overlay.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  files=(-f compose.yaml -f compose.prod.yaml)
  [[ -f "$root/compose.deploy-local.yaml" ]] && files+=(-f compose.deploy-local.yaml)
  cfg="$(cd "$root" && docker compose "${files[@]}" config 2>/dev/null || true)"
  if [[ -n "$cfg" ]]; then
    # Pull the api service block's env values (best-effort YAML scrape).
    d=$(printf '%s' "$cfg" | awk '/^  api:/{f=1} f&&/DEBUG:/{print $2; exit}')
    h=$(printf '%s' "$cfg" | awk '/^  api:/{f=1} f&&/ALLOWED_HOSTS:/{print $2; exit}')
    [[ -n "$d$h" ]] && check_env_pair "compose-config" "${d:-unset}" "${h:-unset}"
  fi
fi

# --- Source 2: running container (applied now) -------------------------------
if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  env_lines="$(docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}')"
  d=$(printf '%s' "$env_lines" | awk -F= '/^DEBUG=/{print $2; exit}')
  h=$(printf '%s' "$env_lines" | awk -F= '/^ALLOWED_HOSTS=/{print $2; exit}')
  check_env_pair "live-container($CONTAINER)" "${d:-unset}" "${h:-unset}"
fi

if [[ "$determined" -eq 0 ]]; then
  say skip "could not read compose config or running container — docker/compose unavailable"
  exit 2
fi
exit "$fail"
