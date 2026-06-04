#!/usr/bin/env python3
"""measure.py — Python precision/recall measurement against
bench/corpus/manifest.yaml.

Mirrors bench/scripts/measure.ts on the Python detector side. Reads
the same manifest + samples, runs every Python detector against every
sample, computes per-detector precision / recall / F1, emits a
human-readable report + a baseline JSON.

Spec: docs/corpus-v0.1.md
ADR:  docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md

Run from the repo root, with the apps/api Python environment active:

    uv run --project apps/api python bench/scripts/measure.py
    uv run --project apps/api python bench/scripts/measure.py --gate
    uv run --project apps/api python bench/scripts/measure.py --detector CCI-001

Exit codes:
    0 — measurement completed; no regression under --gate
    1 — regression detected (under --gate) OR usage error
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

# Make `apps.api.scanners` importable when running from the repo root.
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

REGRESSION_TOLERANCE = 0.02


# ---------------------------------------------------------------------------
# Data shapes
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ManifestSample:
    id: str
    path: str
    label: str
    threat_category: str
    cci_id: str
    expected_verdict: str
    contributor: str
    added: str
    notes: str


@dataclass
class DetectorStats:
    tp: int = 0
    fp: int = 0
    tn: int = 0
    fn: int = 0
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    support: int = 0


# ---------------------------------------------------------------------------
# Manifest + sample helpers
# ---------------------------------------------------------------------------


def load_manifest() -> tuple[str, str, list[ManifestSample]]:
    raw = yaml.safe_load(MANIFEST_PATH.read_text(encoding="utf-8"))
    if raw.get("version") != "0.1":
        raise RuntimeError(f"unsupported corpus version: {raw.get('version')}")
    samples = [
        ManifestSample(
            id=s["id"],
            path=s["path"],
            label=s["label"],
            threat_category=s["threat_category"],
            cci_id=s["cci_id"],
            expected_verdict=s["expected_verdict"],
            contributor=s["contributor"],
            added=str(s["added"]),
            notes=s.get("notes", ""),
        )
        for s in raw["samples"]
    ]
    return raw["version"], raw["top10_version"], samples


def severity_to_int(s: str | Severity) -> int:
    if isinstance(s, Severity):
        s = s.value
    return {"fail": 2, "FAIL": 2, "warn": 1, "WARN": 1, "info": 0, "INFO": 0, "PASS": 0, "pass": 0}.get(s, 0)


def detector_verdict_severity(v: Verdict) -> str:
    if v.severity == Severity.FAIL:
        return "FAIL"
    if v.severity == Severity.WARN:
        return "WARN"
    return "PASS"


def score_sample(
    s: ManifestSample,
    verdicts: dict[str, Verdict],
    stats: dict[str, DetectorStats],
) -> None:
    """Same scoring algorithm as the TS side (measure.ts § scoreSample).

    Primary detector (matching cci_id): full TP/FP/TN/FN.
    Other detectors: only FP/TN dimension on benign samples (no
    ground truth for other detectors on this sample's attack family).
    """
    expected = severity_to_int(s.expected_verdict)
    for cci, v in verdicts.items():
        st = stats.setdefault(cci, DetectorStats())
        got = severity_to_int(detector_verdict_severity(v))

        if cci == s.cci_id:
            if s.label in {"adversarial", "borderline"}:
                if got >= expected:
                    st.tp += 1
                else:
                    st.fn += 1
            elif s.label == "benign":
                if got >= 1:
                    st.fp += 1
                else:
                    st.tn += 1
        else:
            if s.label == "benign":
                if got >= 1:
                    st.fp += 1
                else:
                    st.tn += 1


def finalize_stats(st: DetectorStats) -> None:
    st.support = st.tp + st.fp + st.tn + st.fn
    st.precision = (st.tp / (st.tp + st.fp)) if (st.tp + st.fp) > 0 else None
    st.recall = (st.tp / (st.tp + st.fn)) if (st.tp + st.fn) > 0 else None
    if st.precision is not None and st.recall is not None and (st.precision + st.recall) > 0:
        st.f1 = (2 * st.precision * st.recall) / (st.precision + st.recall)
    else:
        st.f1 = None


def macro_average(per: dict[str, DetectorStats]) -> dict[str, float | None]:
    ps = [s.precision for s in per.values() if s.precision is not None]
    rs = [s.recall for s in per.values() if s.recall is not None]
    fs = [s.f1 for s in per.values() if s.f1 is not None]
    avg = lambda xs: (sum(xs) / len(xs)) if xs else None  # noqa: E731
    return {
        "precision_macro": avg(ps),
        "recall_macro": avg(rs),
        "f1_macro": avg(fs),
    }


def fmt_num(n: float | None) -> str:
    return f"{n:.3f}" if n is not None else "n/a"


# ---------------------------------------------------------------------------
# Detector selection + measurement
# ---------------------------------------------------------------------------


def select_detectors(restrict_to: str | None) -> list[Detector]:
    all_d = get_all_detectors()
    if restrict_to is None:
        return all_d
    return [d for d in all_d if d.cci_id == restrict_to]


def measure(samples: list[ManifestSample], detectors: list[Detector]) -> dict[str, DetectorStats]:
    stats: dict[str, DetectorStats] = {}
    for s in samples:
        abs_path = CORPUS_ROOT / s.path
        if not abs_path.exists():
            raise FileNotFoundError(f"sample {s.id} missing on disk: {abs_path}")
        content = abs_path.read_text(encoding="utf-8")
        raw_bytes = abs_path.read_bytes()
        ctx = DetectorContext(
            primitive_slug=s.id.lower(),
            semver="0.0.0",
            content=content,
            raw_bytes=raw_bytes,
        )
        verdicts = {d.cci_id: d.run(ctx) for d in detectors}
        score_sample(s, verdicts, stats)
    for st in stats.values():
        finalize_stats(st)
    return stats


# ---------------------------------------------------------------------------
# Reporters + baseline IO
# ---------------------------------------------------------------------------


def print_report(
    corpus_version: str,
    top10_version: str,
    samples: list[ManifestSample],
    per: dict[str, DetectorStats],
    overall: dict[str, float | None],
) -> None:
    labels: dict[str, int] = {}
    for s in samples:
        labels[s.label] = labels.get(s.label, 0) + 1
    print(
        f"Corpus v{corpus_version} (top10 v{top10_version}) — "
        f"{len(samples)} samples "
        f"({labels.get('adversarial', 0)} adversarial, "
        f"{labels.get('benign', 0)} benign, "
        f"{labels.get('borderline', 0)} borderline)\n"
    )
    print("Per detector:")
    for cci, st in sorted(per.items()):
        print(f"  {cci}:")
        print(f"    precision  {fmt_num(st.precision)}  (TP={st.tp}, FP={st.fp})")
        print(f"    recall     {fmt_num(st.recall)}  (TP={st.tp}, FN={st.fn})")
        print(f"    F1         {fmt_num(st.f1)}")
        print(f"    support    {st.support} samples")
    print()
    print("Overall (macro-average over detectors):")
    print(f"  precision  {fmt_num(overall['precision_macro'])}")
    print(f"  recall     {fmt_num(overall['recall_macro'])}")
    print(f"  F1         {fmt_num(overall['f1_macro'])}\n")


def baseline_doc(
    measured_at: str,
    corpus_version: str,
    top10_version: str,
    samples_total: int,
    per: dict[str, DetectorStats],
    overall: dict[str, float | None],
) -> dict[str, Any]:
    return {
        "version": "0.1",
        "language": "py",
        "measured_at": measured_at,
        "manifest_version": corpus_version,
        "top10_version": top10_version,
        "samples_total": samples_total,
        "per_detector": {cci: asdict(st) for cci, st in sorted(per.items())},
        "overall": overall,
        "parity": {
            "agreed_sample_ids": [],
            "drift_sample_ids": [],
        },
    }


def compare_to_baseline(current: dict[str, Any], prior: dict[str, Any], tolerance: float) -> list[str]:
    regressions: list[str] = []
    for cci, st in current["per_detector"].items():
        prior_st = prior["per_detector"].get(cci)
        if not prior_st:
            continue
        if prior_st.get("f1") is None or st.get("f1") is None:
            continue
        drop = prior_st["f1"] - st["f1"]
        if drop > tolerance:
            regressions.append(f"{cci}: F1 {prior_st['f1']:.3f} → {st['f1']:.3f} (-{drop:.3f})")
    return regressions


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Python precision/recall measurement against the PrimitiveHub corpus (v0.1).",
    )
    parser.add_argument("--baseline", help="compare against a prior baseline JSON", default=None)
    parser.add_argument("--gate", help="exit 1 on F1 regression > tolerance", action="store_true")
    parser.add_argument("--detector", help="restrict to one detector (CCI-NNN)", default=None)
    parser.add_argument(
        "--no-baseline",
        help="don't write a baseline JSON",
        dest="emit_baseline",
        action="store_false",
    )
    parser.add_argument(
        "--write-baseline",
        help="write baseline to a specific path",
        dest="baseline_out",
        default=None,
    )
    args = parser.parse_args(argv)

    corpus_version, top10_version, samples = load_manifest()
    detectors = select_detectors(args.detector)
    if not detectors:
        print(f"measure: no detectors selected (--detector={args.detector})", file=sys.stderr)
        return 1

    per = measure(samples, detectors)
    overall = macro_average(per)
    print_report(corpus_version, top10_version, samples, per, overall)

    measured_at = datetime.now(timezone.utc).date().isoformat()
    current = baseline_doc(measured_at, corpus_version, top10_version, len(samples), per, overall)

    if args.emit_baseline:
        BASELINE_DIR.mkdir(parents=True, exist_ok=True)
        out_path = Path(args.baseline_out) if args.baseline_out else BASELINE_DIR / f"{measured_at}-py.json"
        out_path.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
        print(f"Baseline written: {out_path}")

    if args.baseline:
        prior = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
        regressions = compare_to_baseline(current, prior, REGRESSION_TOLERANCE)
        if not regressions:
            print(f"Comparison vs {args.baseline}: no regressions (tolerance {REGRESSION_TOLERANCE}).")
        else:
            print(f"Comparison vs {args.baseline}: {len(regressions)} regression(s):")
            for r in regressions:
                print(f"  - {r}")
            if args.gate:
                return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
