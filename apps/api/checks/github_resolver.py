"""GitHub repo coordinate resolution + tarball fetch for `/check`.

Accepts the shapes that real practitioners paste:

  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo/tree/branch`
  - `https://github.com/owner/repo.git`
  - `git@github.com:owner/repo.git`
  - `claude skill install owner/repo --skill some-name`  (--skill ignored)
  - bare `owner/repo`

Fetches the tarball from `codeload.github.com` using the default branch
heuristic (try `main`, then `master`). Same hard caps as the npx path
(8 MiB compressed / 64 MiB uncompressed / 4000 entries / 15s wall-
clock). The repo is never `git clone`-d or executed — we read the
tarball bytes, the way an AV scanner reads a binary.

This module wraps `extract_safely` from `npx_resolver` (which is
already generic enough to accept any top-level tarball directory).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.request import Request

# SSRF-safe transport (shared, `docs/security/2026-10-23-ssrf-01-handoff.md`).
# `guarded_urlopen` is signature-compatible with `urllib.request.urlopen`, so
# call sites below are unchanged and the `github_resolver.urlopen` mock seam in
# the tests still works. codeload.github.com is host-locked below (primary
# control); this adds the peer-IP pin as defense in depth.
from ._safe_http import SafeHttpError
from ._safe_http import guarded_urlopen as urlopen

from .npx_resolver import (
    ExtractionResult,
    ResolvedPackage,
    extract_safely,
)

CODELOAD = "https://codeload.github.com"
GITHUB_HOSTS = frozenset({"github.com", "www.github.com"})
TARBALL_TIMEOUT_SECONDS = 30.0
DEFAULT_BRANCHES: tuple[str, ...] = ("main", "master")

# Hard caps for the GitHub path. Larger than npm package defaults
# (npx_resolver) because real skill collections (anthropic-cybersecurity-
# skills, agent-skills, etc.) regularly exceed npm-package-sized
# tarballs. Still bounded: an attacker can't make us OOM, but real
# repos fit.
GITHUB_MAX_COMPRESSED_BYTES = 32 * 1024 * 1024  # 32 MiB
GITHUB_MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024  # 256 MiB
GITHUB_MAX_ENTRIES = 20_000


class GithubResolveError(Exception):
    """Raised when a GitHub coordinate can't be parsed or fetched."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class GithubCoordinate:
    """Parsed `(owner, repo, ref)` — `ref` is None when the user didn't pin."""

    owner: str
    repo: str
    ref: str | None


# `owner/repo` — GitHub allows `-`, `_`, `.` in repo names; owners are
# alphanumeric + `-`. Bare-coordinate shape, also reused inside larger
# patterns below.
_OWNER = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})"
_REPO = r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}"

# Unanchored — find a github URL ANYWHERE in the input. This is what
# lets us handle `npx skills add https://github.com/...`, `npx
# @anthropic/skills install https://github.com/...`, or any other
# wrapper command we don't explicitly know about. The captured ref (if
# present) supports `/tree/<branch>` and `/blob/<branch>/...` URL
# shapes.
_URL_RE = re.compile(
    rf"https?://(?:www\.)?github\.com/({_OWNER})/({_REPO})"
    rf"(?:\.git)?"
    rf"(?:/tree/([^/\s?#]+))?"
    rf"(?:/blob/([^/\s?#]+)(?:/[^\s?#]*)?)?",
)

# Unanchored — find a `git@github.com:owner/repo` SSH-style coordinate.
_SSH_RE = re.compile(rf"git@github\.com:({_OWNER})/({_REPO})(?:\.git)?")

# `claude skill install owner/repo`. Captured here so we still
# recognize it when no URL is present.
_CLAUDE_SKILL_RE = re.compile(
    rf"claude\s+skill\s+install\s+({_OWNER})/({_REPO})",
    re.IGNORECASE,
)

# Anchored fallback for the bare `owner/repo` shape — used ONLY when
# the WHOLE input is exactly `owner/repo`, since `owner/repo` as a
# substring of larger text would false-positive on prose.
_BARE_RE = re.compile(rf"^\s*({_OWNER})/({_REPO})\s*$")


def parse_coordinate(raw: str) -> GithubCoordinate:
    """Find a GitHub coordinate anywhere in the input.

    Order of attempts (first match wins):
      1. Full https URL — handles `npx skills add <url>`, `npx
         @anthropic/skills install <url>`, plain `<url>`, `<url>
         --skill foo`, etc.
      2. SSH-style `git@github.com:owner/repo` anywhere.
      3. `claude skill install owner/repo` anywhere.
      4. Bare `owner/repo` — only when the WHOLE input is exactly that
         shape (prose-safe).
    """
    if not raw or not raw.strip():
        raise GithubResolveError("github:empty", "Coordinate cannot be empty.")
    if len(raw) > 1024:
        raise GithubResolveError(
            "github:too-long",
            "Coordinate is suspiciously long; expected a github.com URL or owner/repo.",
        )

    url_match = _URL_RE.search(raw)
    if url_match:
        owner = url_match.group(1)
        repo = url_match.group(2)
        if repo.endswith(".git"):
            repo = repo[:-4]
        # /tree/<ref> takes precedence over /blob/<ref>; both are
        # captured but tree-form is the canonical user intent.
        ref = url_match.group(3) or url_match.group(4) or None
        return GithubCoordinate(owner=owner, repo=repo, ref=ref)

    ssh_match = _SSH_RE.search(raw)
    if ssh_match:
        owner = ssh_match.group(1)
        repo = ssh_match.group(2)
        if repo.endswith(".git"):
            repo = repo[:-4]
        return GithubCoordinate(owner=owner, repo=repo, ref=None)

    claude_match = _CLAUDE_SKILL_RE.search(raw)
    if claude_match:
        owner = claude_match.group(1)
        repo = claude_match.group(2)
        return GithubCoordinate(owner=owner, repo=repo, ref=None)

    bare_match = _BARE_RE.match(raw)
    if bare_match:
        owner = bare_match.group(1)
        repo = bare_match.group(2)
        return GithubCoordinate(owner=owner, repo=repo, ref=None)

    raise GithubResolveError(
        "github:unparseable",
        (
            "Could not find a GitHub coordinate in the input. Expected something "
            "like 'https://github.com/owner/repo' or 'owner/repo'."
        ),
    )


def _http_get_bytes(url: str) -> tuple[bytes, int]:
    """Strict GET against codeload.github.com only. Returns (body, status)."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise GithubResolveError(
            "github:non-https",
            f"Refusing to fetch non-HTTPS URL '{url}'.",
        )
    if parsed.hostname not in {"codeload.github.com"}:
        raise GithubResolveError(
            "github:host-not-allowed",
            f"Only codeload.github.com is currently supported; got '{parsed.hostname}'.",
        )

    req = Request(  # noqa: S310 — scheme + host validated
        url,
        headers={
            "User-Agent": "PrimitiveHub-CheckBot/0.1 (+https://primitivehub.ai/check)",
            "Accept": "application/x-gzip, application/octet-stream",
        },
    )
    try:
        response = urlopen(req, timeout=TARBALL_TIMEOUT_SECONDS)  # noqa: S310
    except SafeHttpError as exc:  # SSRF policy refusal (blocked peer / redirect)
        raise GithubResolveError("github:internal-address", exc.message) from exc
    except Exception as exc:  # urllib raises HTTPError on 4xx/5xx
        status = getattr(exc, "code", None)
        if isinstance(status, int):
            return b"", status
        raise GithubResolveError(
            "github:fetch-failed",
            f"Could not fetch '{url}': {exc.__class__.__name__}: {exc}",
        ) from exc

    body_raw = response.read(GITHUB_MAX_COMPRESSED_BYTES + 1)
    body = bytes(body_raw)
    if len(body) > GITHUB_MAX_COMPRESSED_BYTES:
        raise GithubResolveError(
            "github:body-too-large",
            (
                f"Repo tarball exceeds {GITHUB_MAX_COMPRESSED_BYTES // (1024 * 1024)} MiB "
                "compressed cap. Try a specific branch via `/tree/<branch>` "
                "or paste a smaller subset."
            ),
        )
    return body, getattr(response, "status", 200)


def fetch_repo_tarball(coord: GithubCoordinate) -> tuple[bytes, str]:
    """Resolve the right tarball and return (bytes, branch-used).

    Strategy when the user didn't pin a ref:
      1. Try `main` — overwhelming default on modern repos.
      2. Try `master` — covers older repos.
      3. Give up with a named error.

    When the user did pin a ref (`/tree/<ref>` in the URL), try only
    that ref. Anything else is misleading.
    """
    candidates: tuple[str, ...] = (coord.ref,) if coord.ref else DEFAULT_BRANCHES
    tried: list[str] = []
    last_status: int | None = None

    for branch in candidates:
        url = f"{CODELOAD}/{coord.owner}/{coord.repo}/tar.gz/refs/heads/{branch}"
        body, status = _http_get_bytes(url)
        tried.append(branch)
        if status == 200 and body:
            return body, branch
        if status == 404:
            last_status = 404
            continue
        # Try one more thing for non-branch refs (tag): the user may
        # have pinned a tag rather than a branch — codeload also serves
        # `tar.gz/refs/tags/<tag>`.
        if status == 404 and coord.ref:
            url_tag = f"{CODELOAD}/{coord.owner}/{coord.repo}/tar.gz/refs/tags/{coord.ref}"
            tag_body, tag_status = _http_get_bytes(url_tag)
            if tag_status == 200 and tag_body:
                return tag_body, coord.ref
        # Anything else (5xx, weird codes) is fatal.
        raise GithubResolveError(
            "github:fetch-failed",
            f"GitHub returned HTTP {status} for {coord.owner}/{coord.repo} ({branch}).",
        )

    if last_status == 404:
        raise GithubResolveError(
            "github:ref-not-found",
            (
                f"Could not find a tarball for {coord.owner}/{coord.repo} "
                f"on any of {', '.join(tried)}. Repo may be private, empty, or "
                "the default branch isn't one of those."
            ),
        )
    raise GithubResolveError(
        "github:fetch-failed",
        f"Could not fetch tarball for {coord.owner}/{coord.repo}.",
    )


# RC5-E: codeload roots every tarball entry under `<repo>-<40-hex-sha>/`,
# where the sha is the resolved commit — even when the tarball was fetched
# by branch or tag name. Parse it so the verdict is pinned to an immutable
# commit, not just the mutable branch. Require the full 40-hex shape so a
# repo name that merely ends in `-<shorthex>` can't be mistaken for a SHA.
_TOPDIR_COMMIT_SHA_RE = re.compile(r"-([0-9a-f]{40})$")


def _commit_sha_from_top_dir(top_dir: str | None) -> str | None:
    """Extract the resolved commit SHA from a codeload top-dir name.

    Returns None when the name isn't the expected `<repo>-<40-hex>` shape
    (e.g. synthetic test fixtures) — we never guess a partial SHA.
    """
    if not top_dir:
        return None
    match = _TOPDIR_COMMIT_SHA_RE.search(top_dir)
    return match.group(1) if match else None


def resolve_and_extract(coord: GithubCoordinate) -> tuple[ResolvedPackage, ExtractionResult]:
    """One-call wrapper: fetch + extract. Returns (target metadata, ExtractionResult).

    The first element re-uses `ResolvedPackage` so the response shape
    can converge with the npx path — the verdict UI doesn't need to
    branch on `npm-package` vs `github-repo` for the metadata table.
    """
    tarball, branch_used = fetch_repo_tarball(coord)
    extraction = extract_safely(
        tarball,
        max_compressed=GITHUB_MAX_COMPRESSED_BYTES,
        max_uncompressed=GITHUB_MAX_UNCOMPRESSED_BYTES,
        max_entries=GITHUB_MAX_ENTRIES,
        error_prefix="github",
    )
    target = ResolvedPackage(
        name=f"{coord.owner}/{coord.repo}",
        version=branch_used,
        tarball_url=f"{CODELOAD}/{coord.owner}/{coord.repo}/tar.gz/refs/heads/{branch_used}",
        integrity=None,
        shasum=None,
        size_hint=extraction.total_uncompressed_bytes,
        commit_sha=_commit_sha_from_top_dir(extraction.top_dir),
    )
    return target, extraction


def looks_like_github(raw: str) -> bool:
    """Cheap sniffer for the input-mode auto-router.

    Returns True for anything that COULD be a GitHub coordinate
    ANYWHERE in the input. This is what lets `npx skills add <url>`,
    `npx @anthropic/skills install <url>`, and similar wrapper
    commands route correctly even though they have an `npx` prefix.
    """
    if not raw or not raw.strip():
        return False
    stripped = raw.strip()
    # GitHub URL anywhere in the input.
    if _URL_RE.search(stripped):
        return True
    # SSH-style coord anywhere.
    if _SSH_RE.search(stripped):
        return True
    # `claude skill install owner/repo` anywhere.
    if _CLAUDE_SKILL_RE.search(stripped):
        return True
    # Bare `owner/repo` — only when the whole input is that shape.
    return bool(_BARE_RE.match(stripped))
