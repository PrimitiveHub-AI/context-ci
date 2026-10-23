"""Shared SSRF-safe HTTP transport for every outbound fetch in `/check`.

All three fetchers — `url_fetcher` (`mode=url`, user-controlled host),
`github_resolver`, and `npx_resolver` (host-locked) — route through this
module so the SSRF defense lives in exactly one place.

The core control is `GuardedHTTPSConnection`: it validates the IP the
socket *actually connected to* (`getpeername`) and aborts before any
HTTP request is sent. Checking the live peer — not a prior
`getaddrinfo()` — is what closes the DNS-rebinding TOCTOU: the IP we
check is the IP the request will reach. Every hop (initial + redirects)
goes through it, so a redirect to an internal address is caught too.

Callers raise their own domain errors; this layer raises `SafeHttpError`
with a bare `code` (`internal-address` / `scheme-not-https` /
`no-hostname` / `dns-failed`) that each caller maps onto its own
error-code namespace.

Network-layer egress controls (block the cloud metadata endpoint +
RFC1918 at the firewall) are phub-platform's defense-in-depth layer
beneath this one — see that ledger.
"""

from __future__ import annotations

import http.client
import ipaddress
import socket
import urllib.request
from urllib.parse import urlparse
from urllib.request import Request

# Blocked SSRF surface. IPv4 RFC1918 + loopback + link-local (incl.
# 169.254.0.0/16, the cloud metadata endpoint) + CGNAT + unspecified;
# IPv6 loopback + ULA + link-local + unspecified + NAT64 + IMDS-v6.
# Explicit ranges beat `is_global`, which also trips reserved test ranges
# used in CI; `ip_is_blocked` adds narrow stdlib backstops on top.
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
    ipaddress.IPv6Network("64:ff9b::/96"),  # NAT64 — could map to a v4 internal
    ipaddress.IPv6Network("fd00:ec2::/32"),  # AWS IMDS over IPv6 neighbourhood
)


class SafeHttpError(Exception):
    """Raised when a request is refused by the SSRF policy.

    `code` is a bare token (no caller prefix): `internal-address`,
    `scheme-not-https`, `no-hostname`, `dns-failed`.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def ip_is_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """True if `ip` is in a blocked range or is otherwise non-routable.

    Unwraps IPv4-mapped IPv6 (`::ffff:169.254.169.254`) first so a v4
    internal target cannot hide behind a v6 literal. After the explicit
    range lists, applies narrow stdlib backstops (`is_loopback` /
    `is_link_local` / `is_unspecified` / `is_multicast`) that never catch
    the documentation/test ranges CI uses.
    """
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if isinstance(ip, ipaddress.IPv4Address):
        if any(ip in net for net in _BLOCKED_V4):
            return True
    elif any(ip in net for net in _BLOCKED_V6):
        return True
    return ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast


def assert_host_allowed(hostname: str) -> None:
    """Pre-connect fast-fail: raise `SafeHttpError` if any resolved IP is
    blocked. Advisory only — DNS can change before the real connect, so
    `GuardedHTTPSConnection` is the authoritative check. This exists for
    a friendly, early error on obviously-internal hosts.
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SafeHttpError("dns-failed", f"Could not resolve hostname '{hostname}'.") from exc

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
            raise SafeHttpError(
                "internal-address",
                (
                    f"Refusing to fetch '{hostname}' — resolves to a private, "
                    "loopback, or link-local address. /check cannot be used "
                    "to probe internal networks."
                ),
            )


class GuardedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPSConnection that aborts if the connected peer is a blocked
    (private / loopback / link-local / reserved) address.

    `connect()` completes the TCP + TLS handshake, then validates
    `getpeername()` and closes before any request line / headers / body
    are sent. Only the handshake (incl. SNI) reaches a blocked host — no
    request data, no response read.
    """

    def connect(self) -> None:
        super().connect()
        try:
            peer = self.sock.getpeername()[0]
            ip = ipaddress.ip_address(str(peer).split("%", 1)[0])
        except (ValueError, OSError, IndexError) as exc:
            self.close()
            raise SafeHttpError(
                "internal-address",
                "Could not verify the connected peer address; refusing the fetch.",
            ) from exc
        if ip_is_blocked(ip):
            self.close()
            raise SafeHttpError(
                "internal-address",
                (
                    f"Refusing the fetch — the connection resolved to blocked "
                    f"address {ip}. /check cannot be used to probe internal networks."
                ),
            )


class _GuardedHTTPSHandler(urllib.request.HTTPSHandler):
    """Opens connections through `GuardedHTTPSConnection`, preserving the
    handler's TLS context + hostname verification."""

    def https_open(self, req: Request) -> http.client.HTTPResponse:
        return self.do_open(GuardedHTTPSConnection, req)


class _RefusePlaintextHTTPHandler(urllib.request.BaseHandler):
    """Refuse any plaintext http:// open outright — including a redirect
    that tries to downgrade from https."""

    def http_open(self, req: Request) -> None:
        raise SafeHttpError(
            "scheme-not-https",
            "Refusing a plaintext http:// request; /check is https-only.",
        )


class HttpsOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects, but cap the count and re-validate each hop: the
    target must be https and pass the pre-connect resolve check. The
    authoritative per-hop IP pin is enforced by `GuardedHTTPSConnection`,
    which every hop also goes through."""

    max_redirections = 3

    def redirect_request(
        self,
        req: Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> Request | None:
        parsed = urlparse(newurl)
        if parsed.scheme.lower() != "https":
            raise SafeHttpError(
                "scheme-not-https",
                f"Refusing a redirect to a non-https URL ({newurl!r}).",
            )
        if not parsed.hostname:
            raise SafeHttpError("no-hostname", "Redirect target has no hostname.")
        assert_host_allowed(parsed.hostname)
        return super().redirect_request(req, fp, code, msg, headers, newurl)  # type: ignore[arg-type]


def build_guarded_opener(*, max_redirects: int = 3) -> urllib.request.OpenerDirector:
    """A dedicated opener: guarded HTTPS transport, plaintext refused,
    redirect-following bounded + re-validated. Not the global `urlopen`
    opener, so nothing else inherits these handlers."""
    redirect = HttpsOnlyRedirectHandler()
    redirect.max_redirections = max_redirects
    return urllib.request.build_opener(
        _GuardedHTTPSHandler(),
        _RefusePlaintextHTTPHandler(),
        redirect,
    )


def guarded_urlopen(url_or_req: str | Request, timeout: float | None = None):
    """Drop-in replacement for `urllib.request.urlopen` that routes through
    `build_guarded_opener()`. Signature-compatible so a module can simply
    `from checks._safe_http import guarded_urlopen as urlopen` and keep its
    existing call sites + test mock seams. Raises `SafeHttpError` on a
    policy refusal; otherwise behaves like `urlopen` (incl. raising
    `urllib.error.HTTPError` on 4xx/5xx)."""
    return build_guarded_opener().open(url_or_req, timeout=timeout)
