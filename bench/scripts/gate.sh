#!/usr/bin/env bash
# gate.sh — single entry point for the corpus regression gate.
#
# Discovers the most recent committed baseline per language, runs Py and
# TS measurement against it, then cross-checks Py↔TS parity (ADR-0023).
# See bench/baseline/FLOOR.md for the discipline.
#
# Exit codes:
#   0 — no F1 regression > tolerance on either language AND parity intact
#   1 — regression OR parity drift OR setup failure
#
# Usage:
#   bench/scripts/gate.sh                 # CI-style: summary only
#   VERBOSE=1 bench/scripts/gate.sh       # print per-detector tables
#
# Prereqs (assumed in CI; in dev usually present):
#   - uv installed; apps/api project synced
#   - pnpm + node installed; bench/scripts + packages/phub built
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Preflight — refuse to run a parity-only gate. Without uv + a built phub, the
# measure steps below fail and (pre-fix) left a FALSE "GATE: PASS" that only
# compared stale baselines. Fail loudly and actionably instead (ADR-0023 / FLOOR.md).
MISSING=()
command -v uv >/dev/null 2>&1 || MISSING+=("uv — Python runner for apps/api measure")
[[ -f packages/phub/dist/audit/uncovered.js ]] || MISSING+=("built packages/phub — run: pnpm -C packages/phub build")
if (( ${#MISSING[@]} > 0 )); then
  echo "gate: toolchain not ready — refusing to run; a gate that cannot measure must not PASS:" >&2
  printf '  - %s\n' "${MISSING[@]}" >&2
  exit 1
fi

# Latest baseline per language. YYYY-MM-DD-<lang>.json sorts lex ==
# chronologically. nullglob → empty array if none exist.
shopt -s nullglob
PY_BASELINES=( bench/baseline/*-py.json )
TS_BASELINES=( bench/baseline/*-ts.json )
shopt -u nullglob

if (( ${#PY_BASELINES[@]} == 0 )); then
  echo "gate: no Py baseline found under bench/baseline/" >&2
  exit 1
fi
if (( ${#TS_BASELINES[@]} == 0 )); then
  echo "gate: no TS baseline found under bench/baseline/" >&2
  exit 1
fi

# Lex-last entry = chronologically most recent = the floor.
PY_FLOOR="${PY_BASELINES[-1]}"
TS_FLOOR="${TS_BASELINES[-1]}"

PY_OUT=$(mktemp)
TS_OUT=$(mktemp)
PARITY_OUT=$(mktemp)
trap 'rm -f "$PY_OUT" "$TS_OUT" "$PARITY_OUT"' EXIT

PY_STATUS=0
TS_STATUS=0
PARITY_STATUS=0

echo "==> Py: measure --gate --baseline ${PY_FLOOR}"
uv run --project apps/api python bench/scripts/measure.py \
    --no-baseline --gate --baseline "${PY_FLOOR}" >"$PY_OUT" 2>&1 || PY_STATUS=$?
[[ "${VERBOSE:-0}" == "1" ]] && cat "$PY_OUT"
tail -n 12 "$PY_OUT"
echo

echo "==> TS: measure --gate --baseline ${TS_FLOOR}"
(cd bench/scripts && pnpm -s tsx measure.ts \
    --no-baseline --gate --baseline "../../${TS_FLOOR}") >"$TS_OUT" 2>&1 || TS_STATUS=$?
[[ "${VERBOSE:-0}" == "1" ]] && cat "$TS_OUT"
tail -n 12 "$TS_OUT"
echo

echo "==> Parity: compare ${PY_FLOOR##*/} vs ${TS_FLOOR##*/} (ADR-0023)"
python3 bench/scripts/parity_check.py >"$PARITY_OUT" 2>&1 || PARITY_STATUS=$?
cat "$PARITY_OUT"
echo

if (( PY_STATUS != 0 || TS_STATUS != 0 || PARITY_STATUS != 0 )); then
  echo "GATE: FAIL  (py=$PY_STATUS, ts=$TS_STATUS, parity=$PARITY_STATUS)" >&2
  echo "Read bench/baseline/FLOOR.md for the discipline + how to declare a recall trade." >&2
  exit 1
fi

echo "GATE: PASS  (no F1 regression > tolerance; Py↔TS parity intact)"
