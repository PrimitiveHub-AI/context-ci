"""test_gate.py — unit tests for the corpus regression gate.

Two failure modes the gate MUST trip on:

  1. Per-detector F1 drop > REGRESSION_TOLERANCE on either language.
  2. Cross-language (tp, fp, tn, fn) divergence on any detector.

These are tested with hand-constructed baseline dicts so the test does
not depend on running the actual detectors (which is the integration-
test plane). The unit plane proves the gate logic itself can't lie.

Run from the repo root:

    uv run --project apps/api python -m pytest bench/scripts/test_gate.py
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

HERE = Path(__file__).resolve().parent


def _load(name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


measure = _load("measure")
parity_check = _load("parity_check")


def _baseline(per_detector: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": "0.1",
        "language": "py",
        "measured_at": "2026-06-05",
        "manifest_version": "0.1",
        "top10_version": "0.1",
        "samples_total": sum(d["support"] for d in per_detector.values()),
        "per_detector": per_detector,
        "overall": {"precision_macro": None, "recall_macro": None, "f1_macro": None},
    }


# ───────────────────────── F1 regression gate ─────────────────────────


def test_gate_trips_on_f1_drop_above_tolerance() -> None:
    prior = _baseline(
        {"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}}
    )
    current = _baseline(
        {"CCI-001": {"tp": 3, "fp": 0, "tn": 27, "fn": 1, "precision": 1.0, "recall": 0.75, "f1": 0.857, "support": 31}}
    )
    regressions = measure.compare_to_baseline(current, prior, measure.REGRESSION_TOLERANCE)
    assert len(regressions) == 1
    assert "CCI-001" in regressions[0]
    assert "1.000" in regressions[0] and "0.857" in regressions[0]


def test_gate_passes_on_f1_drop_within_tolerance() -> None:
    prior = _baseline(
        {"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}}
    )
    current = _baseline(
        {"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 0.985, "support": 31}}
    )
    regressions = measure.compare_to_baseline(current, prior, measure.REGRESSION_TOLERANCE)
    assert regressions == []


def test_gate_passes_when_f1_improves() -> None:
    prior = _baseline(
        {"CCI-003": {"tp": 4, "fp": 0, "tn": 27, "fn": 3, "precision": 1.0, "recall": 0.571, "f1": 0.727, "support": 34}}
    )
    current = _baseline(
        {"CCI-003": {"tp": 7, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 34}}
    )
    regressions = measure.compare_to_baseline(current, prior, measure.REGRESSION_TOLERANCE)
    assert regressions == []


def test_gate_isolates_to_offending_detector() -> None:
    """One detector regresses, three stay healthy → only one entry."""
    prior = _baseline(
        {
            "CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31},
            "CCI-002": {"tp": 3, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 30},
            "CCI-005": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31},
        }
    )
    current = _baseline(
        {
            "CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31},
            "CCI-002": {"tp": 1, "fp": 0, "tn": 27, "fn": 2, "precision": 1.0, "recall": 0.333, "f1": 0.500, "support": 30},
            "CCI-005": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31},
        }
    )
    regressions = measure.compare_to_baseline(current, prior, measure.REGRESSION_TOLERANCE)
    assert len(regressions) == 1
    assert regressions[0].startswith("CCI-002")


# ───────────────────────── parity gate ─────────────────────────


def test_parity_check_clean_when_counts_match() -> None:
    py = _baseline({"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}})
    ts = _baseline({"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}})
    drifts = parity_check.diff_baselines(py, ts)
    assert drifts == []


@pytest.mark.parametrize("field", ["tp", "fp", "tn", "fn"])
def test_parity_check_trips_on_any_count_drift(field: str) -> None:
    py = _baseline({"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}})
    ts = _baseline({"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}})
    ts["per_detector"]["CCI-001"][field] += 1
    drifts = parity_check.diff_baselines(py, ts)
    assert len(drifts) == 1
    assert field in drifts[0]
    assert "CCI-001" in drifts[0]


def test_parity_check_reports_missing_detectors_per_side() -> None:
    py = _baseline({"CCI-001": {"tp": 4, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 31}})
    ts = _baseline({"CCI-002": {"tp": 3, "fp": 0, "tn": 27, "fn": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 30}})
    drifts = parity_check.diff_baselines(py, ts)
    assert any("CCI-001" in d and "TS" in d for d in drifts)
    assert any("CCI-002" in d and "Py" in d for d in drifts)


# ───────────────────────── parity_check latest-baseline discovery ─────────────────────────


def test_parity_latest_picks_most_recent_lexicographic(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """YYYY-MM-DD-<lang>.json sorts lex == chronologically.

    Used by parity_check.py when no explicit --py / --ts path is given,
    and mirrored by gate.sh's bash glob discovery.
    """
    (tmp_path / "2026-06-01-py.json").write_text("{}")
    (tmp_path / "2026-06-04-py.json").write_text("{}")
    (tmp_path / "2026-06-05-py.json").write_text("{}")
    (tmp_path / "2026-06-05-ts.json").write_text("{}")  # other language → ignored

    monkeypatch.setattr(parity_check, "BASELINE_DIR", tmp_path)
    chosen = parity_check.latest("py", None)
    assert chosen.name == "2026-06-05-py.json"


def test_parity_latest_raises_when_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(parity_check, "BASELINE_DIR", tmp_path)
    with pytest.raises(FileNotFoundError):
        parity_check.latest("py", None)
