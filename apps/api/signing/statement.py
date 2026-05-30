"""Build the in-toto Statement that gets signed.

The Statement is the canonical attestation envelope from in-toto spec
v1.0. It binds:

  * a **subject** — what we're attesting about (a PrimitiveVersion's
    content, identified by sha256 digest);
  * a **predicate type** — a URI that names the predicate schema we
    use (PrimitiveHub's Context CI Attestation, v0.1);
  * a **predicate** — the actual claim payload (validation outcomes,
    threat-model coverage, reviewer signatures — defined in PR #3).

The PredicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`
is locked in `docs/spec.md` and cited by the paper. Do not change it
without coordinating with the spec doc and ADR-supersede process.

We use the in-toto-attestation library (Google's reference Python impl)
rather than hand-rolling the dict. It enforces the schema and produces
a canonical serialization that's compatible with cosign/rekor verifiers.
"""

from __future__ import annotations

import base64
import re
from typing import Any

from in_toto_attestation.v1 import (  # type: ignore[import-untyped]
    resource_descriptor_pb2,
    statement_pb2,
)

from .exceptions import StatementValidationError

# Locked by docs/spec.md § Attestation. Cited by the arXiv paper.
PRIMITIVEHUB_PREDICATE_TYPE = "https://primitivehub.ai/context-ci/v0.1/Attestation"

# in-toto v1 Statement type identifier.
IN_TOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1"

# A subject name should look like a primitive slug — lowercase, kebab,
# segment-bounded. Reject anything else loudly: an invalid subject name
# would still produce a parseable Statement, but it'd anchor the
# attestation to the wrong thing.
_VALID_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")


def build_statement(
    *,
    subject_name: str,
    subject_sha256_hex: str,
    predicate: dict[str, Any],
    predicate_type: str = PRIMITIVEHUB_PREDICATE_TYPE,
) -> bytes:
    """Build and serialize an in-toto Statement.

    Returns the canonical bytes payload that Sigstore will sign over.

    Parameters
    ----------
    subject_name
        Human-readable identifier for what's being attested. By
        convention: the primitive slug (e.g. `elite-mobile-design`).
        Must be a valid primitive slug shape.
    subject_sha256_hex
        Lowercase hex digest of the primitive content. Must be exactly
        64 hex chars (256 bits). This is the load-bearing identity —
        the cert binds to the signer, the Statement binds the signer's
        intent to THIS content.
    predicate
        The Context CI payload. Structure defined in `docs/spec.md` §
        Predicate schema. Empty dict is legal (and what PR #2 tests
        use) — a real predicate lands in PR #3.
    predicate_type
        Schema URI for the predicate. Defaults to PrimitiveHub's locked
        type; only override for cross-ecosystem experiments (e.g.
        attesting an SLSA Provenance predicate for compatibility tests).

    Returns
    -------
    bytes
        Protobuf-serialized Statement. Callers pass this directly to
        `SigstoreBackend.sign()`.

    Raises
    ------
    StatementValidationError
        If `subject_name` doesn't match the slug shape, or
        `subject_sha256_hex` isn't 64 hex chars. Both indicate a
        programming error in the caller — the user can't produce
        invalid input that reaches here.
    """
    if not _VALID_SLUG.match(subject_name):
        msg = f"subject_name {subject_name!r} is not a valid primitive slug"
        raise StatementValidationError(msg)
    if len(subject_sha256_hex) != 64 or not all(
        c in "0123456789abcdef" for c in subject_sha256_hex
    ):
        msg = (
            f"subject_sha256_hex must be 64 lowercase hex chars, "
            f"got {len(subject_sha256_hex)} chars: {subject_sha256_hex[:16]}..."
        )
        raise StatementValidationError(msg)

    subject = resource_descriptor_pb2.ResourceDescriptor(
        name=subject_name,
        digest={"sha256": subject_sha256_hex},
    )

    statement = statement_pb2.Statement(
        type=IN_TOTO_STATEMENT_TYPE,
        subject=[subject],
        predicate_type=predicate_type,
    )
    # Predicate is a `Struct` (google.protobuf.Struct). The proto wrapper
    # accepts a Python dict via the dict-init pattern.
    statement.predicate.update(predicate)

    serialized: bytes = statement.SerializeToString()
    return serialized


def serialize_for_storage(statement_bytes: bytes) -> str:
    """Base64-encode a Statement for storage in `SigningResult.statement_b64`."""
    return base64.b64encode(statement_bytes).decode("ascii")
