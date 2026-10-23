#!/usr/bin/env bash
# SSRF egress guard — network-layer defence-in-depth for the /check URL fetcher.
#
# Context: SSRF #1 (docs/security/2026-10-23-ssrf-01-handoff.md). The app-layer
# fix lives in apps/api/checks/url_fetcher.py (phub-check-engine). This script is
# the phub-platform half: a kernel-level egress deny-list so that even if the
# app check is bypassed (e.g. the DNS-rebinding TOCTOU gap in ADR-0044), the
# container physically cannot open a connection to cloud-metadata / internal
# ranges.
#
# It installs rules into a dedicated iptables chain (PHUB_EGRESS) jumped from
# DOCKER-USER — the one chain Docker guarantees it will not clobber on
# daemon restarts / network churn. Scope: every container on the PrimitiveHub
# compose network. Intra-stack traffic (api↔postgres/valkey/authentik, all on
# the bridge subnet, itself RFC-1918) is explicitly allowed FIRST so the stack
# keeps working; only egress to *external* private/metadata ranges is dropped.
#
# Requires root (iptables). NOT auto-run — install deliberately on the prod
# host (see infra/egress/README.md) and after `scripts/deploy.sh` network
# (re)creates, since a fresh docker network can land on a new subnet.
#
# Usage:
#   sudo infra/egress/ssrf-egress-guard.sh [--apply|--dry-run|--remove]
#                                          [--net <docker-network-name>]
#                                          [--subnet <CIDR>]
# Default action is --dry-run (prints the ruleset, changes nothing).
set -euo pipefail

ACTION="dry-run"
NET="${PHUB_NET:-primitivehub_primitivehub_net}"
SUBNET_OVERRIDE="${PHUB_SUBNET:-}"
CHAIN="PHUB_EGRESS"

# Blocked destination ranges (the standard SSRF surface). Mirrors the app-layer
# _BLOCKED_V4 set in url_fetcher.py so the two layers agree.
BLOCK_V4=(
  "169.254.0.0/16"   # link-local + cloud metadata (169.254.169.254)
  "127.0.0.0/8"      # loopback
  "10.0.0.0/8"       # RFC-1918
  "172.16.0.0/12"    # RFC-1918 (bridge subnet carved out below via RETURN)
  "192.168.0.0/16"   # RFC-1918
  "100.64.0.0/10"    # CGNAT
  "0.0.0.0/8"        # "this host"
)
BLOCK_V6=(
  "::1/128"          # loopback
  "fc00::/7"         # ULA
  "fe80::/10"        # link-local
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)   ACTION="apply"; shift ;;
    --dry-run) ACTION="dry-run"; shift ;;
    --remove)  ACTION="remove"; shift ;;
    --net)     NET="$2"; shift 2 ;;
    --subnet)  SUBNET_OVERRIDE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

detect_subnet() {
  if [[ -n "$SUBNET_OVERRIDE" ]]; then
    echo "$SUBNET_OVERRIDE"; return
  fi
  docker network inspect "$NET" \
    -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null \
    | tr ' ' '\n' | grep -E '\.' | head -n1
}

SUBNET="$(detect_subnet || true)"
if [[ "$ACTION" != "remove" && -z "$SUBNET" ]]; then
  echo "ERROR: could not determine IPv4 subnet for docker network '$NET'." >&2
  echo "       pass --subnet <CIDR> explicitly (docker network inspect $NET)." >&2
  exit 1
fi

# Build the v4 rule list for the dedicated chain. Order matters:
#   1. established/related — let replies back through cheaply.
#   2. intra-stack (src subnet -> dst subnet) RETURN — never block our own DB/cache/auth.
#   3. src subnet -> each blocked external range DROP.
#   4. fall through (implicit RETURN) -> public internet allowed.
emit_v4_rules() {
  echo "-A ${CHAIN} -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN"
  echo "-A ${CHAIN} -s ${SUBNET} -d ${SUBNET} -j RETURN"
  for cidr in "${BLOCK_V4[@]}"; do
    echo "-A ${CHAIN} -s ${SUBNET} -d ${cidr} -j DROP"
  done
}

apply_v4() {
  iptables -N "${CHAIN}" 2>/dev/null || iptables -F "${CHAIN}"
  iptables -A "${CHAIN}" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  iptables -A "${CHAIN}" -s "${SUBNET}" -d "${SUBNET}" -j RETURN
  for cidr in "${BLOCK_V4[@]}"; do
    iptables -A "${CHAIN}" -s "${SUBNET}" -d "${cidr}" -j DROP
  done
  # Ensure exactly one jump from DOCKER-USER, at the top.
  while iptables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; do
    iptables -D DOCKER-USER -j "${CHAIN}"
  done
  iptables -I DOCKER-USER 1 -j "${CHAIN}"
}

apply_v6() {
  command -v ip6tables >/dev/null 2>&1 || return 0
  ip6tables -N "${CHAIN}" 2>/dev/null || ip6tables -F "${CHAIN}"
  ip6tables -A "${CHAIN}" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  for cidr in "${BLOCK_V6[@]}"; do
    ip6tables -A "${CHAIN}" -d "${cidr}" -j DROP
  done
  while ip6tables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; do
    ip6tables -D DOCKER-USER -j "${CHAIN}"
  done
  ip6tables -I DOCKER-USER 1 -j "${CHAIN}" 2>/dev/null || true
}

remove_all() {
  if iptables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; then
    while iptables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; do
      iptables -D DOCKER-USER -j "${CHAIN}"
    done
  fi
  iptables -F "${CHAIN}" 2>/dev/null || true
  iptables -X "${CHAIN}" 2>/dev/null || true
  if command -v ip6tables >/dev/null 2>&1; then
    while ip6tables -C DOCKER-USER -j "${CHAIN}" 2>/dev/null; do
      ip6tables -D DOCKER-USER -j "${CHAIN}"
    done
    ip6tables -F "${CHAIN}" 2>/dev/null || true
    ip6tables -X "${CHAIN}" 2>/dev/null || true
  fi
  echo "removed ${CHAIN} (v4+v6) and its DOCKER-USER jump."
}

case "$ACTION" in
  dry-run)
    echo "# dry-run — would install into DOCKER-USER (no changes made)"
    echo "# docker network : ${NET}"
    echo "# bridge subnet  : ${SUBNET}  (carved out: intra-stack allowed)"
    echo "-I DOCKER-USER 1 -j ${CHAIN}"
    emit_v4_rules
    echo "# v6 (if ip6tables present): DROP ${BLOCK_V6[*]}"
    ;;
  apply)
    [[ "$(id -u)" -eq 0 ]] || { echo "must run as root" >&2; exit 1; }
    apply_v4
    apply_v6
    echo "applied ${CHAIN}; verify: iptables -L ${CHAIN} -n --line-numbers"
    ;;
  remove)
    [[ "$(id -u)" -eq 0 ]] || { echo "must run as root" >&2; exit 1; }
    remove_all
    ;;
esac
