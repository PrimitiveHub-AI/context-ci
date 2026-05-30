"""SigstoreBackend Protocol + four implementations.

The Protocol is the boundary between PrimitiveHub's signing pipeline
and any specific Sigstore deployment. Choosing a backend is one env
var; the rest of the code never branches on which one.

Production deployments
----------------------

  public        — public Sigstore (Fulcio + Rekor at sigstore.dev).
                  v1 public registry uses this.
  staging       — Sigstore staging (sigstage.dev). Dev default; doesn't
                  pollute the public transparency log.
  self-hosted   — operator-supplied trust root (Phase 7 enterprise).

Test backend
------------

  noop          — fixed deterministic SigningResult, no network. Used
                  in unit tests where we want to verify the wiring of
                  the call site, not the cryptography.

How sign() works (when wired in PR #3)
--------------------------------------

The real backends construct a `sigstore.sign.SigningContext` from a
`ClientTrustConfig`, then `signer(identity_token).sign_artifact(payload)`
returns a `Bundle`. We extract:

  * leaf certificate + intermediates from `bundle.signing_certificate`
  * raw signature from `bundle.signature`
  * Rekor entry from `bundle.log_entry` (log_index, log_id, inclusion proof)

…and pack into `SigningResult`. The actual implementation of sign() on
the real backends ships in `feat/api-sigstore-keyless-signing` (Phase 4
PR #3) — kept separate so the abstraction lands in isolation and is
reviewable on its own merits.
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from django.conf import settings

from .exceptions import (
    BackendConfigurationError,
    SigningFailedError,
    UnknownBackendError,
)
from .types import SigningResult

if TYPE_CHECKING:
    from sigstore.models import ClientTrustConfig
    from sigstore.sign import SigningContext


# Backend names accepted in SIGSTORE_BACKEND env. Public is "production"
# in sigstore-python's vocabulary; we use "public" to match how the
# user-facing copy reads ("public registry").
_BACKEND_PUBLIC = "public"
_BACKEND_STAGING = "staging"
_BACKEND_SELF_HOSTED = "self-hosted"
_BACKEND_NOOP = "noop"

ALL_BACKEND_NAMES = (_BACKEND_PUBLIC, _BACKEND_STAGING, _BACKEND_SELF_HOSTED, _BACKEND_NOOP)


class SigstoreBackend(Protocol):
    """The signing-pipeline boundary.

    Every backend exposes the same surface. Callers never need to know
    which one they got; that's the whole point.
    """

    name: str
    rekor_url: str

    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult:
        """Sign `statement_bytes` and submit the entry to Rekor.

        `identity_token` is the user's OIDC ID token (a JWT from
        Authentik in our setup). Fulcio binds the resulting ephemeral
        signing cert to the token's sub + iss claims.

        Returns a fully-populated `SigningResult`. Raises
        `SigningFailedError` on network/auth/protocol failures.
        """
        ...

    def verify_url_for_rekor_entry(self, log_index: int) -> str:
        """Human-readable URL to inspect a Rekor entry by log index.

        Used by the web app's attestation badge (Phase 4 PR #5) to
        deep-link the user into the appropriate Rekor search UI. The
        URL shape differs per backend (sigstore.dev vs sigstage.dev
        vs whatever the self-hosted operator configured).
        """
        ...


# ─────────────────────────────────────────────────────────────────────────────
# Public Sigstore — production posture
# ─────────────────────────────────────────────────────────────────────────────
class PublicSigstoreBackend:
    name = _BACKEND_PUBLIC
    rekor_url = "https://rekor.sigstore.dev"
    _verify_search_base = "https://search.sigstore.dev"

    def _trust_config(self) -> ClientTrustConfig:
        from sigstore.models import ClientTrustConfig

        return ClientTrustConfig.production()

    def _signing_context(self) -> SigningContext:
        from sigstore.sign import SigningContext

        return SigningContext.from_trust_config(self._trust_config())

    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult:
        msg = (
            "PublicSigstoreBackend.sign() is wired but the call into "
            "sigstore-python ships in feat/api-sigstore-keyless-signing "
            "(Phase 4 PR #3). The abstraction landed in isolation so "
            "it could be reviewed on its own merits."
        )
        raise SigningFailedError(msg)

    def verify_url_for_rekor_entry(self, log_index: int) -> str:
        return f"{self._verify_search_base}/?logIndex={log_index}"


# ─────────────────────────────────────────────────────────────────────────────
# Sigstore staging — dev default
# ─────────────────────────────────────────────────────────────────────────────
class SigstageBackend:
    name = _BACKEND_STAGING
    rekor_url = "https://rekor.sigstage.dev"
    _verify_search_base = "https://search.sigstage.dev"

    def _trust_config(self) -> ClientTrustConfig:
        from sigstore.models import ClientTrustConfig

        return ClientTrustConfig.staging()

    def _signing_context(self) -> SigningContext:
        from sigstore.sign import SigningContext

        return SigningContext.from_trust_config(self._trust_config())

    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult:
        msg = "SigstageBackend.sign() ships in Phase 4 PR #3 — see PublicSigstoreBackend."
        raise SigningFailedError(msg)

    def verify_url_for_rekor_entry(self, log_index: int) -> str:
        return f"{self._verify_search_base}/?logIndex={log_index}"


# ─────────────────────────────────────────────────────────────────────────────
# Self-hosted Sigstore — Phase 7 enterprise
# ─────────────────────────────────────────────────────────────────────────────
class SelfHostedSigstoreBackend:
    """Wraps an operator-supplied Sigstore deployment.

    Requires a local trust root JSON file (the operator's TUF repo
    output, or a hand-authored ClientTrustConfig). The file path is
    `SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH`; the Rekor URL is
    `SIGSTORE_SELF_HOSTED_REKOR_URL`.

    This backend exists in PR #2 to LOCK THE INTERFACE. Phase 7
    customers can wire their own Sigstore in without us re-doing the
    abstraction.
    """

    name = _BACKEND_SELF_HOSTED

    def __init__(
        self, *, trust_config_path: Path, rekor_url: str, verify_url_template: str
    ) -> None:
        if not trust_config_path.is_file():
            msg = (
                f"SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH={trust_config_path} "
                "does not exist or is not a file"
            )
            raise BackendConfigurationError(msg)
        self._trust_config_path = trust_config_path
        self.rekor_url = rekor_url
        self._verify_url_template = verify_url_template

    def _trust_config(self) -> ClientTrustConfig:
        from sigstore.models import ClientTrustConfig

        contents = self._trust_config_path.read_text(encoding="utf-8")
        return ClientTrustConfig.from_json(contents)

    def _signing_context(self) -> SigningContext:
        from sigstore.sign import SigningContext

        return SigningContext.from_trust_config(self._trust_config())

    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult:
        msg = "SelfHostedSigstoreBackend.sign() ships in Phase 4 PR #3."
        raise SigningFailedError(msg)

    def verify_url_for_rekor_entry(self, log_index: int) -> str:
        return self._verify_url_template.format(log_index=log_index)


# ─────────────────────────────────────────────────────────────────────────────
# Noop backend — tests only
# ─────────────────────────────────────────────────────────────────────────────
class NoopSigstoreBackend:
    """Deterministic SigningResult with zero side effects.

    Tests of the call site (`feat/api-sign-on-upload` PR #3, or any
    future caller) use this to verify wiring without depending on
    sigstore-python's network calls or OIDC tokens. The result is
    deterministic per statement bytes so test assertions can be exact.
    """

    name = _BACKEND_NOOP
    rekor_url = "noop://"
    _verify_url_template = "noop://entry/{log_index}"

    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult:
        digest = hashlib.sha256(statement_bytes).hexdigest()
        # Synthetic but valid-shaped PEM. Useful in tests that parse
        # the field as PEM and want a non-empty value.
        fake_cert_pem = (
            "-----BEGIN CERTIFICATE-----\n"
            f"NOOP-BACKEND-DETERMINISTIC-{digest[:32]}\n"
            "-----END CERTIFICATE-----\n"
        )
        fake_signature = base64.b64encode(digest.encode("ascii")).decode("ascii")
        # log_index derived from statement digest so identical statements
        # produce identical results (idempotent test fixtures).
        log_index = int(digest[:8], 16)
        return SigningResult(
            backend_name=self.name,
            cert_chain_pem=fake_cert_pem,
            signature_b64=fake_signature,
            rekor_log_index=log_index,
            rekor_log_id=f"noop-log-id-{digest[:16]}",
            rekor_inclusion_proof_json='{"backend": "noop", "verified": true}',
            statement_b64=base64.b64encode(statement_bytes).decode("ascii"),
            verify_url=self.verify_url_for_rekor_entry(log_index),
        )

    def verify_url_for_rekor_entry(self, log_index: int) -> str:
        return self._verify_url_template.format(log_index=log_index)


# ─────────────────────────────────────────────────────────────────────────────
# Factory — env-driven selection
# ─────────────────────────────────────────────────────────────────────────────
def get_backend() -> SigstoreBackend:
    """Resolve the configured backend from Django settings.

    Reads `SIGSTORE_BACKEND` and returns the corresponding backend
    instance. For self-hosted, also requires
    `SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH`,
    `SIGSTORE_SELF_HOSTED_REKOR_URL`, and
    `SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE`.

    Fails LOUDLY:
      * `UnknownBackendError` — env value not in `ALL_BACKEND_NAMES`.
      * `BackendConfigurationError` — required self-hosted config
        missing or trust config file unreadable.

    We never silently fall back. A misconfigured deploy is preferable
    over signing real primitives with the wrong backend.
    """
    name = getattr(settings, "SIGSTORE_BACKEND", _BACKEND_STAGING)

    if name == _BACKEND_PUBLIC:
        return PublicSigstoreBackend()
    if name == _BACKEND_STAGING:
        return SigstageBackend()
    if name == _BACKEND_NOOP:
        return NoopSigstoreBackend()
    if name == _BACKEND_SELF_HOSTED:
        trust_path = getattr(settings, "SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH", "")
        rekor_url = getattr(settings, "SIGSTORE_SELF_HOSTED_REKOR_URL", "")
        verify_tpl = getattr(settings, "SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE", "")
        if not trust_path or not rekor_url or not verify_tpl:
            msg = (
                "SIGSTORE_BACKEND=self-hosted requires "
                "SIGSTORE_SELF_HOSTED_TRUST_CONFIG_PATH, "
                "SIGSTORE_SELF_HOSTED_REKOR_URL, "
                "SIGSTORE_SELF_HOSTED_VERIFY_URL_TEMPLATE to be set."
            )
            raise BackendConfigurationError(msg)
        return SelfHostedSigstoreBackend(
            trust_config_path=Path(trust_path),
            rekor_url=rekor_url,
            verify_url_template=verify_tpl,
        )

    msg = f"SIGSTORE_BACKEND={name!r} is not recognized. Valid values: {ALL_BACKEND_NAMES}."
    raise UnknownBackendError(msg)
