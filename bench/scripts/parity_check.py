#!/usr/bin/env python3
"""parity_check.py — cross-language verdict-count parity gate.

Compares the most recent Py and TS baseline JSONs under bench/baseline/
and exits 1 if any per-detector (tp, fp, tn, fn) tuple differs.

The harness produces lockstep counts by construction (same manifest,
same scoring algorithm). Drift here is a defect — either Py or TS
detectors are out of step (ADR-0023 violation) or measure.py /
measure.ts disagree on scoring.

Run from the repo root:

    python bench/scripts/parity_check.py
    python bench/scripts/parity_check.py --py 2026-06-05-py.json --ts 2026-06-05-ts.json

Exit codes:
    0 — no drift
    1 — drift detected OR usage error
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BASELINE_DIR = REPO_ROOT / "bench" / "baseline"

COUNT_FIELDS = ("tp", "fp", "tn", "fn")


def latest(language: str, explicit: str | None) -> Path:
    if explicit is not None:
        p = Path(explicit)
        if not p.is_absolute():
            p = BASELINE_DIR / p
        if not p.exists():
            raise FileNotFoundError(f"baseline not found: {p}")
        return p
    candidates = sorted(BASELINE_DIR.glob(f"*-{language}.json"))
    if not candidates:
        raise FileNotFoundError(f"no {language} baselines under {BASELINE_DIR}")
    return candidates[-1]


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def diff_baselines(py: dict, ts: dict) -> list[str]:
    drifts: list[str] = []
    py_per = py.get("per_detector", {})
    ts_per = ts.get("per_detector", {})

    all_ccis = sorted(set(py_per) | set(ts_per))
    for cci in all_ccis:
        if cci not in py_per:
            drifts.append(f"{cci}: missing from Py baseline")
            continue
        if cci not in ts_per:
            drifts.append(f"{cci}: missing from TS baseline")
            continue
        py_st = py_per[cci]
        ts_st = ts_per[cci]
        for f in COUNT_FIELDS:
            if py_st.get(f) != ts_st.get(f):
                drifts.append(
                    f"{cci}: {f} drift — Py={py_st.get(f)} vs TS={ts_st.get(f)}"
                )
    return drifts


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Cross-language parity gate (ADR-0023).")
    ap.add_argument("--py", help="Py baseline path (default: latest under bench/baseline/)", default=None)
    ap.add_argument("--ts", help="TS baseline path (default: latest under bench/baseline/)", default=None)
    args = ap.parse_args(argv)

    try:
        py_path = latest("py", args.py)
        ts_path = latest("ts", args.ts)
    except FileNotFoundError as exc:
        print(f"parity_check: {exc}", file=sys.stderr)
        return 1

    py = load(py_path)
    ts = load(ts_path)

    print(f"Comparing Py baseline {py_path.name} vs TS baseline {ts_path.name}")
    drifts = diff_baselines(py, ts)
    if not drifts:
        print(f"Parity OK — {len(py.get('per_detector', {}))} detectors agree on (tp, fp, tn, fn).")
        return 0

    print(f"Parity DRIFT — {len(drifts)} divergence(s):")
    for d in drifts:
        print(f"  - {d}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
