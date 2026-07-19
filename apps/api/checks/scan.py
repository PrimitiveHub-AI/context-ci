"""Detector orchestration + verdict aggregation for `/check`.

Runs the canonical Python detector set (`get_all_detectors()`) over
a single content blob OR a collection of blobs (one per file from a
tarball extraction), and aggregates results into a single response
shape suitable for the verdict UI.

The aggregate score comes from the verdict engine in `verdict.py`
(ADR-0041) — class-separated, density-aware, fully derivable. The
old `100 - 25*FAIL - 10*WARN` formula from ADR-0034 § 4 is
superseded; see `trust_score()` for the back-compat shim retained
during the transition.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from checks.verdict import (
    aggregate_findings,
    class_counts_to_wire,
    classified_finding_to_wire,
    finding_guidance,
    score_findings,
    verdict_band,
)
from scanners.registry import get_all_detectors
from scanners.types import DetectorContext, Severity, Verdict

# Top 10 detector display names — used by the verdict UI when a
# detector reports INFO (no hits) so the user can still see that the
# check ran. Stable strings; the verdict-shape contract upstream
# (ADR-0023) already defines `detector_name` + `cci_id`.
SEVERITY_RANK: dict[Severity, int] = {
    Severity.INFO: 0,
    Severity.WARN: 1,
    Severity.FAIL: 2,
}


@dataclass(frozen=True, slots=True)
class FileScan:
    """One scanned file's verdict set + light metadata.

    `path` is a display string — for `mode=content` it's the
    constant `"<paste>"`, for `mode=url` it's the requested URL,
    for `mode=npx` it's the entry name inside the tarball.
    """

    path: str
    bytes_count: int
    verdicts: tuple[Verdict, ...]


def _verdict_to_dict(v: Verdict) -> dict[str, object]:
    """Serialize a Verdict for the wire."""
    return {
        "detectorName": v.detector_name,
        "threatCategory": v.threat_category,
        "cciId": v.cci_id,
        "severity": v.severity.value,
        "passed": v.passed,
        "summary": v.summary,
        "detectorVersion": v.detector_version,
        "diffHints": [
            {
                "line": h.line,
                "snippet": h.snippet,
                "suggestion": h.suggestion,
                "detailTag": h.detail_tag,
                # "Show your work": how to tell a true positive from a
                # false positive for this exact pattern (ADR-0041 trust UX).
                "howToJudge": finding_guidance(v.cci_id, h.detail_tag),
            }
            for h in v.diff_hints
        ],
    }


def _file_scan_to_dict(fs: FileScan) -> dict[str, object]:
    return {
        "path": fs.path,
        "bytes": fs.bytes_count,
        "verdicts": [_verdict_to_dict(v) for v in fs.verdicts],
    }


def scan_blob(
    content: str,
    *,
    slug: str = "paste",
    semver: str = "0.0.0",
    file_path: str = "",
) -> tuple[Verdict, ...]:
    """Run every active detector against a single content string.

    `slug` and `semver` are required by `DetectorContext` but
    informational — they appear in detector-internal logs only.
    `/check` uses placeholder values; the registry-pipeline call
    site populates them from the primitive being signed.

    `file_path` is the relative path inside a multi-file scan (tarball
    or repo). Some detectors (T9 license-family) skip license-named
    files; passing the path through enables that without affecting
    single-blob `mode=content` callers.
    """
    raw_bytes = content.encode("utf-8")
    ctx = DetectorContext(
        primitive_slug=slug,
        semver=semver,
        content=content,
        raw_bytes=raw_bytes,
        file_path=file_path,
    )
    return tuple(detector.run(ctx) for detector in get_all_detectors())


def trust_score(verdicts: tuple[Verdict, ...]) -> int:
    """Compute the headline score for a single-file verdict tuple.

    Backward-compatible thin wrapper over the new engine: feeds the
    verdicts in with an empty file path, classifies, aggregates,
    scores. Same shape callers use today.

    Per ADR-0041 the score is no longer the
    `100 - 25*FAIL - 10*WARN` collapse. See `verdict.py` for the
    class-separated, density-aware engine. The function name is
    preserved to minimize call-site churn during the transition.
    """
    findings = aggregate_findings([("", verdicts)])
    return score_findings(findings).score


def trust_band(score: int) -> str:
    """Map a numeric score to one of four named bands.

    The UI renders the band as the headline; the number is auxiliary.
    Unchanged from ADR-0034 § 4 — the band thresholds stay; the
    formula behind the score is the new ADR-0041 engine.
    """
    return verdict_band(score)


def highest_severity(verdicts: tuple[Verdict, ...]) -> Severity:
    """The worst severity seen across all verdicts, or INFO if none."""
    worst: Severity = Severity.INFO
    for v in verdicts:
        if SEVERITY_RANK[v.severity] > SEVERITY_RANK[worst]:
            worst = v.severity
    return worst


def aggregate_files(files: list[FileScan]) -> tuple[Verdict, ...]:
    """Flatten per-file verdicts into a single aggregate tuple.

    Used by the `npx` path where one input expands to many files.
    For single-blob modes (`content`, `url`) the caller passes
    `[single_file]` and gets back its verdicts unchanged.

    Kept for back-compat with the old `summary` shape; the new
    engine works directly off `FileScan` lists via
    `aggregate_findings()` — see `build_summary()`.
    """
    flat: list[Verdict] = []
    for fs in files:
        flat.extend(fs.verdicts)
    return tuple(flat)


def _per_file_pairs(files: list[FileScan]) -> list[tuple[str, tuple[Verdict, ...]]]:
    """Adapter — (file_path, verdicts) tuples for the verdict engine."""
    return [(fs.path, fs.verdicts) for fs in files]


def build_summary(verdicts: tuple[Verdict, ...]) -> dict[str, object]:
    """Build the `summary` payload sub-tree the verdict UI reads.

    Single-tuple call sites: the verdicts come from one file (paste
    or fetched URL). The engine still produces the new class-separated
    breakdown + derivation.
    """
    return build_summary_from_files([FileScan(path="", bytes_count=0, verdicts=verdicts)])


def build_summary_from_files(files: list[FileScan]) -> dict[str, object]:
    """Multi-file variant. Used by the `npx` path so density-damping
    across many files of identical content produces one effective hit.

    Returns the same shape as `build_summary()`. The wire keys are
    the new ADR-0041 shape (`classCounts`, `derivation`,
    `engineVersion`, `rubricVersion`) plus the back-compat keys
    consumers already read (`trustScore`, `verdictBand`, `passed`,
    `detectorsRun`, `detectorsTriggered`, `failCount`, `warnCount`,
    `infoCount`, `highestSeverity`).
    """
    findings = aggregate_findings(_per_file_pairs(files))
    score_result = score_findings(findings)

    # Back-compat severity counts. Count over Verdicts (per-detector
    # results) not per-hint — the old wire shape treated a detector
    # that fired N times as one `failCount` increment.
    all_verdicts = [v for fs in files for v in fs.verdicts]
    fail_count = sum(1 for v in all_verdicts if v.severity is Severity.FAIL)
    warn_count = sum(1 for v in all_verdicts if v.severity is Severity.WARN)
    info_count = sum(1 for v in all_verdicts if v.severity is Severity.INFO)
    triggered = fail_count + warn_count

    return {
        # — back-compat keys, consumers already read these —
        "trustScore": score_result.score,
        "verdictBand": score_result.band,
        "passed": all(v.passed for v in all_verdicts),
        "detectorsRun": len(get_all_detectors()),
        "detectorsTriggered": triggered,
        "failCount": fail_count,
        "warnCount": warn_count,
        "infoCount": info_count,
        "highestSeverity": highest_severity(tuple(all_verdicts)).value,
        # — new ADR-0041 keys —
        "engineVersion": str(score_result.derivation.get("engine", "")),
        "rubricVersion": str(score_result.derivation.get("rubric", "")),
        "classCounts": class_counts_to_wire(score_result.class_counts),
        "derivation": score_result.derivation,
    }


def files_payload(files: list[FileScan]) -> list[dict[str, object]]:
    return [_file_scan_to_dict(fs) for fs in files]


def aggregate_verdicts_payload(verdicts: tuple[Verdict, ...]) -> list[dict[str, object]]:
    return [_verdict_to_dict(v) for v in verdicts]


def classified_findings_payload(files: list[FileScan]) -> list[dict[str, Any]]:
    """Top-level `classifiedFindings` block for the `/check` response.

    One entry per classified DiffHint (not per Verdict). Includes the
    derivation block so the verdict is reviewer-reproducible from the
    payload alone. New in ADR-0041; consumers that don't read it can
    safely ignore the key.
    """
    findings = aggregate_findings(_per_file_pairs(files))
    return [classified_finding_to_wire(f) for f in findings]
