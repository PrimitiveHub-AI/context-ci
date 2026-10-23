"""URL fetcher for the `mode=url` path of `/check`.

Implements the contract locked in ADR-0034 § 3 and the SSRF handoff
`docs/security/2026-10-23-ssrf-01-handoff.md` (reporter abhibughunt3r):

  - HTTPS only, port 443 only (every hop — no http/scheme/port change
    via redirect).
  - The *actual connected peer IP* must not be private / loopback /
    link-local / reserved. Validated on the live socket, not a prior DNS
    lookup, so DNS-rebinding (TOCTOU) cannot slip an internal address past
    the check.
  - 8 MiB response cap · 10s wall-clock · 3 redirects max, each re-checked.
  - **Fail closed:** refusals and upstream failures return a GENERIC
    message to the caller; the real detail (status, exception) is logged
    server-side only, never echoed back — otherwise the error text is a
    blind-SSRF exfiltration channel (handoff item 5).

The SSRF-safe transport lives in `checks._safe_http` (shared with the
github/npx resolvers). This module maps `_safe_http.SafeHttpError` onto
the `url:`-prefixed `UrlFetchError` codes the endpoint already renders.
Network-layer egress blocking is phub-platform's defense-in-depth half.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
import urllib.error
from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.request import Request

from ._safe_http import (
    SafeHttpError,
    build_guarded_opener,
    ip_is_blocked,
)

logger = logging.getLogger(__name__)

# Hard caps — ADR-0034 § 3.
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_REDIRECTS = 3
FETCH_TIMEOUT_SECONDS = 10.0

# Scheme + port allow-list (handoff item 3). https on 443 only; a URL on
# any other port is refused even if the host is public, so SSRF to an
# odd-port service can't ride through.
_ALLOWED_PORTS = frozenset({443})

_USER_AGENT = "PrimitiveHub-CheckBot/0.1 (+https://primitivehub.ai/check)"
_ACCEPT = "text/plain, text/markdown, application/json, */*;q=0.5"


class UrlFetchError(Exception):
    """Raised when a URL is refused or its fetch hits a policy cap."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class UrlFetchResult:
    final_url: str
    bytes_count: int
    content: str


def _resolve_and_check(hostname: str) -> None:
    """Advisory pre-connect fast-fail: raise UrlFetchError if any resolved
    IP is blocked. DNS can change before the real connect, so this is NOT
    the authoritative control — `_safe_http.GuardedHTTPSConnection` checks
    the IP the socket actually connected to. This exists for a friendly,
    early error. (Resolution is kept local, via this module's `socket`, so
    callers/tests can stub `checks.url_fetcher.socket.getaddrinfo`.)
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UrlFetchError("url:dns-failed", f"Could not resolve hostname '{hostname}'.") from exc

    for family, _type, _proto, _canon, sockaddr in infos:
        addr_raw = sockaddr[0]
        if not isinstance(addr_raw, str):
            continue
        try:
            if family == socket.AF_INET:
                ip: ipaddress.IPv4Address | ipaddress.IPv6Address = ipaddress.IPv4Address(addr_raw)
            elif family == socket.AF_INET6:
                ip = ipaddress.IPv6Address(addr_raw.split("%", 1)[0])
            else:
                continue
        except (ValueError, ipaddress.AddressValueError):
            continue
        if ip_is_blocked(ip):
            raise UrlFetchError(
                "url:internal-address",
                (
                    f"Refusing to fetch '{hostname}' — resolves to a private, "
                    "loopback, or link-local address. /check cannot be used "
                    "to probe internal networks."
                ),
            )


def _check_url(url: str) -> str:
    """Validate scheme + port + hostname; return the validated URL."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise UrlFetchError(
            "url:scheme-not-https",
            f"Only https:// URLs are accepted; got scheme '{parsed.scheme}'.",
        )
    if not parsed.hostname:
        raise UrlFetchError("url:no-hostname", "URL has no hostname.")
    try:
        port = parsed.port
    except ValueError as exc:  # malformed port in the netloc
        raise UrlFetchError("url:bad-port", "URL has a malformed port.") from exc
    if port is not None and port not in _ALLOWED_PORTS:
        raise UrlFetchError(
            "url:port-not-allowed",
            f"Only port 443 is accepted; got port {port}.",
        )
    _resolve_and_check(parsed.hostname)
    return url


def _build_opener():
    """The guarded opener (patch point for tests). Bounded redirects,
    https-only + revalidated per hop, peer-IP pinned."""
    return build_guarded_opener(max_redirects=MAX_REDIRECTS)


def fetch_url(url: str) -> UrlFetchResult:
    """Fetch `url` under the ADR-0034 § 3 + SSRF-handoff contract.

    Returns the decoded body, capped at `MAX_RESPONSE_BYTES`. Raises
    `UrlFetchError` on any policy violation or transport failure — with a
    generic message; upstream detail is logged, not echoed (handoff item 5).
    """
    current = _check_url(url)
    opener = _build_opener()
    req = Request(  # noqa: S310 — scheme/port validated by _check_url; transport is guarded
        current,
        headers={"User-Agent": _USER_AGENT, "Accept": _ACCEPT},
    )

    try:
        response = opener.open(req, timeout=FETCH_TIMEOUT_SECONDS)  # noqa: S310
    except SafeHttpError as exc:
        # Our own policy refusal (blocked peer IP / non-https redirect /
        # bad redirect host). Safe to surface — it's our determination,
        # not upstream response data. Map the bare code to a url: code.
        raise UrlFetchError(f"url:{exc.code}", exc.message) from exc
    except urllib.error.HTTPError as exc:
        # Upstream status (incl. the redirect cap). Do NOT echo the code or
        # body back — that's the blind-SSRF exfil channel. Log, return generic.
        logger.warning("url fetch: upstream HTTP %s for %r", exc.code, current)
        raise UrlFetchError(
            "url:remote-error",
            "The remote server could not be fetched.",
        ) from exc
    except Exception as exc:
        logger.warning("url fetch: transport failure for %r: %s", current, exc)
        raise UrlFetchError(
            "url:fetch-failed",
            "Could not fetch the URL.",
        ) from exc

    with response:
        # Read up to MAX_RESPONSE_BYTES + 1; the +1 byte means over cap.
        body = response.read(MAX_RESPONSE_BYTES + 1)
        final_url = response.geturl()

    if len(body) > MAX_RESPONSE_BYTES:
        raise UrlFetchError(
            "url:response-too-large",
            f"Response body exceeds {MAX_RESPONSE_BYTES // (1024 * 1024)} MiB.",
        )

    try:
        content = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise UrlFetchError(
            "url:not-utf8",
            "Response body is not valid UTF-8; /check scans text content only.",
        ) from exc

    return UrlFetchResult(final_url=final_url, bytes_count=len(body), content=content)
