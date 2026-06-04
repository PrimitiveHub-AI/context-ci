#!/usr/bin/env bash
#
# check-port-bindings.sh — Layer 1 of the pre-launch posture audit.
#
# Validates that every `ports:` spec in compose*.yaml is prefixed with
# a host IP — i.e., dev binds to `127.0.0.1:HOST:CONTAINER`, never the
# implicit `HOST:CONTAINER` (which expands to `0.0.0.0:HOST:CONTAINER`
# and exposes the dev port on every network interface).
#
# This is the in-repo half of the bug-#26 prevention surface (see
# docs/bugs.md § 26 + docs/decisions/0031-pre-launch-posture-automation.md).
# Five operational layers (live host listeners, host services, DNS,
# firewall, running-container state) are checked by the sibling
# `check-pre-launch-posture.sh` against the actual deploy target.
#
# Exit codes:
#   0  every compose port spec carries a host-IP prefix.
#   1  one or more violations detected; specific lines printed.
#   2  no compose*.yaml files found in cwd.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

shopt -s nullglob
compose_files=(compose.yaml compose.override.yaml compose.prod.yaml)
existing=()
for f in "${compose_files[@]}"; do
  [ -f "$f" ] && existing+=("$f")
done

if [ "${#existing[@]}" -eq 0 ]; then
  echo "check-port-bindings: no compose*.yaml found in $(pwd)" >&2
  exit 2
fi

fail=0

# A "violating" port spec is a YAML list item that looks like:
#     - "3000:3000"
#     -  3000:3000
#     - "${WEB_PORT:-3000}:3000"
#   ...without a leading host-IP. A safe spec has at least one extra
# colon-separated prefix, e.g. "127.0.0.1:3000:3000".
#
# The regex is line-anchored, allows leading whitespace + quoting +
# optional /tcp|/udp suffix, and rejects ${VAR} expansions that
# happen to omit the host IP. The "two-colon minimum" rule is the
# canonical test: with a host-IP prefix every port spec has TWO
# colons; without it, only ONE.

# Build a regex that:
#   - matches a YAML list item under `ports:`
#   - has exactly one ':' between digits (so no host-IP prefix)
#   - rejects host-IP-prefixed lines (which have two or more ':')
# We use awk for clarity instead of a baroque regex.

for f in "${existing[@]}"; do
  bad_lines=$(awk '
    # Strip trailing comments.
    { sub(/[ \t]*#.*$/, ""); }
    # Track whether we are inside a `ports:` block.
    /^[[:space:]]*ports:[[:space:]]*$/ { in_ports=1; next }
    # Any non-list line at lesser-or-equal indentation exits the block.
    in_ports && /^[[:space:]]*[A-Za-z_]/ { in_ports=0 }
    # A YAML list item under `ports:` looks like:  - "..."
    in_ports && /^[[:space:]]*-[[:space:]]+/ {
      raw = $0
      # Strip the leading "- " + any surrounding double quotes.
      sub(/^[[:space:]]*-[[:space:]]+/, "", raw)
      gsub(/^"|"$/, "", raw)
      # Strip any trailing /tcp or /udp protocol suffix.
      sub(/\/(tcp|udp)$/, "", raw)
      # Count colons. host-IP-prefixed specs have ≥ 2 colons.
      n = gsub(/:/, ":", raw)
      if (n < 2) {
        print FILENAME ":" NR ":  " $0
      }
    }
  ' "$f")

  if [ -n "$bad_lines" ]; then
    fail=1
    echo "::error file=$f::compose port spec missing host-IP prefix (CLAUDE.md hard-rule #3 + bugs.md #26)"
    echo "$bad_lines"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Fix: every port spec MUST carry a host-IP prefix."
  echo "  Wrong:    - \"3000:3000\""
  echo "  Right:    - \"127.0.0.1:3000:3000\""
  echo ""
  echo "Pre-launch posture is absolute (CLAUDE.md hard-rule #3)."
  echo "See docs/bugs.md § 26 for the canonical incident report."
  exit 1
fi

echo "check-port-bindings: OK — every compose port spec carries a host-IP prefix."
exit 0
