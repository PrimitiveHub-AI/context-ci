"""Detector orchestration + deterministic trust scoring for `/check`.

Runs the canonical Python detector set (`get_all_detectors()`) over
a single content blob OR a collection of blobs (one per file from a
tarball extraction), and aggregates results into a single response
shape suitable for the verdict UI.

The trust score is the formula locked in ADR-0034 § 4:

    score = max(0, 100 - 25 * count(FAIL) - 10 * count(WARN))

It's the only aggregate number this module emits. Reproducible from
the verdict shape alone — no ML, no community signal, no vibes.
"""

from __future__ import annotations

from dataclasses import dataclass

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
    """Per ADR-0034 § 4: deterministic, reproducible aggregate.

    Floor at 0; no ceiling beyond 100. Same content → same score.
    """
    fail_count = sum(1 for v in verdicts if v.severity is Severity.FAIL)
    warn_count = sum(1 for v in verdicts if v.severity is Severity.WARN)
    return max(0, 100 - 25 * fail_count - 10 * warn_count)


def trust_band(score: int) -> str:
    """Map a numeric score to one of four named bands.

    The UI renders the band as the headline; the number is auxiliary.
    """
    if score >= 90:
        return "clean"
    if score >= 70:
        return "caution"
    if score >= 40:
        return "suspicious"
    return "high-risk"


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
    """
    flat: list[Verdict] = []
    for fs in files:
        flat.extend(fs.verdicts)
    return tuple(flat)


def build_summary(verdicts: tuple[Verdict, ...]) -> dict[str, object]:
    """Build the `summary` payload sub-tree the verdict UI reads."""
    fail_count = sum(1 for v in verdicts if v.severity is Severity.FAIL)
    warn_count = sum(1 for v in verdicts if v.severity is Severity.WARN)
    info_count = sum(1 for v in verdicts if v.severity is Severity.INFO)
    triggered = fail_count + warn_count
    score = trust_score(verdicts)
    return {
        "trustScore": score,
        "verdictBand": trust_band(score),
        "passed": all(v.passed for v in verdicts),
        "detectorsRun": len(get_all_detectors()),
        "detectorsTriggered": triggered,
        "failCount": fail_count,
        "warnCount": warn_count,
        "infoCount": info_count,
        "highestSeverity": highest_severity(verdicts).value,
    }


def files_payload(files: list[FileScan]) -> list[dict[str, object]]:
    return [_file_scan_to_dict(fs) for fs in files]


def aggregate_verdicts_payload(verdicts: tuple[Verdict, ...]) -> list[dict[str, object]]:
    return [_verdict_to_dict(v) for v in verdicts]
