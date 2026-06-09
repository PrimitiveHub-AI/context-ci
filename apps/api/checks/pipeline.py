"""Pure scan pipeline for `/check` — no HTTP, no request object.

ADR-0034 (async amendment): the scan work — outbound fetch + tarball
extraction + running the Top 10 over every file — moved off the web
request path onto the Procrastinate worker (`checks` queue). This
module is the shared core: it takes a `(mode, raw_input)` and returns
a tagged result dict, with errors returned as DATA rather than raised
as HTTP responses.

    {"ok": True,  "result": {...full /check response shape...}}
    {"ok": False, "error":  {"code": str, "message": str}}

The worker task (`check_tasks.run_check`) calls `execute_check` and
caches the tagged dict for the poll endpoint to read. The web tier
never runs any of this — it only enqueues + reads the cached result.

THE INPUT IS NEVER PERSISTED HERE. This module operates purely on the
string handed to it; the caller is responsible for sourcing and
scrubbing the input (see `check_tasks.run_check`).
"""

from __future__ import annotations

from typing import Any, Literal

from .github_resolver import (
    GithubResolveError,
)
from .github_resolver import (
    parse_coordinate as parse_github_coordinate,
)
from .github_resolver import (
    resolve_and_extract as resolve_github_repo,
)
from .npx_resolver import (
    ExtractedFile,
    NpxResolveError,
    extract_safely,
    fetch_tarball,
    resolve_version,
)
from .npx_resolver import (
    parse_coordinate as parse_npx_coordinate,
)
from .scan import (
    FileScan,
    aggregate_files,
    aggregate_verdicts_payload,
    build_summary_from_files,
    classified_findings_payload,
    files_payload,
    scan_blob,
)
from .url_fetcher import MAX_RESPONSE_BYTES, UrlFetchError, fetch_url

# 1 MiB hard cap on pasted content body — per ADR-0034 § 5. Prevents a
# single request from consuming arbitrary worker memory.
MAX_CONTENT_BYTES = 1 * 1024 * 1024

ScanMode = Literal["content", "url", "npx", "github"]


def _ok(result: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "result": result}


def _err(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": {"code": code, "message": message}}


def execute_check(mode: ScanMode, raw_input: str, request_id: str) -> dict[str, Any]:
    """Run one scan to completion. Pure: no HTTP, no request object.

    Returns a tagged dict — `{"ok": True, "result": {...}}` on success
    or `{"ok": False, "error": {...}}` on a handled policy/resolution
    failure. Unhandled exceptions propagate to the caller (the task),
    which records them as a terminal error so the poll never hangs.
    """
    if mode == "content":
        return _run_content(raw_input, request_id)
    if mode == "url":
        return _run_url(raw_input, request_id)
    if mode == "npx":
        return _run_npx(raw_input, request_id)
    return _run_github(raw_input, request_id)


def _run_content(raw_input: str, request_id: str) -> dict[str, Any]:
    if len(raw_input.encode("utf-8")) > MAX_CONTENT_BYTES:
        return _err(
            "content:too-large",
            f"Pasted content exceeds the {MAX_CONTENT_BYTES // 1024} KiB cap.",
        )
    verdicts = scan_blob(raw_input, slug="paste", semver="0.0.0")
    file_scan = FileScan(
        path="<paste>",
        bytes_count=len(raw_input.encode("utf-8")),
        verdicts=verdicts,
    )
    return _ok(
        {
            "requestId": request_id,
            "mode": "content",
            "target": {
                "kind": "content",
                "displayName": "Pasted content",
                "bytes": file_scan.bytes_count,
            },
            "summary": build_summary_from_files([file_scan]),
            "files": files_payload([file_scan]),
            "verdicts": aggregate_verdicts_payload(verdicts),
            "classifiedFindings": classified_findings_payload([file_scan]),
        }
    )


def _run_url(raw_input: str, request_id: str) -> dict[str, Any]:
    try:
        fetched = fetch_url(raw_input)
    except UrlFetchError as exc:
        return _err(exc.code, exc.message)
    verdicts = scan_blob(fetched.content, slug=fetched.final_url, semver="0.0.0")
    file_scan = FileScan(
        path=fetched.final_url,
        bytes_count=fetched.bytes_count,
        verdicts=verdicts,
    )
    return _ok(
        {
            "requestId": request_id,
            "mode": "url",
            "target": {
                "kind": "url",
                "displayName": fetched.final_url,
                "url": fetched.final_url,
                "bytes": fetched.bytes_count,
                "maxBytes": MAX_RESPONSE_BYTES,
            },
            "summary": build_summary_from_files([file_scan]),
            "files": files_payload([file_scan]),
            "verdicts": aggregate_verdicts_payload(verdicts),
            "classifiedFindings": classified_findings_payload([file_scan]),
        }
    )


def _scan_extraction(
    files_iter: tuple[ExtractedFile, ...], slug_prefix: str, version: str
) -> tuple[list[FileScan], int]:
    """Run the Top 10 over each text file in an extraction.

    Returns (file_scans, skipped_binary_count). Binary files appear in
    the scan list with empty `verdicts` so the user sees what was in
    the archive even if nothing was scored on them.
    """
    file_scans: list[FileScan] = []
    skipped_binary = 0
    for ef in files_iter:
        if ef.content is None:
            skipped_binary += 1
            file_scans.append(FileScan(path=ef.path, bytes_count=ef.bytes_count, verdicts=()))
            continue
        verdicts = scan_blob(
            ef.content,
            slug=f"{slug_prefix}/{ef.path}",
            semver=version,
            file_path=ef.path,
        )
        file_scans.append(FileScan(path=ef.path, bytes_count=ef.bytes_count, verdicts=verdicts))
    return file_scans, skipped_binary


def _run_npx(raw_input: str, request_id: str) -> dict[str, Any]:
    try:
        coordinate = parse_npx_coordinate(raw_input)
        resolved = resolve_version(coordinate)
        tarball_bytes = fetch_tarball(resolved)
        extraction = extract_safely(tarball_bytes)
    except NpxResolveError as exc:
        return _err(exc.code, exc.message)

    file_scans, skipped_binary = _scan_extraction(extraction.files, resolved.name, resolved.version)
    aggregate = aggregate_files(file_scans)
    summary = build_summary_from_files(file_scans)
    summary["filesScanned"] = sum(1 for fs in file_scans if fs.verdicts)
    summary["filesSkippedBinary"] = skipped_binary
    summary["totalUncompressedBytes"] = extraction.total_uncompressed_bytes
    summary["compressedBytes"] = extraction.compressed_bytes

    return _ok(
        {
            "requestId": request_id,
            "mode": "npx",
            "target": {
                "kind": "npm-package",
                "displayName": f"{resolved.name}@{resolved.version}",
                "name": resolved.name,
                "version": resolved.version,
                "registry": "registry.npmjs.org",
                "tarballUrl": resolved.tarball_url,
                "integrity": resolved.integrity,
                "shasum": resolved.shasum,
                "fileCount": len(extraction.files),
                "totalUncompressedBytes": extraction.total_uncompressed_bytes,
                "compressedBytes": extraction.compressed_bytes,
            },
            "summary": summary,
            "files": files_payload(file_scans),
            "verdicts": aggregate_verdicts_payload(aggregate),
            "classifiedFindings": classified_findings_payload(file_scans),
        }
    )


def _run_github(raw_input: str, request_id: str) -> dict[str, Any]:
    try:
        coord = parse_github_coordinate(raw_input)
        resolved, extraction = resolve_github_repo(coord)
    except GithubResolveError as exc:
        return _err(exc.code, exc.message)
    except NpxResolveError as exc:
        # The extraction caps (tarball-too-large, tarball-bomb, etc.)
        # surface as NpxResolveError because extract_safely lives in
        # the npx module. Pass the code through unchanged.
        return _err(exc.code, exc.message)

    file_scans, skipped_binary = _scan_extraction(extraction.files, resolved.name, resolved.version)
    aggregate = aggregate_files(file_scans)
    summary = build_summary_from_files(file_scans)
    summary["filesScanned"] = sum(1 for fs in file_scans if fs.verdicts)
    summary["filesSkippedBinary"] = skipped_binary
    summary["totalUncompressedBytes"] = extraction.total_uncompressed_bytes
    summary["compressedBytes"] = extraction.compressed_bytes

    return _ok(
        {
            "requestId": request_id,
            "mode": "github",
            "target": {
                "kind": "github-repo",
                "displayName": f"{resolved.name}@{resolved.version}",
                "name": resolved.name,
                "version": resolved.version,
                "registry": "github.com",
                "tarballUrl": resolved.tarball_url,
                "integrity": resolved.integrity,
                "shasum": resolved.shasum,
                "fileCount": len(extraction.files),
                "totalUncompressedBytes": extraction.total_uncompressed_bytes,
                "compressedBytes": extraction.compressed_bytes,
            },
            "summary": summary,
            "files": files_payload(file_scans),
            "verdicts": aggregate_verdicts_payload(aggregate),
            "classifiedFindings": classified_findings_payload(file_scans),
        }
    )
