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

from ._bundle import bundle_to_signing_result
from .exceptions import (
    BackendConfigurationError,
    SigningFailedError,
    UnknownBackendError,
)
from .types import SigningResult

if TYPE_CHECKING:
    from collections.abc import Callable

    from sigstore.models import ClientTrustConfig
    from sigstore.sign import SigningContext


def _sign_via_sigstore(
    *,
    signing_context: SigningContext,
    statement_bytes: bytes,
    identity_token: str,
    backend_name: str,
    verify_url_builder: Callable[[int], str],
) -> SigningResult:
    """Shared signing path for the three real backends.

    Wraps three failure modes uniformly:
      * IdentityToken construction fails (token malformed / expired)
      * Signer raises (Fulcio rejects, Rekor unreachable, network)
      * Bundle extraction fails (sigstore-python returns a bundle that
        doesn't match the v0.3 schema — would be a sigstore-python bug)

    All three become `SigningFailedError`; the original exception is
    preserved via `__cause__` so Procrastinate's retry logic (PR #4)
    can inspect it to decide whether to retry or give up.
    """
    from sigstore.oidc import IdentityToken

    try:
        token = IdentityToken(identity_token)
    except Exception as exc:
        msg = f"OIDC identity token rejected by sigstore: {exc}"
        raise SigningFailedError(msg) from exc

    try:
        with signing_context.signer(token) as signer:
            bundle = signer.sign_artifact(statement_bytes)
    except Exception as exc:
        msg = f"sigstore sign_artifact failed: {exc}"
        raise SigningFailedError(msg) from exc

    # Pull the log_index out of the bundle FIRST so we can build the
    # verify_url before constructing the SigningResult.
    # bundle.log_entry → TransparencyLogEntry which has _inner.log_index.
    # We use the bundle JSON path for stability.
    import json as _json

    try:
        bundle_dict = _json.loads(bundle.to_json())
        first_entry = bundle_dict["verificationMaterial"]["tlogEntries"][0]
        log_index = int(first_entry["logIndex"])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        msg = f"could not read log_index from bundle for verify_url: {exc}"
        raise SigningFailedError(msg) from exc

    verify_url = verify_url_builder(log_index)

    return bundle_to_signing_result(
        bundle=bundle,
        backend_name=backend_name,
        statement_bytes=statement_bytes,
        verify_url=verify_url,
    )


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
        return _sign_via_sigstore(
            signing_context=self._signing_context(),
            statement_bytes=statement_bytes,
            identity_token=identity_token,
            backend_name=self.name,
            verify_url_builder=self.verify_url_for_rekor_entry,
        )

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
        return _sign_via_sigstore(
            signing_context=self._signing_context(),
            statement_bytes=statement_bytes,
            identity_token=identity_token,
            backend_name=self.name,
            verify_url_builder=self.verify_url_for_rekor_entry,
        )

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
        return _sign_via_sigstore(
            signing_context=self._signing_context(),
            statement_bytes=statement_bytes,
            identity_token=identity_token,
            backend_name=self.name,
            verify_url_builder=self.verify_url_for_rekor_entry,
        )

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
        import json as _json

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
        # rekor_log_id MUST be 64 hex chars per Trust Contract v0.1 § 5.4.
        # Deterministic synthesis from a fixed namespace + the statement
        # digest keeps test bundles reproducible AND schema-conformant.
        fake_log_id = hashlib.sha256(f"noop:rekor-keyid:{digest}".encode("ascii")).hexdigest()
        # rekor_inclusion_proof_json MUST contain the canonical keys
        # (logIndex, rootHash, treeSize, hashes, checkpoint) per the
        # Trust Contract spec. A synthetic but schema-correct value is
        # what conformance demands.
        fake_inclusion_proof = _json.dumps(
            {
                "logIndex": log_index,
                "rootHash": digest,  # deterministic from statement
                "treeSize": log_index + 1,
                "hashes": [],  # empty proof is valid for a tree of size 1
                "checkpoint": {"envelope": f"noop checkpoint for {digest[:16]}"},
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return SigningResult(
            backend_name=self.name,
            cert_chain_pem=fake_cert_pem,
            signature_b64=fake_signature,
            rekor_log_index=log_index,
            rekor_log_id=fake_log_id,
            rekor_inclusion_proof_json=fake_inclusion_proof,
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
