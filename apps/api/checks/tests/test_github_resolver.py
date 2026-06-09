"""Tests for the GitHub resolver + `mode=auto` dispatch + `mode=github` endpoint.

We do NOT hit github.com or codeload.github.com from tests. The
network entry point (`urlopen` inside `github_resolver`) is mocked.
"""

from __future__ import annotations

import gzip
import io
import tarfile
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from checks import github_resolver
from checks.api import _sniff_mode
from checks.github_resolver import (
    GithubCoordinate,
    GithubResolveError,
    looks_like_github,
    parse_coordinate,
)

# Shared async-roundtrip helper (POST 202 → poll). `run_inline` (conftest)
# makes the scan run synchronously so the poll is terminal.
from checks.tests.test_check_api import _post_and_poll

# ---------------------------------------------------------------------------
# parse_coordinate — shape acceptance
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected_owner", "expected_repo", "expected_ref"),
    [
        (
            "https://github.com/tristanmanchester/agent-skills",
            "tristanmanchester",
            "agent-skills",
            None,
        ),
        ("https://github.com/owner/repo", "owner", "repo", None),
        ("https://github.com/owner/repo.git", "owner", "repo", None),
        ("https://github.com/owner/repo/tree/develop", "owner", "repo", "develop"),
        ("https://github.com/owner/repo/blob/main/SKILL.md", "owner", "repo", "main"),
        # `npx skills add <url>` — the actual Anthropic skills CLI command
        # users paste from tutorials. URL is anywhere in the input.
        (
            "npx skills add https://github.com/mukul975/anthropic-cybersecurity-skills",
            "mukul975",
            "anthropic-cybersecurity-skills",
            None,
        ),
        # `npx skills add <url> --skill <name>` — trailing flags ignored.
        (
            "npx skills add https://github.com/owner/repo --skill some-skill",
            "owner",
            "repo",
            None,
        ),
        # `npx @anthropic/skills install <url>` — also lands.
        (
            "npx @anthropic/skills install https://github.com/owner/repo",
            "owner",
            "repo",
            None,
        ),
        # A github URL embedded in a longer line still gets extracted.
        (
            "Check this out: https://github.com/owner/repo/tree/dev — careful",
            "owner",
            "repo",
            "dev",
        ),
        ("http://github.com/owner/repo", "owner", "repo", None),
        ("https://www.github.com/owner/repo", "owner", "repo", None),
        ("git@github.com:owner/repo.git", "owner", "repo", None),
        ("claude skill install owner/repo", "owner", "repo", None),
        ("claude skill install owner/repo --skill convex-nextjs", "owner", "repo", None),
        (
            "https://github.com/tristanmanchester/agent-skills --skill convex-nextjs",
            "tristanmanchester",
            "agent-skills",
            None,
        ),
        ("owner/repo", "owner", "repo", None),
        ("My-Org/some.repo-name", "My-Org", "some.repo-name", None),
    ],
)
def test_parse_coordinate_accepts_known_shapes(
    raw: str,
    expected_owner: str,
    expected_repo: str,
    expected_ref: str | None,
) -> None:
    coord = parse_coordinate(raw)
    assert coord.owner == expected_owner
    assert coord.repo == expected_repo
    assert coord.ref == expected_ref


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "https://example.com/owner/repo",  # not GitHub
        "not a coordinate at all",
        "owner",  # missing repo
        "/owner/repo",
        "owner//repo",
    ],
)
def test_parse_coordinate_rejects_garbage(raw: str) -> None:
    with pytest.raises(GithubResolveError):
        parse_coordinate(raw)


def test_parse_coordinate_returns_dataclass() -> None:
    coord = parse_coordinate("owner/repo")
    assert isinstance(coord, GithubCoordinate)


# ---------------------------------------------------------------------------
# looks_like_github — sniffer used by mode=auto
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "https://github.com/owner/repo",
        "https://github.com/owner/repo/tree/main",
        "git@github.com:owner/repo.git",
        "claude skill install owner/repo",
        "owner/repo",
        "https://github.com/owner/repo --skill foo",
        # Wrapper-command shapes — github URL is inside the command.
        "npx skills add https://github.com/mukul975/anthropic-cybersecurity-skills",
        "npx @anthropic/skills install https://github.com/owner/repo",
        "pnpm dlx skills install https://github.com/owner/repo --skill x",
        "Check this out: https://github.com/owner/repo — pretty cool",
    ],
)
def test_looks_like_github_true(raw: str) -> None:
    assert looks_like_github(raw) is True


@pytest.mark.parametrize(
    "raw",
    [
        "npx @scope/name@1.2.3",
        "https://raw.githubusercontent.com/owner/repo/main/SKILL.md",
        "# Hello\nA markdown file.\n",
        "",
        "https://example.com/owner/repo",
    ],
)
def test_looks_like_github_false(raw: str) -> None:
    assert looks_like_github(raw) is False


# ---------------------------------------------------------------------------
# _sniff_mode — auto-dispatch
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://github.com/owner/repo", "github"),
        ("owner/repo", "github"),
        ("claude skill install owner/repo --skill foo", "github"),
        ("https://github.com/tristanmanchester/agent-skills --skill convex-nextjs", "github"),
        # The exact failing shapes from real user pastes:
        ("npx skills add https://github.com/mukul975/anthropic-cybersecurity-skills", "github"),
        (
            "npx skills add https://github.com/mukul975/anthropic-cybersecurity-skills --skill testing-for-sensitive-data-exposure",
            "github",
        ),
        ("npx @anthropic/skills install https://github.com/owner/repo", "github"),
        # Plain npm coordinates still route to npx.
        ("npx @scope/name@1.2.3", "npx"),
        ("npm install some-pkg@1.0.0", "npx"),
        ("pnpm dlx some-pkg@1.0.0", "npx"),
        ("@scope/name@1.2.3", "npx"),
        # URLs and raw content.
        ("https://raw.githubusercontent.com/owner/repo/main/SKILL.md", "url"),
        ("https://example.com/foo.md", "url"),
        ("# Skill\nA markdown file.\n", "content"),
        ("Just some prose.", "content"),
    ],
)
def test_sniff_mode_routes_correctly(raw: str, expected: str) -> None:
    assert _sniff_mode(raw) == expected


# ---------------------------------------------------------------------------
# Endpoint integration for `mode=auto` + `mode=github`
# ---------------------------------------------------------------------------


def _make_repo_tarball(files: dict[str, bytes], *, top: str = "agent-skills-abc123") -> bytes:
    """Build a GitHub-style tarball: top-level directory is `<repo>-<sha>`."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w") as tf:
        for path, contents in files.items():
            info = tarfile.TarInfo(name=f"{top}/{path}")
            info.size = len(contents)
            info.mtime = 0
            info.mode = 0o644
            info.type = tarfile.REGTYPE
            tf.addfile(info, io.BytesIO(contents))
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode="wb", mtime=0) as gz:
        gz.write(raw.getvalue())
    return compressed.getvalue()


def _fake_response(body: bytes, *, status: int = 200) -> MagicMock:
    mock = MagicMock()
    mock.status = status
    mock.headers = {}
    mock.read = MagicMock(return_value=body)
    return mock


@pytest.mark.django_db
def test_github_endpoint_clean_repo(client: Any, run_inline: None) -> None:
    """End-to-end github mode: fetch tarball, extract, scan files."""
    cache.clear()
    files = {
        "README.md": b"# agent-skills\n\nA harmless example.\n",
        "skills/convex-nextjs/SKILL.md": b"# Convex Next.js skill\n\nFriendly.\n",
        "package.json": b'{"name":"agent-skills"}\n',
    }
    tarball = _make_repo_tarball(files)

    with patch.object(github_resolver, "urlopen", return_value=_fake_response(tarball)):
        record = _post_and_poll(
            client,
            {
                "mode": "auto",
                "input": "https://github.com/tristanmanchester/agent-skills --skill convex-nextjs",
            },
        )

    assert record["status"] == "done"
    body = record["result"]
    assert body["mode"] == "github"
    assert body["target"]["kind"] == "github-repo"
    assert body["target"]["name"] == "tristanmanchester/agent-skills"
    assert body["target"]["fileCount"] == 3
    assert body["summary"]["filesScanned"] == 3
    assert body["summary"]["verdictBand"] == "clean"
    assert body["summary"]["trustScore"] == 100


@pytest.mark.django_db
def test_github_endpoint_explicit_mode(client: Any, run_inline: None) -> None:
    """`mode=github` works directly without auto-sniffing."""
    cache.clear()
    files = {"README.md": b"# clean\n"}
    tarball = _make_repo_tarball(files)
    with patch.object(github_resolver, "urlopen", return_value=_fake_response(tarball)):
        record = _post_and_poll(client, {"mode": "github", "input": "owner/repo"})
    assert record["status"] == "done"
    body = record["result"]
    assert body["mode"] == "github"
    assert body["target"]["name"] == "owner/repo"


@pytest.mark.django_db
def test_github_endpoint_404_on_both_default_branches(client: Any, run_inline: None) -> None:
    """Both `main` and `master` 404 → named error surfaced in the poll record."""
    cache.clear()
    with patch.object(github_resolver, "urlopen", return_value=_fake_response(b"", status=404)):
        record = _post_and_poll(client, {"mode": "github", "input": "owner/empty"})
    # The github resolver maps both-branch 404 to a github:* error code,
    # which the worker stores as a terminal error in the poll record.
    assert record["status"] == "error"
    assert record["error"]["code"].startswith("github:")


@pytest.mark.django_db
def test_auto_mode_dispatches_to_content(client: Any, run_inline: None) -> None:
    """mode=auto routes raw markdown to `content`."""
    cache.clear()
    record = _post_and_poll(
        client, {"mode": "auto", "input": "# Hello\n\nA harmless markdown file.\n"}
    )
    assert record["status"] == "done"
    body = record["result"]
    assert body["mode"] == "content"
    assert body["summary"]["verdictBand"] == "clean"


@pytest.mark.django_db
def test_auto_mode_dispatches_to_url(client: Any, run_inline: None) -> None:
    """mode=auto routes a non-github https URL to `url` mode."""
    cache.clear()
    from checks import url_fetcher

    body_bytes = b"# Safe markdown from a raw URL.\n"
    fake = MagicMock()
    fake.status = 200
    fake.headers = {}
    fake.read = MagicMock(return_value=body_bytes)
    with patch.object(url_fetcher, "urlopen", return_value=fake):
        record = _post_and_poll(
            client,
            {"mode": "auto", "input": "https://raw.githubusercontent.com/x/y/main/SKILL.md"},
        )
    assert record["status"] == "done"
    assert record["result"]["mode"] == "url"
