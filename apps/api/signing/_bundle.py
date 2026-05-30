"""Bundle → SigningResult extraction.

Sigstore returns a `Bundle` (sigstore-bundle v0.3 protobuf-encoded
envelope) from `signer.sign_artifact()`. We extract the few fields we
need into our `SigningResult` dataclass.

Design choice: parse `Bundle.to_json()` (the canonical, public,
schema-stable sigstore representation) rather than poking
`Bundle._inner` directly. The underscore prefix is a contract — internal
fields can be renamed any release. The JSON is the public format that
cosign, sigstore-go, and other ecosystem tools consume.

We also store the full bundle JSON in `SigningResult.statement_b64`
(misnamed — kept for now; PR #4 may add a `bundle_json` field) so a
later verifier can re-construct the exact Bundle and run
`Bundle.from_json(...).verify(...)` against any of the three trust roots.
"""

from __future__ import annotations

import base64
import binascii
import json
from typing import TYPE_CHECKING

from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives.serialization import Encoding

from .exceptions import SigningFailedError
from .types import SigningResult

if TYPE_CHECKING:
    from sigstore.models import Bundle


def bundle_to_signing_result(
    *,
    bundle: Bundle,
    backend_name: str,
    statement_bytes: bytes,
    verify_url: str,
) -> SigningResult:
    """Pack a sigstore `Bundle` into our `SigningResult` shape.

    Raises `SigningFailedError` if the bundle is missing required fields
    we need (defensive — sigstore-python's Bundle invariants should
    prevent this, but a malformed bundle = silent corruption, so we
    fail loudly instead).
    """
    try:
        bundle_dict = json.loads(bundle.to_json())
    except (TypeError, ValueError, AttributeError) as exc:
        msg = f"sigstore Bundle.to_json() did not parse as JSON: {exc}"
        raise SigningFailedError(msg) from exc

    # ── Leaf cert + intermediates as a PEM chain ────────────────────────
    # bundle.signing_certificate is a cryptography x509.Certificate.
    # PEM-encode it; chain root certs come from the trust root, not the
    # bundle, so the chain here is just the leaf. (Verifiers reconstruct
    # the full chain via the trust root.)
    try:
        cert = bundle.signing_certificate
        cert_chain_pem = cert.public_bytes(Encoding.PEM).decode("ascii")
    except (AttributeError, ValueError, UnsupportedAlgorithm) as exc:
        msg = f"could not extract signing certificate PEM from bundle: {exc}"
        raise SigningFailedError(msg) from exc

    # ── Raw signature ──────────────────────────────────────────────────
    try:
        signature_bytes: bytes = bundle.signature
    except AttributeError as exc:
        msg = "bundle is missing signature bytes"
        raise SigningFailedError(msg) from exc
    signature_b64 = base64.b64encode(signature_bytes).decode("ascii")

    # ── Rekor log entry fields ──────────────────────────────────────────
    # sigstore-bundle v0.3 JSON shape:
    #   {"verificationMaterial": {"tlogEntries": [
    #     {"logIndex": "12345",
    #      "logId": {"keyId": "<base64-bytes>"},
    #      "inclusionProof": {...},
    #      ...}
    #   ]}}
    try:
        tlog_entries = bundle_dict["verificationMaterial"]["tlogEntries"]
        if not tlog_entries:
            msg = "bundle has no transparency log entries"
            raise SigningFailedError(msg)
        entry = tlog_entries[0]
        rekor_log_index = int(entry["logIndex"])
        rekor_log_id_b64 = entry["logId"]["keyId"]
        # log_id is the SHA-256 of Rekor's public key. We store the hex
        # form because that's what rekor-cli + rekor-search display.
        try:
            rekor_log_id_hex = binascii.hexlify(base64.b64decode(rekor_log_id_b64)).decode("ascii")
        except binascii.Error as exc:
            msg = f"bundle log_id is not valid base64: {exc}"
            raise SigningFailedError(msg) from exc
        rekor_inclusion_proof_json = json.dumps(
            entry["inclusionProof"], sort_keys=True, separators=(",", ":")
        )
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        msg = f"bundle is missing required Rekor entry fields: {exc}"
        raise SigningFailedError(msg) from exc

    return SigningResult(
        backend_name=backend_name,
        cert_chain_pem=cert_chain_pem,
        signature_b64=signature_b64,
        rekor_log_index=rekor_log_index,
        rekor_log_id=rekor_log_id_hex,
        rekor_inclusion_proof_json=rekor_inclusion_proof_json,
        statement_b64=base64.b64encode(statement_bytes).decode("ascii"),
        verify_url=verify_url,
    )
