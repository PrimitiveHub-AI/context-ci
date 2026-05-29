"""Canonical SHA-256 digest helpers.

Per Spec v0.1 §4: a primitive's content digest is the SHA-256 of the
canonical content bytes (the primitive markdown file as authored, with
LF line endings, UTF-8 encoding, no BOM). The same hex string is the
object-storage key.

This module is the single source of truth for how PrimitiveHub hashes
content. Any code that computes or verifies a digest goes through here.

Crypto vocabulary (locked, per CLAUDE.md §Cryptographic vocabulary)
  - "Content Digest"  = SHA-256 hex of canonical content
  - NEVER write "SHA-256 signed" — SHA-256 is a hash, not a signature
"""

from __future__ import annotations

import hashlib
from typing import Any

from storage.exceptions import SizeLimitExceededError

# Stream chunk size for digest-while-reading. 64 KiB matches typical
# Linux page-cache block size; larger gives no throughput improvement
# in benchmarks and uses more memory on concurrent uploads.
_CHUNK_SIZE = 64 * 1024


def compute_digest(content: bytes) -> str:
    """Return the SHA-256 hex of `content`. Pure function."""
    return hashlib.sha256(content).hexdigest()


def storage_key_for_digest(digest_hex: str) -> str:
    """Return the canonical storage key (`sha256:<hex>`) for a digest."""
    return f"sha256:{digest_hex}"


def read_with_digest(stream: Any, *, max_bytes: int) -> tuple[bytes, str]:
    """Read `stream` up to `max_bytes`, returning (content, digest_hex).

    Raises `SizeLimitExceededError` if the stream exceeds `max_bytes`. The
    digest is computed during the read — no second pass over the bytes.

    The stream is expected to be a file-like with a `.read(size)` method.
    Returns the full bytes (caller decides whether to keep them in memory
    or stream to storage); fine for the 1 MiB primitive cap, would need
    streaming chunks for larger artifacts.
    """
    hasher = hashlib.sha256()
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = stream.read(_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise SizeLimitExceededError(size=total, limit=max_bytes)
        hasher.update(chunk)
        chunks.append(chunk)
    return b"".join(chunks), hasher.hexdigest()
