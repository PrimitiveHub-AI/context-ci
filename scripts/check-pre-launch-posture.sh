#!/usr/bin/env bash
#
# check-pre-launch-posture.sh — six-layer audit against bug-#26 recurrence.
#
# Pre-launch posture is absolute (CLAUDE.md hard-rule #3 + Principle 11).
# Bug #26 (2026-06-02) proved that "localhost-only" is a property of the
# WHOLE network path — a correctly configured compose port spec is
# necessary but not sufficient. This script walks every layer that can
# independently break the invariant:
#
#   Layer 1 — compose port specs (in-repo)
#   Layer 2 — direct process binds (live host: `ss -tlnp`)
#   Layer 3 — host services (live host: nginx / caddy / traefik / haproxy)
#   Layer 4 — public DNS records (live: `dig` against primitivehub.ai)
#   Layer 5 — host firewall (live host: `ufw status`)
#   Layer 6 — running-container port bindings (live host: `docker ps`)
#
# Modes:
#   default       run all six layers (live host).
#   --ci          run layer 1 only (in-repo; what GitHub Actions can check).
#   --layer N     run a single layer (1..6).
#   --domain D    override domain for layer 4 (default: primitivehub.ai).
#
# Exit codes:
#   0   every layer reports the safe value.
#   1   at least one layer reports unsafe.
#   2   usage error / required tool missing (script aborts before reporting).
#
# Design notes:
# - Each layer's CHECK function exits 0 on safe, 1 on unsafe, 2 on
#   "tool not present / not applicable to this host". Layer 2..6 are
#   skipped gracefully in CI environments where the relevant tooling
#   isn't available.
# - Output is human-readable AND machine-parseable: each layer prints
#   `[ok|fail|skip] layer-N <name>: <detail>` on a single line.
# - The script never modifies state; it only reports.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

DOMAIN="primitivehub.ai"
MODE="all"
SINGLE_LAYER=""

usage() {
  cat <<'EOF'
usage: check-pre-launch-posture.sh [--ci | --layer N] [--domain D]
  --ci             run layer 1 only
  --layer N        run a single layer (1..6)
  --domain D       override DNS lookup domain (default: primitivehub.ai)
  -h, --help       show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ci) MODE="ci"; shift ;;
    --layer)
      SINGLE_LAYER="${2:-}"; MODE="single"; shift 2
      case "$SINGLE_LAYER" in 1|2|3|4|5|6) ;; *) echo "invalid --layer (1..6)" >&2; exit 2 ;; esac
      ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

FAIL=0
LAYERS_RUN=0

emit() {
  # $1=verdict (ok|fail|skip)  $2=layer-N  $3=name  $4=detail
  printf "[%s] %s %s: %s\n" "$1" "$2" "$3" "$4"
}

# ------ Layer 1 — compose port specs (in-repo) ------
layer1() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  local script_dir
  script_dir="$(dirname "$(readlink -f "$0")")"
  if "$script_dir/check-port-bindings.sh" >/tmp/.posture-l1.out 2>&1; then
    emit ok layer-1 "compose-port-bindings" "all specs have host-IP prefix"
  else
    emit fail layer-1 "compose-port-bindings" "$(grep -m1 . /tmp/.posture-l1.out || echo 'see scripts/check-port-bindings.sh')"
    FAIL=1
  fi
  rm -f /tmp/.posture-l1.out
}

# ------ Layer 2 — direct process binds (live host) ------
layer2() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  if ! command -v ss >/dev/null 2>&1; then
    emit skip layer-2 "process-binds" "ss(8) not available; skipping"
    return
  fi
  # Listeners on public ports. We expect every dev port to be 127.0.0.1.
  # Pre-launch, NOTHING should listen on 0.0.0.0 OR :: for 80/443/3000/8000/9000.
  local bad
  bad=$(ss -tlnH 2>/dev/null | awk '
    {
      addr=$4
      # IPv4 0.0.0.0:PORT  -or-  IPv6 [::]:PORT  -or-  *:PORT
      if (addr ~ /^(0\.0\.0\.0|\*|\[::\]):(80|443|3000|8000|9000)$/) {
        print addr
      }
    }
  ')
  if [ -n "$bad" ]; then
    emit fail layer-2 "process-binds" "non-localhost listeners: $(echo "$bad" | paste -sd, -)"
    FAIL=1
  else
    emit ok layer-2 "process-binds" "no 0.0.0.0/:: listeners on web ports"
  fi
}

# ------ Layer 3 — host services (nginx/caddy/traefik/haproxy) ------
layer3() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  if ! command -v systemctl >/dev/null 2>&1; then
    emit skip layer-3 "host-services" "systemctl not available; skipping"
    return
  fi
  local active=""
  for svc in nginx apache2 caddy traefik haproxy cloudflared; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      active="${active:+$active, }$svc"
    fi
  done
  if [ -n "$active" ]; then
    emit fail layer-3 "host-services" "active reverse proxies: $active (must be stopped + disabled pre-launch)"
    FAIL=1
  else
    emit ok layer-3 "host-services" "no active reverse proxies on the host"
  fi
}

# ------ Layer 4 — public DNS records ------
layer4() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  if ! command -v dig >/dev/null 2>&1; then
    emit skip layer-4 "public-dns" "dig(1) not available; skipping"
    return
  fi
  local apex_a www_a apex_aaaa www_aaaa
  apex_a=$(dig +short +time=3 +tries=1 "$DOMAIN" A 2>/dev/null || true)
  www_a=$(dig +short +time=3 +tries=1 "www.$DOMAIN" A 2>/dev/null || true)
  apex_aaaa=$(dig +short +time=3 +tries=1 "$DOMAIN" AAAA 2>/dev/null || true)
  www_aaaa=$(dig +short +time=3 +tries=1 "www.$DOMAIN" AAAA 2>/dev/null || true)
  local records="$apex_a$www_a$apex_aaaa$www_aaaa"
  if [ -n "$records" ]; then
    local detail=""
    [ -n "$apex_a" ]    && detail="$detail $DOMAIN/A=$apex_a"
    [ -n "$www_a" ]     && detail="$detail www.$DOMAIN/A=$www_a"
    [ -n "$apex_aaaa" ] && detail="$detail $DOMAIN/AAAA=$apex_aaaa"
    [ -n "$www_aaaa" ]  && detail="$detail www.$DOMAIN/AAAA=$www_aaaa"
    emit fail layer-4 "public-dns" "public records resolve for $DOMAIN:$detail"
    FAIL=1
  else
    emit ok layer-4 "public-dns" "$DOMAIN + www.$DOMAIN resolve to nothing"
  fi
}

# ------ Layer 5 — host firewall ------
layer5() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  if ! command -v ufw >/dev/null 2>&1; then
    emit skip layer-5 "firewall" "ufw not available; (recommend installing pre-launch)"
    return
  fi
  if ! sudo -n ufw status >/dev/null 2>&1; then
    emit skip layer-5 "firewall" "ufw status requires sudo; skipping"
    return
  fi
  local status
  status=$(sudo -n ufw status 2>/dev/null | head -n1)
  if echo "$status" | grep -qi "active"; then
    emit ok layer-5 "firewall" "ufw is active"
  else
    emit fail layer-5 "firewall" "ufw is INACTIVE (recommend: enable + deny 80,443,3000,8000,9000)"
    FAIL=1
  fi
}

# ------ Layer 6 — running-container port bindings ------
layer6() {
  LAYERS_RUN=$((LAYERS_RUN+1))
  if ! command -v docker >/dev/null 2>&1; then
    emit skip layer-6 "container-bindings" "docker not available; skipping"
    return
  fi
  if ! docker ps --format '{{.Names}}' >/dev/null 2>&1; then
    emit skip layer-6 "container-bindings" "docker daemon unreachable; skipping"
    return
  fi
  local bad
  bad=$(docker ps --format '{{.Names}}|{{.Ports}}' 2>/dev/null | awk -F'|' '
    {
      name=$1; ports=$2
      # A safe binding looks like "127.0.0.1:HOST->CONTAINER/proto".
      # An exposed binding looks like "0.0.0.0:HOST->CONTAINER/proto"
      # OR ":::HOST->CONTAINER/proto" (IPv6 wildcard).
      n = split(ports, parts, ", ")
      for (i = 1; i <= n; i++) {
        p = parts[i]
        if (p ~ /(^|[, ])0\.0\.0\.0:/ || p ~ /(^|[, ])::([^:]|$)/ || p ~ /:::[0-9]/) {
          print name "|" p
        }
      }
    }
  ')
  if [ -n "$bad" ]; then
    local pretty
    pretty=$(echo "$bad" | awk -F'|' '{print $1" ("$2")"}' | paste -sd"; " -)
    emit fail layer-6 "container-bindings" "exposed containers: $pretty"
    FAIL=1
  else
    emit ok layer-6 "container-bindings" "no docker containers expose 0.0.0.0/::"
  fi
}

case "$MODE" in
  ci)
    layer1
    ;;
  single)
    case "$SINGLE_LAYER" in
      1) layer1 ;;
      2) layer2 ;;
      3) layer3 ;;
      4) layer4 ;;
      5) layer5 ;;
      6) layer6 ;;
    esac
    ;;
  all)
    layer1
    layer2
    layer3
    layer4
    layer5
    layer6
    ;;
esac

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "pre-launch posture: OK across $LAYERS_RUN layer(s)."
  exit 0
else
  echo "pre-launch posture: FAIL — at least one layer reports unsafe."
  echo "See docs/bugs.md § 26 + docs/decisions/0031-pre-launch-posture-automation.md"
  echo "for the prevention contract."
  exit 1
fi
