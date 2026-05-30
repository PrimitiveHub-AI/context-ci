"""Storage-layer exceptions.

These are raised from `storage.client` / `storage.digest` and translated to
HTTP status codes by the endpoint layer:

  DigestMismatchError       → 500 (Trust Drift, T9) — server-side integrity
                               violation; the bytes we got from storage
                               don't hash to the digest we asked for.
  SizeLimitExceededError    → 413 (Payload Too Large) — caller exceeded
                               PRIMITIVE_MAX_BYTES.
  StorageUnavailableError   → 503 (Service Unavailable) — R2 timeout /
                               5xx; client should retry with backoff.
  ContentNotFoundError      → 404 — object key doesn't exist (or caller
                               isn't authorized to know it does).
"""

from __future__ import annotations


class StorageError(Exception):
    """Base for all storage-layer failures."""


class DigestMismatchError(StorageError):
    """Re-hash on read produced a different digest than the storage key.

    Indicates either (a) storage compromise / silent corruption, or (b) a
    bug that wrote the wrong key. T9 (Trust Drift) detection. Caller
    treats this as a fatal integrity failure — never serve the bytes.
    """

    def __init__(self, *, expected: str, actual: str, key: str) -> None:
        self.expected = expected
        self.actual = actual
        self.key = key
        super().__init__(
            f"digest mismatch at key={key}: expected sha256:{expected}, got sha256:{actual}"
        )


class SizeLimitExceededError(StorageError):
    """Content exceeded the configured PRIMITIVE_MAX_BYTES limit."""

    def __init__(self, *, size: int, limit: int) -> None:
        self.size = size
        self.limit = limit
        super().__init__(f"content size {size} exceeds limit {limit}")


class StorageUnavailableError(StorageError):
    """The object store returned a 5xx or timed out."""


class ContentNotFoundError(StorageError):
    """The requested object key does not exist."""
