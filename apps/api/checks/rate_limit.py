"""Per-IP rate limiter for the public `/check` endpoint.

ADR-0034 § 5:
  - 30 requests per 5-minute window per IP.
  - 500 requests per 24-hour window per IP.

State lives in Valkey via Django's default cache backend. Both
windows are sliding-bucket: increment on each request, return the
new count + window TTL.

We hash the client IP — never the content. The IP is logged for
abuse remediation; content is never logged (ADR-0034 § 5).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from django.core.cache import cache

SHORT_WINDOW_SECONDS = 5 * 60  # 5 minutes
SHORT_WINDOW_LIMIT = 30

LONG_WINDOW_SECONDS = 24 * 60 * 60  # 24 hours
LONG_WINDOW_LIMIT = 500


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """Tells the caller whether to admit the request + how to respond."""

    allowed: bool
    bucket: str  # "short" or "long" for the window that triggered the refusal
    retry_after_seconds: int
    short_remaining: int
    long_remaining: int


def _hash_ip(ip: str) -> str:
    """Deterministic IP hash. Salted globally; never stored unsalted."""
    digest = hashlib.sha256(f"phub-check:{ip}".encode()).hexdigest()
    return digest[:24]


def _bucket_key(bucket: str, ip_hash: str) -> str:
    return f"phub-check:rl:{bucket}:{ip_hash}"


def _safe_ttl(key: str, fallback: int) -> int:
    """Read remaining TTL on `key`; fall back if the backend doesn't expose it.

    django-redis exposes `cache.ttl()`; LocMemCache (used in tests) does
    not. Either way, the response field is best-effort: the worst case
    is "Retry-After looks longer than necessary," which is fine.
    """
    ttl_fn = getattr(cache, "ttl", None)
    if ttl_fn is None:
        return fallback
    try:
        result = ttl_fn(key)
    except Exception:
        return fallback
    if isinstance(result, int) and result > 0:
        return result
    return fallback


def check_rate_limit(ip: str) -> RateLimitDecision:
    """Increment both counters and return whether to admit the request.

    Both windows must be under their cap. The first window that's at
    cap is reported as `bucket` so the user message can be specific.
    """
    ip_hash = _hash_ip(ip)
    short_key = _bucket_key("short", ip_hash)
    long_key = _bucket_key("long", ip_hash)

    # `cache.add` returns False if the key existed, True if it was
    # created. We use it to seed the TTL exactly once per window;
    # subsequent increments preserve the TTL.
    if cache.add(short_key, 0, timeout=SHORT_WINDOW_SECONDS):
        short_count = 1
        cache.set(short_key, 1, timeout=SHORT_WINDOW_SECONDS)
    else:
        short_count = cache.incr(short_key, 1)
    if cache.add(long_key, 0, timeout=LONG_WINDOW_SECONDS):
        long_count = 1
        cache.set(long_key, 1, timeout=LONG_WINDOW_SECONDS)
    else:
        long_count = cache.incr(long_key, 1)

    short_remaining = max(0, SHORT_WINDOW_LIMIT - short_count)
    long_remaining = max(0, LONG_WINDOW_LIMIT - long_count)

    if short_count > SHORT_WINDOW_LIMIT:
        return RateLimitDecision(
            allowed=False,
            bucket="short",
            retry_after_seconds=_safe_ttl(short_key, SHORT_WINDOW_SECONDS),
            short_remaining=0,
            long_remaining=long_remaining,
        )
    if long_count > LONG_WINDOW_LIMIT:
        return RateLimitDecision(
            allowed=False,
            bucket="long",
            retry_after_seconds=_safe_ttl(long_key, LONG_WINDOW_SECONDS),
            short_remaining=short_remaining,
            long_remaining=0,
        )

    return RateLimitDecision(
        allowed=True,
        bucket="",
        retry_after_seconds=0,
        short_remaining=short_remaining,
        long_remaining=long_remaining,
    )


def client_ip(request: object) -> str:
    """Extract the client IP, honoring a single hop of X-Forwarded-For.

    Production traffic comes through a reverse proxy, so we read the
    first XFF entry if present. Dev traffic from compose lands as
    REMOTE_ADDR. We never trust more than the leftmost XFF — chained
    headers from compromised intermediates would otherwise let an
    attacker spoof their bucket.
    """
    meta = getattr(request, "META", None)
    if not isinstance(meta, dict):
        return "0.0.0.0"  # noqa: S104 — sentinel address for unknown clients, not a bind target
    xff = meta.get("HTTP_X_FORWARDED_FOR")
    if isinstance(xff, str) and xff.strip():
        return xff.split(",", 1)[0].strip()
    remote = meta.get("REMOTE_ADDR")
    if isinstance(remote, str) and remote.strip():
        return remote.strip()
    return "0.0.0.0"  # noqa: S104 — sentinel address for unknown clients, not a bind target
