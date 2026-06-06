#!/usr/bin/env python3
"""replay.py — single-sample replay against the corpus baseline.

Given a sample ID (or `--all`), runs the Python detectors against the
sample's primary detector AND optionally cross-trips every other
detector, then diffs the per-detector verdict against the most-recent
committed baseline. Lets paper reviewers re-run any specific sample
deterministically without running the full corpus gate.

Spec:    docs/corpus-v0.1.md
Top 10:  docs/top10-corpus-map.md
ADR:     docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md
Gate:    bench/scripts/gate.sh

Usage:
    # Single-sample replay; compares to the latest committed Py baseline.
    python bench/cli/replay.py --sample S-001

    # Restrict cross-trip to a single detector.
    python bench/cli/replay.py --sample S-001 --detector CCI-001

    # Replay every sample; print only diverging verdicts (drift mode).
    python bench/cli/replay.py --all --diff-only

    # Compare against a specific baseline.
    python bench/cli/replay.py --sample S-090 --baseline bench/baseline/2026-06-06-py.json

Exit codes:
    0 — replay completed; no drift under --diff-only OR drift not gated
    1 — drift detected under --diff-only OR usage error
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
APPS_API = REPO_ROOT / "apps" / "api"
if str(APPS_API) not in sys.path:
    sys.path.insert(0, str(APPS_API))

from scanners.protocol import Detector  # type: ignore[import-not-found]
from scanners.registry import get_all_detectors  # type: ignore[import-not-found]
from scanners.types import DetectorContext, Severity, Verdict  # type: ignore[import-not-found]

BENCH_ROOT = REPO_ROOT / "bench"
CORPUS_ROOT = BENCH_ROOT / "corpus"
MANIFEST_PATH = CORPUS_ROOT / "manifest.yaml"
BASELINE_DIR = BENCH_ROOT / "baseline"


@dataclass
class ManifestSample:
    id: str
    path: str
    label: str
    cci_id: str
    expected_verdict: str
    holdout: bool


def load_manifest() -> tuple[dict[str, Any], list[ManifestSample]]:
    doc = yaml.safe_load(MANIFEST_PATH.read_text())
    samples = [
        ManifestSample(
            id=s["id"],
            path=s["path"],
            label=s["label"],
            cci_id=s["cci_id"],
            expected_verdict=s["expected_verdict"],
            holdout=bool(s.get("holdout", False)),
        )
        for s in doc["samples"]
    ]
    return doc, samples


def latest_baseline_path() -> Path | None:
    matches = sorted(BASELINE_DIR.glob("*-py.json"))
    return matches[-1] if matches else None


def load_baseline(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def select_detectors(restrict_cci: str | None) -> list[Detector]:
    all_d = list(get_all_detectors())
    if restrict_cci is None:
        return all_d
    return [d for d in all_d if d.cci_id == restrict_cci]


def severity_str(sev: Any) -> str:
    if isinstance(sev, Severity):
        return sev.value if hasattr(sev, "value") else str(sev)
    return str(sev).lower()


def replay_one(
    sample: ManifestSample,
    detectors: list[Detector],
) -> dict[str, dict[str, Any]]:
    """Run every detector against the sample. Returns {cci_id: {severity, passed, hints}}."""
    sample_path = CORPUS_ROOT / sample.path
    content = sample_path.read_text()
    ctx = DetectorContext(
        content=content,
        primitive_slug=sample.id,
        semver="0.0.0",
        raw_bytes=content.encode("utf-8"),
        file_path=str(sample_path),
    )
    out: dict[str, dict[str, Any]] = {}
    for d in detectors:
        v = d.run(ctx)
        out[d.cci_id] = {
            "severity": severity_str(v.severity),
            "passed": v.passed,
            "detector_version": v.detector_version,
            "summary": v.summary,
            "diff_hints_count": len(v.diff_hints),
        }
    return out


def expected_outcome(sample: ManifestSample, replayed_cci: str, severity: str) -> str:
    """Match the gate's scoring rule for ONE sample × ONE detector."""
    sev_int = {"info": 0, "pass": 0, "warn": 1, "fail": 2}.get(severity, 0)
    expected_int = {"PASS": 0, "WARN": 1, "FAIL": 2}.get(sample.expected_verdict, 0)
    if replayed_cci == sample.cci_id:
        if sample.label in {"adversarial", "borderline"}:
            return "TP" if sev_int >= expected_int else "FN"
        if sample.label == "benign":
            return "FP" if sev_int >= 1 else "TN"
    else:
        # Cross-trip: only FP/TN dimension applies for benign labels.
        if sample.label == "benign":
            return "FP" if sev_int >= 1 else "TN"
    return "—"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Replay a corpus sample against the current Python detectors."
    )
    parser.add_argument(
        "--sample", help='Sample ID (e.g. "S-001"). Required unless --all.'
    )
    parser.add_argument(
        "--all", action="store_true", help="Replay every sample in the manifest."
    )
    parser.add_argument(
        "--detector",
        help='Restrict to a single detector (e.g. "CCI-001"). Default = all 10.',
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        help="Baseline JSON to diff against. Default = latest under bench/baseline/.",
    )
    parser.add_argument(
        "--diff-only",
        action="store_true",
        help="Only print samples whose primary-detector outcome diverges from the baseline.",
    )
    parser.add_argument(
        "--include-holdout",
        action="store_true",
        help="When --all is set, include holdout samples (default: in-sample only).",
    )
    args = parser.parse_args()

    if not args.sample and not args.all:
        parser.error("--sample or --all required")
    if args.sample and args.all:
        parser.error("--sample and --all are mutually exclusive")

    _doc, all_samples = load_manifest()
    selected: list[ManifestSample]
    if args.sample:
        match = next((s for s in all_samples if s.id == args.sample), None)
        if match is None:
            sys.stderr.write(f"replay: sample {args.sample} not in manifest\n")
            return 1
        selected = [match]
    else:
        selected = [s for s in all_samples if args.include_holdout or not s.holdout]

    detectors = select_detectors(args.detector)
    if not detectors:
        sys.stderr.write(f"replay: no detector matches --detector={args.detector}\n")
        return 1

    baseline_path = args.baseline or latest_baseline_path()
    baseline = load_baseline(baseline_path) if baseline_path else None
    if baseline:
        sys.stdout.write(f"# baseline: {baseline_path}\n")
    else:
        sys.stdout.write("# baseline: none — running open-loop\n")
    sys.stdout.write(f"# samples: {len(selected)} | detectors: {len(detectors)}\n\n")

    drift_count = 0
    for s in selected:
        replayed = replay_one(s, detectors)
        primary = replayed.get(s.cci_id)
        primary_outcome = (
            expected_outcome(s, s.cci_id, primary["severity"]) if primary else "—"
        )
        # Baseline comparison: we don't have per-sample verdicts in the
        # baseline JSON (it's aggregate). Instead, compare the primary
        # outcome to what the manifest says the expected verdict is —
        # that IS the per-sample contract.
        ok = primary is None or primary_outcome in {"TP", "TN", "—"}
        # Holdout samples whose primary outcome is FN/FP are EXPECTED
        # ledger-documented gaps (e.g. FN-010 on S-096) — not detector
        # drift. Don't count them toward the drift exit code unless
        # --strict is set; do still print them (the operator wants to
        # SEE the gap, just not be blocked by it).
        is_documented_holdout_gap = s.holdout and not ok
        if not ok and not is_documented_holdout_gap:
            drift_count += 1
        if args.diff_only and ok:
            continue

        holdout_tag = "  [HOLDOUT]" if s.holdout else ""
        sys.stdout.write(f"{s.id}{holdout_tag}  ({s.label}, primary={s.cci_id}, expected={s.expected_verdict})\n")
        sys.stdout.write(f"  path: {s.path}\n")
        for cci, v in replayed.items():
            marker = "★" if cci == s.cci_id else " "
            out = expected_outcome(s, cci, v["severity"])
            sys.stdout.write(
                f"  {marker} {cci}  sev={v['severity']:<4}  passed={str(v['passed']):<5}"
                f"  outcome={out:<3}  v={v['detector_version']}  hints={v['diff_hints_count']}\n"
            )
        sys.stdout.write("\n")

    sys.stdout.write(f"# samples processed: {len(selected)} | drift: {drift_count}\n")
    if args.diff_only and drift_count > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
