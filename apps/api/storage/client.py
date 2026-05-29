"""S3-compatible object storage client (R2 in prod; MinIO for self-host).

Content-addressed model
-----------------------
Object key = `sha256:<hex>`. The key IS the digest. Re-upload of the same
content is a no-op (same digest → same key → server returns the existing
ETag). This is the "content-addressed" property: identity is derived from
content, not assigned externally.

Defense against T9 (Trust Drift via mutation)
---------------------------------------------
Every `get_primitive_content` call re-hashes the bytes from storage and
compares to the expected digest. Mismatch → `DigestMismatchError` →
the endpoint refuses to serve. This is the runtime check the spec
promises.

Module-level singleton
----------------------
`_client()` returns a process-wide boto3 client (lazy-init, thread-safe
per boto3 docs). Avoid creating one per request — TLS handshake is
expensive on R2.
"""

from __future__ import annotations

import threading
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointConnectionError
from django.conf import settings

from storage.digest import compute_digest, storage_key_for_digest
from storage.exceptions import (
    ContentNotFoundError,
    DigestMismatchError,
    StorageUnavailableError,
)

_client_lock = threading.Lock()
_client_instance: Any = None


def _client() -> Any:
    """Lazy-init module-level boto3 S3 client.

    Configured for R2: signature v4, `auto` region, virtual-host addressing
    disabled (R2 uses path-style on the S3-compatible endpoint). Connect
    + read timeouts capped at 10s — uploads are small and we'd rather
    surface a 503 than block a request thread.
    """
    global _client_instance
    if _client_instance is not None:
        return _client_instance
    with _client_lock:
        if _client_instance is not None:
            return _client_instance
        _client_instance = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL or None,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY or None,
            region_name=settings.S3_REGION or "auto",
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=10,
                read_timeout=10,
                s3={"addressing_style": "path"},
            ),
        )
        return _client_instance


def reset_client_for_tests() -> None:
    """Reset the cached client so tests can re-init with override settings.

    Should NOT be called outside the test harness.
    """
    global _client_instance
    with _client_lock:
        _client_instance = None


def put_primitive_content(content: bytes, *, digest_hex: str) -> str:
    """Upload `content` to `sha256:<digest_hex>` and return the storage key.

    Idempotent by construction: same digest → same key → R2 returns the
    existing object's ETag (no second copy stored). We don't gate on
    "object already exists" because the digest comparison at
    `get_primitive_content` time is the load-bearing check.

    Raises `StorageUnavailableError` on transport / 5xx failures.
    """
    key = storage_key_for_digest(digest_hex)
    try:
        _client().put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=content,
            ContentType="text/markdown; charset=utf-8",
            # Cloudflare R2 supports the "If-None-Match: *" header, which
            # makes the PUT conditional ("upload only if absent"). We do
            # NOT set it — re-upload of the same digest is a documented
            # no-op contract; failing on conflict would force callers to
            # treat a normal idempotent re-PUT as an error.
        )
    except EndpointConnectionError as exc:
        raise StorageUnavailableError("storage endpoint unreachable") from exc
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"InternalError", "ServiceUnavailable", "SlowDown"}:
            raise StorageUnavailableError(f"storage 5xx: {code}") from exc
        # Other ClientErrors (e.g., AccessDenied) bubble up — they signal
        # a configuration bug, not an availability problem.
        raise
    return key


def get_primitive_content(*, digest_hex: str) -> bytes:
    """Fetch the content at `sha256:<digest_hex>`, verify the digest, return bytes.

    Raises:
        ContentNotFoundError    — object key not present in storage.
        DigestMismatchError     — bytes from storage don't hash to the
                                  requested digest (T9 detection).
        StorageUnavailableError — transport / 5xx failures.
    """
    key = storage_key_for_digest(digest_hex)
    try:
        obj = _client().get_object(Bucket=settings.S3_BUCKET, Key=key)
        content = obj["Body"].read()
    except EndpointConnectionError as exc:
        raise StorageUnavailableError("storage endpoint unreachable") from exc
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"NoSuchKey", "404"}:
            raise ContentNotFoundError(key) from exc
        if code in {"InternalError", "ServiceUnavailable", "SlowDown"}:
            raise StorageUnavailableError(f"storage 5xx: {code}") from exc
        raise

    actual_digest = compute_digest(content)
    if actual_digest != digest_hex:
        raise DigestMismatchError(expected=digest_hex, actual=actual_digest, key=key)
    result: bytes = content
    return result
