"""Scanner conformance suite harness — Python side.

Per ADR-0032: the same manifest + fixtures in
`docs/context-ci-top-10/conformance/` are run through BOTH the
Python detectors (this file) and the TS detectors
(`packages/phub/test/scanner-conformance.test.ts`). Drift between
the two implementations fails CI.

The manifest declares per-fixture expectations:
- positive: the named primary CCI detector MUST fire (passed=False)
- negative: every detector MUST NOT fire (passed=True)
- expected_detail_tags: if present, MUST appear in the verdict's hints
- also_fires: other CCI IDs ALLOWED to fire on this positive fixture
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scanners.registry import get_all_detectors
from scanners.types import DetectorContext

_CONFORMANCE_DIR = _CONFORMANCE_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "docs"
    / "context-ci-top-10"
    / "conformance"
)


def _load_manifest() -> list[dict[str, object]]:
    """Walk-up discovery: support running from apps/api or the repo root."""
    manifest_path = _CONFORMANCE_DIR / "manifest.json"
    if not manifest_path.exists():
        # Fallback: container layout where docs/ is mounted at /repo/docs.
        alt = Path("/repo/docs/context-ci-top-10/conformance/manifest.json")
        if alt.exists():
            manifest_path = alt
    if not manifest_path.exists():
        pytest.skip(
            f"conformance manifest not found at {manifest_path}; mount docs/ in compose.override.yaml"
        )
    return json.loads(manifest_path.read_text(encoding="utf-8"))["fixtures"]


def _fixture_path(rel: str) -> Path:
    """Resolve fixture path; uses the same walk-up fallback as the manifest."""
    candidate = _CONFORMANCE_DIR / rel
    if candidate.exists():
        return candidate
    alt = Path("/repo/docs/context-ci-top-10/conformance") / rel
    if alt.exists():
        return alt
    raise FileNotFoundError(f"fixture not found: {rel}")


def _read_fixture_content(rel: str) -> str:
    return _fixture_path(rel).read_text(encoding="utf-8")


_DETECTORS = get_all_detectors()
_DETECTOR_BY_CCI = {d.cci_id: d for d in _DETECTORS}


@pytest.mark.parametrize("entry", _load_manifest(), ids=lambda e: e["path"])
def test_conformance_fixture(entry: dict[str, object]) -> None:
    """Run one fixture through every active detector and assert manifest expectations."""
    rel_path: str = entry["path"]  # type: ignore[assignment]
    expect: str = entry["expect"]  # type: ignore[assignment]
    primary_cci: str = entry["primary_cci"]  # type: ignore[assignment]
    expected_tags: list[str] = list(entry.get("expected_detail_tags", []))  # type: ignore[arg-type]
    also_fires: set[str] = set(entry.get("also_fires", []))  # type: ignore[arg-type]

    content = _read_fixture_content(rel_path)
    ctx = DetectorContext(
        content=content,
        primitive_slug="conformance",
        semver="1.0.0",
        raw_bytes=content.encode("utf-8"),
    )

    verdicts_by_cci = {d.cci_id: d.run(ctx) for d in _DETECTORS}

    if expect == "negative":
        # Every detector must NOT fire on clean content.
        for cci, verdict in verdicts_by_cci.items():
            assert verdict.passed, (
                f"{rel_path}: {cci} fired on a negative fixture "
                f"(severity={verdict.severity.value}, hints={len(verdict.diff_hints)})"
            )
        return

    # Positive expectation:
    assert primary_cci in verdicts_by_cci, (
        f"{rel_path}: primary_cci {primary_cci} is not in the active detector roster"
    )
    primary_verdict = verdicts_by_cci[primary_cci]
    assert not primary_verdict.passed, (
        f"{rel_path}: primary_cci {primary_cci} did NOT fire on a positive fixture"
    )

    if expected_tags:
        actual_tags = {h.detail_tag for h in primary_verdict.diff_hints}
        for required in expected_tags:
            assert required in actual_tags, (
                f"{rel_path}: expected detail_tag {required!r} not in actual tags "
                f"{sorted(actual_tags)}"
            )

    # Cross-detector false-positive check: detectors NOT in also_fires
    # (and NOT the primary) must stay clean on this fixture.
    permitted_to_fire = {primary_cci} | also_fires
    for cci, verdict in verdicts_by_cci.items():
        if cci in permitted_to_fire:
            continue
        assert verdict.passed, (
            f"{rel_path}: {cci} fired on a fixture whose primary is "
            f"{primary_cci} (and also_fires={sorted(also_fires)}). "
            f"Either widen also_fires (with rationale) or tighten the detector."
        )


def test_manifest_covers_every_active_detector() -> None:
    """Each active CCI ID must have at least one positive fixture."""
    manifest = _load_manifest()
    positive_ccis = {
        entry["primary_cci"]  # type: ignore[index]
        for entry in manifest
        if entry["expect"] == "positive"  # type: ignore[index]
    }
    for cci in _DETECTOR_BY_CCI:
        assert cci in positive_ccis, (
            f"{cci} has no positive fixture — conformance suite must cover every active detector"
        )
