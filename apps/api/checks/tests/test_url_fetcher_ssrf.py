"""SSRF regression tests for the `mode=url` fetcher + the shared
`_safe_http` transport.

Covers the handoff `docs/security/2026-10-23-ssrf-01-handoff.md`
(reporter abhibughunt3r). Each layer is pinned:

  1. `ip_is_blocked` — range classifier (incl. IPv4-mapped IPv6 + the
     cloud-metadata address 169.254.169.254).
  2. `_check_url` — scheme https + port-443 allow-list + hostname resolve.
  3. `GuardedHTTPSConnection.connect` — the authoritative control; validates
     the IP the socket ACTUALLY connected to, closing DNS-rebinding TOCTOU.
  4. `HttpsOnlyRedirectHandler` — no http/scheme/port downgrade on redirect;
     internal redirect target refused.
  5. `fetch_url` fail-closed — upstream status / transport detail is NOT
     echoed to the caller (blind-SSRF exfil channel, handoff item 5).
"""

from __future__ import annotations

import http.client
import ipaddress
import socket
import urllib.error

import pytest

from checks import url_fetcher
from checks._safe_http import (
    GuardedHTTPSConnection,
    HttpsOnlyRedirectHandler,
    SafeHttpError,
    ip_is_blocked,
)
from checks.url_fetcher import UrlFetchError, _check_url, fetch_url


# ---------------------------------------------------------------------------
# Layer 1 — range classifier
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "addr",
    [
        "127.0.0.1",
        "127.9.9.9",
        "10.0.0.5",
        "172.16.31.1",
        "192.168.1.1",
        "169.254.169.254",  # instance metadata — the classic SSRF target
        "100.64.0.1",  # CGNAT
        "0.0.0.0",
        "::1",
        "fc00::1",
        "fe80::1",
        "::",
        "::ffff:169.254.169.254",  # IPv4-mapped IPv6 hiding an internal v4
        "::ffff:127.0.0.1",
    ],
)
def test_blocked_addresses_are_blocked(addr: str) -> None:
    assert ip_is_blocked(ipaddress.ip_address(addr)) is True, f"{addr} should be blocked"


@pytest.mark.parametrize(
    "addr",
    ["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"],
)
def test_public_addresses_are_allowed(addr: str) -> None:
    assert ip_is_blocked(ipaddress.ip_address(addr)) is False, f"{addr} should be allowed"


# ---------------------------------------------------------------------------
# Layer 2 — scheme + port + hostname validation
# ---------------------------------------------------------------------------


def _public_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub resolution so `_check_url`'s advisory check passes."""
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_a, **_k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))],
    )


def test_non_https_scheme_refused() -> None:
    with pytest.raises(UrlFetchError) as ei:
        _check_url("http://example.com/x")
    assert ei.value.code == "url:scheme-not-https"


def test_file_scheme_refused() -> None:
    with pytest.raises(UrlFetchError) as ei:
        _check_url("file:///etc/passwd")
    assert ei.value.code == "url:scheme-not-https"


def test_no_hostname_refused() -> None:
    with pytest.raises(UrlFetchError) as ei:
        _check_url("https:///nohostpath")
    assert ei.value.code == "url:no-hostname"


def test_non_443_port_refused() -> None:
    with pytest.raises(UrlFetchError) as ei:
        _check_url("https://example.com:8080/x")
    assert ei.value.code == "url:port-not-allowed"


def test_explicit_443_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    _public_dns(monkeypatch)
    assert _check_url("https://example.com:443/x") == "https://example.com:443/x"


def test_hostname_resolving_internal_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_a, **_k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 0))],
    )
    with pytest.raises(UrlFetchError) as ei:
        _check_url("https://evil.example/latest/meta-data/")
    assert ei.value.code == "url:internal-address"


# ---------------------------------------------------------------------------
# Layer 3 — DNS-rebinding defense: validate the IP the socket really
# connected to, regardless of what the pre-connect lookup said.
# ---------------------------------------------------------------------------


class _FakeSock:
    def __init__(self, peer: str) -> None:
        self._peer = peer
        self.closed = False

    def getpeername(self) -> tuple[str, int]:
        return (self._peer, 443)

    def close(self) -> None:
        self.closed = True


def test_guarded_connection_refuses_internal_peer(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_super_connect(self: http.client.HTTPSConnection) -> None:
        self.sock = _FakeSock("169.254.169.254")  # type: ignore[assignment]

    monkeypatch.setattr(http.client.HTTPSConnection, "connect", fake_super_connect)
    conn = GuardedHTTPSConnection("rebind.example")
    with pytest.raises(SafeHttpError) as ei:
        conn.connect()
    assert ei.value.code == "internal-address"


def test_guarded_connection_allows_public_peer(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_super_connect(self: http.client.HTTPSConnection) -> None:
        self.sock = _FakeSock("93.184.216.34")  # type: ignore[assignment]

    monkeypatch.setattr(http.client.HTTPSConnection, "connect", fake_super_connect)
    GuardedHTTPSConnection("example.com").connect()  # must not raise


# ---------------------------------------------------------------------------
# Layer 4 — redirect handling: no downgrade, internal target refused.
# ---------------------------------------------------------------------------


def test_redirect_to_http_is_refused() -> None:
    with pytest.raises(SafeHttpError) as ei:
        HttpsOnlyRedirectHandler().redirect_request(
            None, None, 302, "Found", {}, "http://169.254.169.254/latest/meta-data/"  # type: ignore[arg-type]
        )
    assert ei.value.code == "scheme-not-https"


def test_redirect_to_internal_https_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_a, **_k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))],
    )
    with pytest.raises(SafeHttpError) as ei:
        HttpsOnlyRedirectHandler().redirect_request(
            None, None, 302, "Found", {}, "https://rebind.internal/x"  # type: ignore[arg-type]
        )
    assert ei.value.code == "internal-address"


# ---------------------------------------------------------------------------
# Layer 5 — fail closed: never echo upstream status / transport detail
# (blind-SSRF exfiltration channel, handoff item 5).
# ---------------------------------------------------------------------------


class _RaisingOpener:
    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    def open(self, _req: object, timeout: float | None = None) -> object:
        raise self._exc


def test_upstream_http_error_is_generic(monkeypatch: pytest.MonkeyPatch) -> None:
    _public_dns(monkeypatch)
    leaky = urllib.error.HTTPError(
        "https://pub.example/x", 500, "INTERNAL-SECRET-BANNER", {}, None  # type: ignore[arg-type]
    )
    monkeypatch.setattr(url_fetcher, "_build_opener", lambda: _RaisingOpener(leaky))
    with pytest.raises(UrlFetchError) as ei:
        fetch_url("https://pub.example/x")
    assert ei.value.code == "url:remote-error"
    # The upstream status + banner must NOT leak into the client-facing message.
    assert "500" not in ei.value.message
    assert "SECRET" not in ei.value.message.upper()


def test_transport_failure_is_generic(monkeypatch: pytest.MonkeyPatch) -> None:
    _public_dns(monkeypatch)
    leaky = ConnectionResetError("reset while talking to 10.0.0.5:6379 (redis)")
    monkeypatch.setattr(url_fetcher, "_build_opener", lambda: _RaisingOpener(leaky))
    with pytest.raises(UrlFetchError) as ei:
        fetch_url("https://pub.example/x")
    assert ei.value.code == "url:fetch-failed"
    assert "10.0.0.5" not in ei.value.message
    assert "redis" not in ei.value.message.lower()


def test_policy_refusal_message_is_surfaced(monkeypatch: pytest.MonkeyPatch) -> None:
    """A SafeHttpError from the guarded transport is OUR determination, not
    upstream data, so its message IS surfaced (mapped to a url: code)."""
    _public_dns(monkeypatch)
    refusal = SafeHttpError("internal-address", "resolved to blocked address 10.0.0.5")
    monkeypatch.setattr(url_fetcher, "_build_opener", lambda: _RaisingOpener(refusal))
    with pytest.raises(UrlFetchError) as ei:
        fetch_url("https://pub.example/x")
    assert ei.value.code == "url:internal-address"
