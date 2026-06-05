"""npx coordinate resolution + safe tarball extraction.

Implements the contract in ADR-0034 § 2:

  Parse `npx @scope/name@spec` (or `npm install …` / `pnpm dlx …` /
  bare `name@spec`).
  → resolve `spec` against `registry.npmjs.org/<name>` metadata
  → HTTPS-GET the tarball `dist.tarball`
  → verify `dist.shasum` against the bytes
  → decompress + untar with hard caps (size, count, time)
  → return a list of (path, bytes, content) tuples

  THE PACKAGE IS NEVER EXECUTED. No `postinstall`, no `require()`,
  no shell exec. We treat the tarball exactly like AV scanners treat
  a binary: read the bytes, scan the bytes, drop the bytes.

The caller (the `/check` endpoint) wraps each scannable file in a
`DetectorContext` and runs the Top 10 over it.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import re
import tarfile
import time
from dataclasses import dataclass
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

# Hard caps — ADR-0034 § 2. These are the npm-path defaults; the GitHub
# path (github_resolver.py) overrides the compressed + uncompressed caps
# at call time because real-world skill collections regularly exceed
# the npm-package-sized defaults.
MAX_COMPRESSED_BYTES = 8 * 1024 * 1024  # 8 MiB — npm package default
MAX_UNCOMPRESSED_BYTES = 128 * 1024 * 1024  # 128 MiB
MAX_ENTRY_COUNT = 4000
MAX_PER_ENTRY_BYTES = 8 * 1024 * 1024  # 8 MiB
EXTRACTION_TIMEOUT_SECONDS = 30.0
METADATA_TIMEOUT_SECONDS = 8.0
TARBALL_TIMEOUT_SECONDS = 12.0

NPM_REGISTRY = "https://registry.npmjs.org"

# Files we scan. Everything else (binaries, lockfiles, generated
# bundles) is listed in the response with `verdicts: []` so the user
# can see WHAT was in the package — they just don't get scored on
# stuff our text detectors can't read.
_TEXT_EXTENSIONS = frozenset(
    {
        ".md",
        ".markdown",
        ".mdx",
        ".txt",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".cjs",
        ".js",
        ".mjs",
        ".ts",
        ".tsx",
        ".jsx",
        ".py",
        ".sh",
        ".bash",
        ".zsh",
        ".env",
        ".cursorrules",
        ".prompty",
    }
)

# Files commonly identified by name with no extension. AI-context-
# adjacent. AGENTS.md / CLAUDE.md style.
_TEXT_BASENAMES = frozenset(
    {
        "agents.md",
        "claude.md",
        "cursor.md",
        "codex.md",
        ".cursorrules",
        "skill.md",
        "prompt.md",
        "system.md",
        "readme",
        "license",
        "package.json",
        "mcp.json",
    }
)


# `npx pkg`, `npx pkg@version`, `npx @scope/pkg@version`,
# `npm install pkg@version`, `pnpm dlx pkg@version`, bare `pkg@version`.
_COORD_PATTERN = re.compile(
    r"""
    ^
    \s*
    (?:                                     # optional command prefix
        (?:npx|pnpx|bunx|deno\s+run|yarn\s+dlx|pnpm\s+dlx)\s+ |
        (?:npm|pnpm|yarn|bun)\s+(?:install|i|add|dlx)\s+
    )?
    (?:                                     # leading flags ignored
        (?:--?[a-zA-Z0-9-]+\s+)*
    )
    (                                       # group 1 — package name
        (?:@[a-z0-9][a-z0-9._~-]*/)?         # optional scope
        [a-z0-9][a-z0-9._~-]*                 # name
    )
    (?:@([^\s]+))?                          # group 2 — optional version spec
    \s*
    $
    """,
    re.IGNORECASE | re.VERBOSE,
)


class NpxResolveError(Exception):
    """Raised when parsing, resolution, or extraction violates the contract."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class NpxCoordinate:
    """Parsed coordinate. `version_spec` is None for unpinned references."""

    name: str  # may include "@scope/" prefix
    version_spec: str | None


@dataclass(frozen=True, slots=True)
class ResolvedPackage:
    name: str
    version: str
    tarball_url: str
    integrity: str | None  # SRI string e.g. "sha512-..."
    shasum: str | None  # legacy SHA-1 hex
    size_hint: int | None


@dataclass(frozen=True, slots=True)
class ExtractedFile:
    """One in-memory file from the tarball.

    `content` is None for non-text files; `bytes_count` is always the
    raw size on disk (useful for the response payload).
    """

    path: str
    bytes_count: int
    content: str | None


@dataclass(frozen=True, slots=True)
class ExtractionResult:
    files: tuple[ExtractedFile, ...]
    total_uncompressed_bytes: int
    compressed_bytes: int


def parse_coordinate(raw: str) -> NpxCoordinate:
    """Parse an `npx` / `npm install` / bare-coordinate string.

    Accepts:
      - `npx @scope/name@1.2.3`
      - `npx some-package`
      - `npm install @scope/name`
      - `pnpm dlx some-package@latest`
      - bare `name@version`
    """
    if not raw or not raw.strip():
        raise NpxResolveError(
            "npx:empty",
            "Coordinate cannot be empty.",
        )
    if len(raw) > 512:
        raise NpxResolveError(
            "npx:too-long",
            "Coordinate is suspiciously long; expected something like 'npx @scope/name@1.2.3'.",
        )

    match = _COORD_PATTERN.match(raw)
    if not match:
        raise NpxResolveError(
            "npx:unparseable",
            "Could not parse coordinate. Expected something like 'npx @scope/name@1.2.3'.",
        )

    name = match.group(1)
    version_spec = match.group(2)
    if name.lower() in {"-y", "--yes", "-p", "--package"}:
        raise NpxResolveError(
            "npx:flag-only",
            "Coordinate appears to be a flag, not a package name.",
        )
    return NpxCoordinate(name=name, version_spec=version_spec)


def _http_get_bytes(url: str, *, timeout: float, accept: str) -> bytes:
    """Strict HTTPS-only GET with a size cap and named errors."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise NpxResolveError(
            "npx:non-https",
            f"Refusing to fetch non-HTTPS URL '{url}'.",
        )
    # Lock the registry host. v1 contract; ADR-0034 § 2.
    if parsed.hostname not in {"registry.npmjs.org"}:
        raise NpxResolveError(
            "npx:host-not-allowed",
            f"Only registry.npmjs.org is currently supported; got '{parsed.hostname}'.",
        )

    req = Request(  # noqa: S310 — scheme + host validated above
        url,
        headers={
            "User-Agent": "PrimitiveHub-CheckBot/0.1 (+https://primitivehub.ai/check)",
            "Accept": accept,
        },
    )
    try:
        response = urlopen(req, timeout=timeout)  # noqa: S310
    except Exception as exc:
        raise NpxResolveError(
            "npx:fetch-failed",
            f"Could not fetch '{url}': {exc.__class__.__name__}: {exc}",
        ) from exc

    body_raw = response.read(MAX_COMPRESSED_BYTES + 1)
    body = bytes(body_raw)
    if len(body) > MAX_COMPRESSED_BYTES:
        raise NpxResolveError(
            "npx:body-too-large",
            f"Registry response exceeds {MAX_COMPRESSED_BYTES // (1024 * 1024)} MiB cap.",
        )
    return body


def _registry_url_for_name(name: str) -> str:
    """Build the metadata URL, quoting only the slash for scoped pkgs."""
    if name.startswith("@"):
        # Scoped package: replace the slash with %2f per npm registry convention.
        scope, _, rest = name.partition("/")
        return f"{NPM_REGISTRY}/{quote(scope, safe='@')}%2F{quote(rest, safe='')}"
    return f"{NPM_REGISTRY}/{quote(name, safe='')}"


def resolve_version(coord: NpxCoordinate) -> ResolvedPackage:
    """Fetch package metadata and pick a concrete version.

    Version-spec semantics — minimal v1:

      - Missing or "latest" → use `dist-tags.latest`.
      - Exact semver (e.g. "1.2.3") → require the version to exist.
      - Anything else (ranges, tags other than `latest`) → reject in
        v1. The user can paste the exact version. Range resolution
        adds attack surface (`>=0`, etc.) and we don't want to
        re-implement npm's resolver in this surface.
    """
    metadata_url = _registry_url_for_name(coord.name)
    body = _http_get_bytes(
        metadata_url,
        timeout=METADATA_TIMEOUT_SECONDS,
        accept="application/vnd.npm.install-v1+json, application/json",
    )
    try:
        metadata = json.loads(body)
    except json.JSONDecodeError as exc:
        raise NpxResolveError(
            "npx:invalid-metadata",
            "Registry returned content that wasn't valid JSON.",
        ) from exc

    if not isinstance(metadata, dict):
        raise NpxResolveError(
            "npx:invalid-metadata",
            "Registry metadata wasn't a JSON object.",
        )

    versions_obj = metadata.get("versions")
    if not isinstance(versions_obj, dict) or not versions_obj:
        raise NpxResolveError(
            "npx:no-versions",
            f"No published versions for '{coord.name}'.",
        )

    spec = coord.version_spec
    if spec is None or spec.lower() == "latest":
        dist_tags = metadata.get("dist-tags") or {}
        latest = dist_tags.get("latest") if isinstance(dist_tags, dict) else None
        if not isinstance(latest, str):
            raise NpxResolveError(
                "npx:no-latest",
                "Package has no `dist-tags.latest` entry.",
            )
        chosen_version = latest
    elif re.match(r"^\d+\.\d+\.\d+([-+][a-zA-Z0-9.+-]+)?$", spec):
        chosen_version = spec
    else:
        raise NpxResolveError(
            "npx:unsupported-spec",
            (
                f"Version spec '{spec}' not supported in this surface. "
                "Paste an exact version (e.g. 1.2.3) or omit the @-suffix to use latest."
            ),
        )

    version_entry = versions_obj.get(chosen_version)
    if not isinstance(version_entry, dict):
        raise NpxResolveError(
            "npx:version-not-found",
            f"Version '{chosen_version}' not published for '{coord.name}'.",
        )
    dist = version_entry.get("dist")
    if not isinstance(dist, dict):
        raise NpxResolveError(
            "npx:no-dist",
            f"Version '{chosen_version}' has no dist block.",
        )
    tarball_url = dist.get("tarball")
    if not isinstance(tarball_url, str) or not tarball_url:
        raise NpxResolveError(
            "npx:no-tarball-url",
            f"Version '{chosen_version}' has no dist.tarball URL.",
        )

    integrity = dist.get("integrity") if isinstance(dist.get("integrity"), str) else None
    shasum = dist.get("shasum") if isinstance(dist.get("shasum"), str) else None
    size_hint_raw = dist.get("unpackedSize")
    size_hint = int(size_hint_raw) if isinstance(size_hint_raw, int) else None

    # Lock the tarball host too — registry.npmjs.org metadata can in
    # theory reference any URL. We refuse anything off-registry.
    parsed_tarball = urlparse(tarball_url)
    if parsed_tarball.hostname not in {"registry.npmjs.org"}:
        raise NpxResolveError(
            "npx:tarball-off-registry",
            (
                f"Tarball URL '{tarball_url}' points off-registry. "
                "v1 only fetches tarballs hosted on registry.npmjs.org."
            ),
        )

    return ResolvedPackage(
        name=coord.name,
        version=chosen_version,
        tarball_url=tarball_url,
        integrity=integrity,
        shasum=shasum,
        size_hint=size_hint,
    )


def _verify_integrity(body: bytes, package: ResolvedPackage) -> None:
    """Verify tarball bytes against `integrity` (SRI) or `shasum` (legacy SHA-1).

    npm's `dist.integrity` is an SRI string like `sha512-<base64>`.
    `dist.shasum` is a legacy SHA-1 hex. We check BOTH if present and
    require AT LEAST ONE to be present and to match. If both are
    absent (very old packages) we refuse — that's pathological enough
    that scanning the bytes without an authenticity check is itself a
    finding.
    """
    if package.integrity:
        algo, _, encoded = package.integrity.partition("-")
        if algo not in {"sha256", "sha384", "sha512"}:
            raise NpxResolveError(
                "npx:integrity-unsupported-algo",
                f"Unsupported integrity algorithm '{algo}'.",
            )
        if algo == "sha256":
            digest_bytes = hashlib.sha256(body).digest()
        elif algo == "sha384":
            digest_bytes = hashlib.sha384(body).digest()
        else:
            digest_bytes = hashlib.sha512(body).digest()
        import base64

        try:
            expected = base64.b64decode(encoded, validate=True)
        except Exception as exc:
            raise NpxResolveError(
                "npx:integrity-decode-failed",
                "Could not decode the integrity field from npm metadata.",
            ) from exc
        if digest_bytes != expected:
            raise NpxResolveError(
                "npx:integrity-mismatch",
                f"Tarball bytes do not match the {algo} integrity digest from npm.",
            )
        return

    if package.shasum:
        actual = hashlib.sha1(body, usedforsecurity=False).hexdigest()
        if actual.lower() != package.shasum.lower():
            raise NpxResolveError(
                "npx:shasum-mismatch",
                "Tarball bytes do not match the sha1 shasum from npm.",
            )
        return

    raise NpxResolveError(
        "npx:no-integrity",
        (
            "Registry metadata for this version has no integrity / shasum field. "
            "Refusing to scan an unverifiable tarball."
        ),
    )


def fetch_tarball(package: ResolvedPackage) -> bytes:
    """Fetch the tarball bytes + verify integrity. Returns raw .tgz."""
    body = _http_get_bytes(
        package.tarball_url,
        timeout=TARBALL_TIMEOUT_SECONDS,
        accept="application/octet-stream",
    )
    _verify_integrity(body, package)
    return body


def _is_text_path(path: str) -> bool:
    lowered = path.lower()
    base = lowered.rsplit("/", 1)[-1]
    if base in _TEXT_BASENAMES:
        return True
    if "." in base:
        ext = "." + base.rsplit(".", 1)[-1]
        return ext in _TEXT_EXTENSIONS
    return False


def _safe_member_name(raw: str) -> str | None:
    """Normalize a tar member name; return None to skip it.

    npm tarballs root every entry under `package/`; GitHub codeload
    tarballs root entries under `<repo>-<sha>/`. We strip the first
    segment unconditionally — both shapes converge on the same
    in-package display path. Reject anything trying to escape
    (absolute paths, `..`, etc.).
    """
    if not raw:
        return None
    # Normalize separators and strip leading slashes.
    norm = raw.lstrip("/").replace("\\", "/")
    parts = [p for p in norm.split("/") if p]
    if not parts:
        return None
    # Strip the single top-level directory present in both npm + codeload tarballs.
    parts = parts[1:]
    if not parts:
        return None
    # Reject any traversal segments.
    for part in parts:
        if part == "." or part == "..":
            return None
        if "\x00" in part:
            return None
    return "/".join(parts)


def extract_safely(
    tarball_bytes: bytes,
    *,
    max_compressed: int = MAX_COMPRESSED_BYTES,
    max_uncompressed: int = MAX_UNCOMPRESSED_BYTES,
    max_entries: int = MAX_ENTRY_COUNT,
    error_prefix: str = "npx",
) -> ExtractionResult:
    """Decompress and untar with hard caps. ADR-0034 § 2 sub-bullet 4.

    Callers can override the compressed + uncompressed caps for paths
    that legitimately handle larger archives (e.g. github_resolver uses
    a 32 MiB compressed cap because skill collections often exceed
    npm-package-sized tarballs). `error_prefix` becomes the namespace
    of the named error codes so callers can branch on the cause.

    Refuses absolute paths, `..`, symlinks, hardlinks, non-regular
    files, oversized entries, oversized totals, oversized counts, or
    wall-clock budget overruns. Each refusal aborts the whole
    extraction — partial extractions are a worse outcome than no
    extraction, because callers might confuse "we scanned 200/1000
    files" with "the package was 200 files".
    """
    deadline = time.monotonic() + EXTRACTION_TIMEOUT_SECONDS
    compressed_len = len(tarball_bytes)
    if compressed_len > max_compressed:
        raise NpxResolveError(
            f"{error_prefix}:tarball-too-large",
            f"Tarball exceeds {max_compressed // (1024 * 1024)} MiB compressed cap.",
        )

    files: list[ExtractedFile] = []
    total_uncompressed = 0
    entry_count = 0

    try:
        # Manual gunzip to enforce a strict uncompressed cap. `tarfile`
        # alone would happily read a gigabyte of zeros from a small
        # compressed input.
        decompressed = io.BytesIO()
        with gzip.GzipFile(fileobj=io.BytesIO(tarball_bytes), mode="rb") as gz:
            while True:
                chunk = gz.read(64 * 1024)
                if not chunk:
                    break
                decompressed.write(chunk)
                if decompressed.tell() > max_uncompressed:
                    raise NpxResolveError(
                        f"{error_prefix}:tarball-bomb",
                        f"Uncompressed size exceeds {max_uncompressed // (1024 * 1024)} MiB.",
                    )
                if time.monotonic() > deadline:
                    raise NpxResolveError(
                        f"{error_prefix}:extraction-timeout",
                        "Tarball extraction exceeded the wall-clock budget.",
                    )
        decompressed.seek(0)
    except (gzip.BadGzipFile, OSError) as exc:
        raise NpxResolveError(
            f"{error_prefix}:not-gzip",
            f"Tarball is not a valid gzip stream: {exc}",
        ) from exc

    try:
        with tarfile.open(fileobj=decompressed, mode="r:") as tf:
            for member in tf:
                if time.monotonic() > deadline:
                    raise NpxResolveError(
                        f"{error_prefix}:extraction-timeout",
                        "Tarball extraction exceeded the wall-clock budget.",
                    )

                entry_count += 1
                if entry_count > max_entries:
                    raise NpxResolveError(
                        f"{error_prefix}:too-many-entries",
                        f"Tarball has more than {max_entries} entries.",
                    )

                # Reject everything that isn't a regular file or directory.
                if member.issym() or member.islnk():
                    raise NpxResolveError(
                        f"{error_prefix}:symlink-not-allowed",
                        f"Tarball contains a symlink/hardlink entry ('{member.name}'); refusing to scan.",
                    )
                if member.isdev() or member.isfifo():
                    raise NpxResolveError(
                        f"{error_prefix}:special-file-not-allowed",
                        f"Tarball contains a device/FIFO entry ('{member.name}'); refusing to scan.",
                    )
                if not member.isreg():
                    continue

                safe = _safe_member_name(member.name)
                if safe is None:
                    raise NpxResolveError(
                        f"{error_prefix}:unsafe-path",
                        f"Tarball entry name '{member.name}' is not safe for extraction.",
                    )

                if member.size > MAX_PER_ENTRY_BYTES:
                    raise NpxResolveError(
                        f"{error_prefix}:entry-too-large",
                        f"Entry '{safe}' is larger than the {MAX_PER_ENTRY_BYTES // (1024 * 1024)} MiB per-entry cap.",
                    )
                if total_uncompressed + member.size > max_uncompressed:
                    raise NpxResolveError(
                        f"{error_prefix}:tarball-bomb",
                        f"Uncompressed total exceeds {max_uncompressed // (1024 * 1024)} MiB.",
                    )

                handle = tf.extractfile(member)
                if handle is None:
                    continue
                raw = handle.read(member.size + 1)
                if len(raw) > member.size:
                    raise NpxResolveError(
                        f"{error_prefix}:size-mismatch",
                        f"Entry '{safe}' produced more bytes than its header declared.",
                    )
                total_uncompressed += len(raw)

                if _is_text_path(safe):
                    try:
                        decoded = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        # File extension suggested text but bytes weren't UTF-8.
                        # List it without content so the user sees it existed.
                        files.append(ExtractedFile(path=safe, bytes_count=len(raw), content=None))
                        continue
                    files.append(ExtractedFile(path=safe, bytes_count=len(raw), content=decoded))
                else:
                    files.append(ExtractedFile(path=safe, bytes_count=len(raw), content=None))
    except tarfile.TarError as exc:
        raise NpxResolveError(
            f"{error_prefix}:not-tar",
            f"Could not parse the gunzipped stream as a tarball: {exc}",
        ) from exc

    return ExtractionResult(
        files=tuple(files),
        total_uncompressed_bytes=total_uncompressed,
        compressed_bytes=compressed_len,
    )
