#!/usr/bin/env python3
"""Reproduce the confidence-interval and performance numbers in the paper.

Two outputs, both honest-by-construction:

  1. Wilson 95% confidence intervals on the pooled proportions behind the
     headline numbers (Table "Statistical confidence"). Computed in closed
     form from the committed bench/baseline/*.json counts — no engine run
     needed, so the intervals are reproducible from the same artifact the
     evaluation tables come from.

  2. Per-primitive scan latency + throughput for the full ten-detector
     Python pass over the corpus (Section "Performance"). Replicates the
     exact DetectorContext path bench/cli/replay.py uses.

Usage (from repo root):
    PYTHONPATH=apps/api python3 bench/scripts/paper_stats.py
    PYTHONPATH=apps/api python3 bench/scripts/paper_stats.py --ci-only
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASELINE = REPO / "bench" / "baseline"
CORPUS = REPO / "bench" / "corpus"
Z = 1.96  # 95%


def wilson(k: int, n: int) -> tuple[float, float, float]:
    if n == 0:
        return (0.0, 0.0, 0.0)
    p = k / n
    d = 1 + Z * Z / n
    centre = (p + Z * Z / (2 * n)) / d
    half = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d
    return (p, max(0.0, centre - half), min(1.0, centre + half))


def latest(lang: str) -> dict:
    files = sorted(BASELINE.glob(f"*-{lang}.json"))
    if not files:
        raise SystemExit(f"no baseline for {lang} under {BASELINE}")
    return json.loads(files[-1].read_text())


def confidence_intervals() -> None:
    py = latest("py")
    ts = latest("ts")

    def pooled(b: dict, slc: str, num: str, den_keys: tuple[str, ...]) -> tuple[int, int]:
        per = (b if slc == "in" else b["holdout"])["per_detector"]
        k = sum(d[num] for d in per.values())
        n = sum(sum(d[x] for x in den_keys) for d in per.values())
        return k, n

    rows = []
    k, n = pooled(py, "in", "tp", ("tp", "fn"))
    rows.append(("In-sample adversarial recall", k, n))
    k, n = pooled(py, "in", "fp", ("fp", "tn"))
    rows.append(("In-sample benign FP rate", k, n))
    d = py["per_detector"]["CCI-005"]
    rows.append(("CCI-005 precision", d["tp"], d["tp"] + d["fp"]))
    k, n = pooled(py, "hold", "tp", ("tp", "fn"))
    rows.append(("Held-out recall, Python", k, n))
    k, n = pooled(ts, "hold", "tp", ("tp", "fn"))
    rows.append(("Held-out recall, TypeScript", k, n))

    print("== Wilson 95% confidence intervals (from committed counts) ==")
    for label, k, n in rows:
        p, lo, hi = wilson(k, n)
        print(f"  {label:32s} {k}/{n} = {p:.4f}  95% CI [{lo:.4f}, {hi:.4f}]")


def performance(passes: int = 5) -> None:
    sys.path.insert(0, str(REPO / "apps" / "api"))
    import yaml  # noqa: PLC0415
    from scanners.registry import get_all_detectors  # noqa: PLC0415
    from scanners.types import DetectorContext  # noqa: PLC0415

    man = yaml.safe_load((CORPUS / "manifest.yaml").read_text())["samples"]
    dets = list(get_all_detectors())
    items = []
    for s in man:
        p = CORPUS / s["path"]
        if p.exists():
            c = p.read_text()
            items.append((s["id"], c, c.encode("utf-8")))

    def one_pass() -> list[float]:
        lat = []
        for sid, c, b in items:
            ctx = DetectorContext(
                content=c, primitive_slug=sid, semver="0.0.0",
                raw_bytes=b, file_path=sid,
            )
            t0 = time.perf_counter()
            for d in dets:
                d.run(ctx)
            lat.append((time.perf_counter() - t0) * 1000.0)
        return lat

    one_pass()  # warmup
    lat: list[float] = []
    t0 = time.perf_counter()
    for _ in range(passes):
        lat += one_pass()
    wall = time.perf_counter() - t0
    lat.sort()

    def pct(q: float) -> float:
        return lat[min(len(lat) - 1, int(q * len(lat)))]

    print(f"\n== Performance: full {len(dets)}-detector Python pass, "
          f"{len(items)} primitives x {passes} passes ==")
    print(f"  per-primitive latency  p50={statistics.median(lat):.3f} ms  "
          f"p95={pct(0.95):.3f} ms  p99={pct(0.99):.3f} ms")
    print(f"  throughput             {len(lat) / wall:.0f} primitives/sec "
          f"(single-thread, python {sys.version.split()[0]})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci-only", action="store_true", help="skip the timing run")
    args = ap.parse_args()
    confidence_intervals()
    if not args.ci_only:
        performance()


if __name__ == "__main__":
    main()
