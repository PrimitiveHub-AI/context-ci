"""Public `/check` paste-and-verdict endpoint — ADR-0034.

POST /api/v1/check
Request:  { mode: "content"|"url"|"npx", input: str }
Response: { requestId, mode, target, summary, files, verdicts } | { error }

This endpoint is ANONYMOUS by design. The OIDC middleware attaches
`request.oidc_subject` if a token is present but the endpoint
ignores it. Abuse is bounded by per-IP rate limits (rate_limit.py).
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

# These imports look type-only but Ninja inspects the runtime annotations to
# build the Pydantic param model — moving them into a TYPE_CHECKING block
# triggers `QueryParams is not fully defined` at request time.
from django.http import HttpRequest, HttpResponse, JsonResponse
from ninja import Router, Schema
from pydantic import Field

from .github_resolver import (
    GithubResolveError,
    looks_like_github,
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
from .rate_limit import (
    LONG_WINDOW_LIMIT,
    SHORT_WINDOW_LIMIT,
    check_rate_limit,
    client_ip,
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

router = Router(tags=["checks"])

# 1 MiB hard cap on pasted content body — per ADR-0034 § 5. Prevents a
# single request from consuming arbitrary worker memory before we
# even see the rate limiter.
MAX_CONTENT_BYTES = 1 * 1024 * 1024


CheckMode = Literal["content", "url", "npx", "github", "auto"]


def _sniff_mode(raw: str) -> Literal["content", "url", "npx", "github"]:
    """Decide which pipeline to run for a `mode=auto` request.

    The order matters: GitHub coordinates are detected BEFORE generic
    URLs because `https://github.com/owner/repo` is useful as a
    tarball, not as a fetched HTML page. npm coordinates are matched
    by command-prefix or scoped-name heuristics.
    """
    stripped = raw.strip()
    lowered = stripped.lower()
    # GitHub: claude-skill-install, github.com URL, git@github.com, bare owner/repo.
    if looks_like_github(stripped):
        return "github"
    # npm coordinate by command prefix or by `npx ` / `pnpm dlx ` etc.
    if lowered.startswith(
        (
            "npx ",
            "pnpx ",
            "bunx ",
            "yarn dlx ",
            "pnpm dlx ",
            "npm install ",
            "npm i ",
            "npm add ",
            "pnpm install ",
            "pnpm add ",
            "yarn add ",
            "bun add ",
        )
    ):
        return "npx"
    # Bare URL → fetch.
    if lowered.startswith(("http://", "https://")):
        return "url"
    # Scoped-package shape like `@scope/name@1.0.0` (no command prefix).
    if stripped.startswith("@") and "/" in stripped and " " not in stripped:
        return "npx"
    # Single-token without spaces and with no whitespace-separated text:
    # could be a bare package name. Conservative — only treat as npx
    # when there's no newline.
    if "\n" not in stripped and " " not in stripped and len(stripped) <= 214 and "@" in stripped:
        # `name@version` shape, no slash → bare npm coord.
        return "npx"
    # Default: treat as raw content.
    return "content"


class CheckRequest(Schema):
    """Request payload — mode dispatches to one of three pipelines."""

    mode: CheckMode = Field(
        ...,
        description="What kind of input is being submitted.",
    )
    input: str = Field(
        ...,
        description="The pasted content / URL / npx coordinate.",
        min_length=1,
        max_length=MAX_CONTENT_BYTES,
    )


def _error(
    response: HttpResponse,
    code: str,
    message: str,
    status: int = 400,
    *,
    request_id: str | None = None,
) -> JsonResponse:
    """Return a `JsonResponse` with the named error code.

    Returning a Django `HttpResponse` from a Ninja view bypasses the
    response-schema dict — useful when we want multiple status codes
    without declaring per-code Schema classes. Rate-limit headers
    already attached to `response` are copied onto the JsonResponse.
    """
    body = {
        "error": {"code": code, "message": message},
        "requestId": request_id or str(uuid.uuid4()),
    }
    out = JsonResponse(body, status=status)
    for header in (
        "X-RateLimit-Short-Limit",
        "X-RateLimit-Short-Remaining",
        "X-RateLimit-Long-Limit",
        "X-RateLimit-Long-Remaining",
        "Retry-After",
    ):
        value = response.get(header)
        if value is not None:
            out[header] = value
    return out


@router.post("/check", tags=["checks"])
def check(
    request: HttpRequest,
    response: HttpResponse,
    payload: CheckRequest,
) -> dict[str, Any] | JsonResponse:
    """Paste content / URL / npx / GitHub coordinate; get a Top 10 verdict.

    Anonymous. Rate-limited per-IP (30/5min, 500/24h). Never
    persists the input bytes — only verdict metadata is logged.

    `mode=auto` is the default for the public UI: the input is sniffed
    and dispatched to the right pipeline (`github` for repo URLs and
    `claude skill install` commands; `npx` for npm coordinates; `url`
    for bare `https://` URLs; `content` for everything else).
    """
    request_id = str(uuid.uuid4())

    # Rate limit first. Increment regardless of outcome so we count
    # malformed-payload spam against the bucket.
    ip = client_ip(request)
    decision = check_rate_limit(ip)
    response["X-RateLimit-Short-Limit"] = str(SHORT_WINDOW_LIMIT)
    response["X-RateLimit-Short-Remaining"] = str(decision.short_remaining)
    response["X-RateLimit-Long-Limit"] = str(LONG_WINDOW_LIMIT)
    response["X-RateLimit-Long-Remaining"] = str(decision.long_remaining)
    if not decision.allowed:
        response["Retry-After"] = str(decision.retry_after_seconds)
        bucket = decision.bucket
        msg = (
            f"Rate limit hit ({bucket}-window). Retry in "
            f"{decision.retry_after_seconds // 60 or 1} minute(s)."
        )
        return _error(response, "rate-limit", msg, status=429, request_id=request_id)

    raw_input = payload.input
    mode: Literal["content", "url", "npx", "github"] = (
        _sniff_mode(raw_input) if payload.mode == "auto" else payload.mode
    )

    if mode == "content":
        return _run_content(raw_input, request_id, response)
    if mode == "url":
        return _run_url(raw_input, request_id, response)
    if mode == "npx":
        return _run_npx(raw_input, request_id, response)
    return _run_github(raw_input, request_id, response)


def _run_content(
    raw_input: str, request_id: str, response: HttpResponse
) -> dict[str, Any] | JsonResponse:
    if len(raw_input.encode("utf-8")) > MAX_CONTENT_BYTES:
        return _error(
            response,
            "content:too-large",
            f"Pasted content exceeds the {MAX_CONTENT_BYTES // 1024} KiB cap.",
            status=413,
            request_id=request_id,
        )
    verdicts = scan_blob(raw_input, slug="paste", semver="0.0.0")
    file_scan = FileScan(
        path="<paste>",
        bytes_count=len(raw_input.encode("utf-8")),
        verdicts=verdicts,
    )
    return {
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


def _run_url(
    raw_input: str, request_id: str, response: HttpResponse
) -> dict[str, Any] | JsonResponse:
    try:
        fetched = fetch_url(raw_input)
    except UrlFetchError as exc:
        return _error(response, exc.code, exc.message, status=400, request_id=request_id)
    verdicts = scan_blob(fetched.content, slug=fetched.final_url, semver="0.0.0")
    file_scan = FileScan(
        path=fetched.final_url,
        bytes_count=fetched.bytes_count,
        verdicts=verdicts,
    )
    return {
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
            file_scans.append(
                FileScan(path=ef.path, bytes_count=ef.bytes_count, verdicts=())
            )
            continue
        verdicts = scan_blob(
            ef.content,
            slug=f"{slug_prefix}/{ef.path}",
            semver=version,
            file_path=ef.path,
        )
        file_scans.append(
            FileScan(path=ef.path, bytes_count=ef.bytes_count, verdicts=verdicts)
        )
    return file_scans, skipped_binary


def _run_npx(
    raw_input: str, request_id: str, response: HttpResponse
) -> dict[str, Any] | JsonResponse:
    try:
        coordinate = parse_npx_coordinate(raw_input)
        resolved = resolve_version(coordinate)
        tarball_bytes = fetch_tarball(resolved)
        extraction = extract_safely(tarball_bytes)
    except NpxResolveError as exc:
        return _error(response, exc.code, exc.message, status=400, request_id=request_id)

    file_scans, skipped_binary = _scan_extraction(
        extraction.files, resolved.name, resolved.version
    )
    aggregate = aggregate_files(file_scans)
    summary = build_summary_from_files(file_scans)
    summary["filesScanned"] = sum(1 for fs in file_scans if fs.verdicts)
    summary["filesSkippedBinary"] = skipped_binary
    summary["totalUncompressedBytes"] = extraction.total_uncompressed_bytes
    summary["compressedBytes"] = extraction.compressed_bytes

    return {
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


def _run_github(
    raw_input: str, request_id: str, response: HttpResponse
) -> dict[str, Any] | JsonResponse:
    try:
        coord = parse_github_coordinate(raw_input)
        resolved, extraction = resolve_github_repo(coord)
    except GithubResolveError as exc:
        return _error(response, exc.code, exc.message, status=400, request_id=request_id)
    except NpxResolveError as exc:
        # The extraction caps (tarball-too-large, tarball-bomb, etc.)
        # surface as NpxResolveError because extract_safely lives in
        # the npx module. Pass the code through unchanged — the
        # prefix tells the user it was a tarball-handling refusal.
        return _error(response, exc.code, exc.message, status=400, request_id=request_id)

    file_scans, skipped_binary = _scan_extraction(
        extraction.files, resolved.name, resolved.version
    )
    aggregate = aggregate_files(file_scans)
    summary = build_summary_from_files(file_scans)
    summary["filesScanned"] = sum(1 for fs in file_scans if fs.verdicts)
    summary["filesSkippedBinary"] = skipped_binary
    summary["totalUncompressedBytes"] = extraction.total_uncompressed_bytes
    summary["compressedBytes"] = extraction.compressed_bytes

    return {
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
