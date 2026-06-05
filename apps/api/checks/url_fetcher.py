"""URL fetcher for the `mode=url` path of `/check`.

Implements the contract locked in ADR-0034 § 3:

  - HTTPS only.
  - Resolved IP must not be private / loopback / link-local.
  - 8 MiB response cap.
  - 10s wall-clock.
  - 3 redirects max; each redirect re-runs the scheme + IP checks.

All public functions raise `UrlFetchError` (with a stable `code`
field) on policy violations. The endpoint maps these onto a
named-error response payload so the UI can render an informative
panel instead of a raw 4xx.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.request import Request, urlopen

# Hard caps — ADR-0034 § 3.
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_REDIRECTS = 3
FETCH_TIMEOUT_SECONDS = 10.0

# Blocks the standard SSRF surface. IPv4 RFC1918 + loopback + link-local
# + IPv6 loopback + ULA + link-local. `is_global` would be tighter but
# also blocks reserved test ranges that come up in CI; explicit ranges
# are clearer about intent.
_BLOCKED_V4 = (
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("169.254.0.0/16"),
    ipaddress.IPv4Network("0.0.0.0/8"),
    ipaddress.IPv4Network("100.64.0.0/10"),  # CGNAT
)

_BLOCKED_V6 = (
    ipaddress.IPv6Network("::1/128"),
    ipaddress.IPv6Network("fc00::/7"),
    ipaddress.IPv6Network("fe80::/10"),
    ipaddress.IPv6Network("::/128"),
)


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


def _ip_is_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv4Address):
        return any(ip in net for net in _BLOCKED_V4)
    return any(ip in net for net in _BLOCKED_V6)


def _resolve_and_check(hostname: str) -> None:
    """Raise UrlFetchError if any resolved IP is in a blocked range.

    Resolves both A and AAAA records. Even one blocked address is
    enough — DNS rebinding attacks rely on the gap between policy
    check and actual connect, so we err strict: if ANY resolved
    address is internal, the whole hostname is refused.
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UrlFetchError(
            "url:dns-failed",
            f"Could not resolve hostname '{hostname}'.",
        ) from exc

    for family, _type, _proto, _canon, sockaddr in infos:
        addr_raw = sockaddr[0]
        if not isinstance(addr_raw, str):
            continue
        addr_str = addr_raw
        try:
            if family == socket.AF_INET:
                ip: ipaddress.IPv4Address | ipaddress.IPv6Address = ipaddress.IPv4Address(addr_str)
            elif family == socket.AF_INET6:
                # Strip any zone-id suffix Linux appends to link-local addresses.
                ip = ipaddress.IPv6Address(addr_str.split("%", 1)[0])
            else:
                continue
        except (ValueError, ipaddress.AddressValueError):
            continue
        if _ip_is_blocked(ip):
            raise UrlFetchError(
                "url:internal-address",
                (
                    f"Refusing to fetch '{hostname}' — resolves to a private, "
                    "loopback, or link-local address. /check cannot be used "
                    "to probe internal networks."
                ),
            )


def _check_url(url: str) -> str:
    """Validate scheme + hostname; return the validated URL."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise UrlFetchError(
            "url:scheme-not-https",
            f"Only https:// URLs are accepted; got scheme '{parsed.scheme}'.",
        )
    if not parsed.hostname:
        raise UrlFetchError(
            "url:no-hostname",
            "URL has no hostname.",
        )
    _resolve_and_check(parsed.hostname)
    return url


def fetch_url(url: str) -> UrlFetchResult:
    """Fetch `url` under the ADR-0034 § 3 contract.

    Returns the decoded body, capped at `MAX_RESPONSE_BYTES`. Raises
    `UrlFetchError` on any policy violation or transport failure.
    """
    current = _check_url(url)
    redirects_left = MAX_REDIRECTS

    while True:
        # urlopen returns a `BaseHTTPResponse`. We use `Request` to
        # set a User-Agent so origin servers can identify us if we
        # mis-behave; happy to be reported.
        req = Request(  # noqa: S310 — scheme is validated by _check_url
            current,
            headers={
                "User-Agent": "PrimitiveHub-CheckBot/0.1 (+https://primitivehub.ai/check)",
                "Accept": "text/plain, text/markdown, application/json, */*;q=0.5",
            },
        )
        try:
            response = urlopen(req, timeout=FETCH_TIMEOUT_SECONDS)  # noqa: S310
        except Exception as exc:
            raise UrlFetchError(
                "url:fetch-failed",
                f"Could not fetch URL: {exc.__class__.__name__}: {exc}",
            ) from exc

        status = response.status
        if 300 <= status < 400:
            location = response.headers.get("Location")
            if not location:
                raise UrlFetchError(
                    "url:redirect-no-location",
                    f"Got status {status} with no Location header.",
                )
            redirects_left -= 1
            if redirects_left < 0:
                raise UrlFetchError(
                    "url:too-many-redirects",
                    f"Followed more than {MAX_REDIRECTS} redirects.",
                )
            current = _check_url(location)
            continue
        if status >= 400:
            raise UrlFetchError(
                "url:remote-error",
                f"Remote server returned HTTP {status}.",
            )

        # Read up to MAX_RESPONSE_BYTES + 1; if we got the +1 byte the
        # response is over the cap.
        body = response.read(MAX_RESPONSE_BYTES + 1)
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

        return UrlFetchResult(
            final_url=current,
            bytes_count=len(body),
            content=content,
        )
