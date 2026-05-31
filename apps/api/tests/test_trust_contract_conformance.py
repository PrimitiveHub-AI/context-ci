"""Trust Contract v0.1 conformance suite — the executable spec.

The suite at `docs/trust-contract/conformance/` is the executable
definition of the Trust Contract v0.1 wire format (per ADR-0021).
When the spec text and the suite disagree, the suite wins and the
spec text gets a clarifying PR.

This pytest harness is what runs the suite against the PrimitiveHub
reference implementation. An external implementer of
`@primitivehub/verify` or any other consumer can port these tests to
their language; the JSON fixtures are the portable artifact.

Three layers of tests
---------------------
1. **Schema validation** — every `valid/*.json` passes the JSON
   Schema at `schema/v0.1.json`; every `invalid/*.json` either fails
   the schema OR fails the semantic verification below.
2. **Semantic validation** — for each `valid/*.json`, the content's
   SHA-256 matches `subject.contentDigest` (step 2 of the
   verification procedure). For each `invalid/*.json`, at least one
   normative step rejects it.
3. **Reference-implementation conformance** — the PrimitiveHub API,
   when serving a real noop-signed bundle, produces output that
   passes the same schema. This is the loop that keeps the
   implementation honest against the spec.
"""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator


# Path resolution: in the api container, docs/ is bind-mounted read-only
# at /repo/docs (see compose.override.yaml). On the host (pytest run
# directly without docker), it's at the repo root.
def _find_conformance_dir() -> Path:
    container_path = Path("/repo/docs/trust-contract/conformance")
    if container_path.is_dir():
        return container_path
    # Walk up from this file until we find docs/trust-contract/conformance
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "docs" / "trust-contract" / "conformance"
        if candidate.is_dir():
            return candidate
    msg = (
        "could not locate docs/trust-contract/conformance — checked "
        f"/repo/docs/... and parents of {here}"
    )
    raise FileNotFoundError(msg)


CONFORMANCE_DIR = _find_conformance_dir()
SCHEMA_PATH = CONFORMANCE_DIR / "schema" / "v0.1.json"
VALID_DIR = CONFORMANCE_DIR / "valid"
INVALID_DIR = CONFORMANCE_DIR / "invalid"


# ─────────────────────────────────────────────────────────────────────
# Suite-wide invariants
# ─────────────────────────────────────────────────────────────────────
def test_conformance_directory_layout() -> None:
    """The suite must have a recognizable layout. Sanity check."""
    assert CONFORMANCE_DIR.is_dir(), f"missing: {CONFORMANCE_DIR}"
    assert SCHEMA_PATH.is_file(), f"missing schema: {SCHEMA_PATH}"
    assert VALID_DIR.is_dir(), f"missing valid/: {VALID_DIR}"
    assert INVALID_DIR.is_dir(), f"missing invalid/: {INVALID_DIR}"


def test_at_least_ten_valid_fixtures() -> None:
    """PR 5.5.B floor; execution plan calls for ≥30 by end of Week 2."""
    valid_fixtures = list(VALID_DIR.glob("*.json"))
    assert len(valid_fixtures) >= 10, (
        f"only {len(valid_fixtures)} valid fixtures; suite floor is 10"
    )


def test_at_least_three_invalid_fixtures() -> None:
    """PR 5.5.B floor; execution plan calls for ≥10 by end of Week 2."""
    invalid_fixtures = list(INVALID_DIR.glob("*.json"))
    assert len(invalid_fixtures) >= 3, (
        f"only {len(invalid_fixtures)} invalid fixtures; suite floor is 3"
    )


def test_every_invalid_fixture_has_a_companion_md() -> None:
    """Every adversarial bundle MUST be accompanied by a .md describing
    what's wrong, which step rejects it, and why it matters. This is a
    contract for the suite, not optional documentation."""
    for json_path in INVALID_DIR.glob("*.json"):
        md_path = json_path.with_suffix(".md")
        assert md_path.is_file(), (
            f"adversarial fixture {json_path.name} has no companion {md_path.name}"
        )


# ─────────────────────────────────────────────────────────────────────
# Schema validation (per the JSON Schema in conformance/schema/v0.1.json)
# ─────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def schema_validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _all_valid_bundles() -> list[Path]:
    return sorted(VALID_DIR.glob("*.json"))


def _all_invalid_bundles() -> list[Path]:
    return sorted(INVALID_DIR.glob("*.json"))


@pytest.mark.parametrize("fixture", _all_valid_bundles(), ids=lambda p: p.stem)
def test_valid_fixtures_pass_schema(fixture: Path, schema_validator: Draft202012Validator) -> None:
    """Every valid/* fixture MUST pass the v0.1 JSON Schema."""
    bundle = json.loads(fixture.read_text(encoding="utf-8"))
    errors = list(schema_validator.iter_errors(bundle))
    assert not errors, f"{fixture.name} failed schema:\n  " + "\n  ".join(
        f"{list(e.absolute_path)}: {e.message}" for e in errors
    )


# Invalid fixtures that fail at the SCHEMA layer (no need to run
# semantic checks; the schema rejects them first). The fixture names
# encode the expected failure layer.
_INVALID_AT_SCHEMA = {
    "02-unknown-bundle-version.json",
    "03-unknown-backend.json",
}


@pytest.mark.parametrize("fixture", _all_invalid_bundles(), ids=lambda p: p.stem)
def test_invalid_fixtures_fail_at_expected_layer(
    fixture: Path, schema_validator: Draft202012Validator
) -> None:
    """Each invalid/* fixture must fail at the layer its companion .md
    documents — either schema (rejected before semantic checks) or
    semantic (passes schema, fails verification step 2/3/etc.)."""
    bundle = json.loads(fixture.read_text(encoding="utf-8"))
    errors = list(schema_validator.iter_errors(bundle))

    if fixture.name in _INVALID_AT_SCHEMA:
        assert errors, f"{fixture.name} is marked schema-rejected but passed schema"
        return

    # Otherwise, fixture is expected to PASS schema but fail a
    # downstream verification step. The next test enforces that.
    assert not errors, (
        f"{fixture.name} unexpectedly fails schema — should fail "
        f"semantic verification instead. Errors:\n  "
        + "\n  ".join(f"{list(e.absolute_path)}: {e.message}" for e in errors)
    )


# ─────────────────────────────────────────────────────────────────────
# Semantic validation — step 2 (content digest match)
# ─────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("fixture", _all_valid_bundles(), ids=lambda p: p.stem)
def test_valid_fixtures_pass_content_digest_check(fixture: Path) -> None:
    """Verification procedure step 2: decode content.bytesB64, hash it,
    confirm the hash equals subject.contentDigest. Every valid fixture
    MUST pass this check."""
    bundle = json.loads(fixture.read_text(encoding="utf-8"))
    content_b64 = bundle["content"]["bytesB64"]
    content_bytes = base64.b64decode(content_b64)
    assert len(content_bytes) == bundle["content"]["sizeBytes"], (
        f"{fixture.name}: sizeBytes mismatch"
    )
    actual = "sha256:" + hashlib.sha256(content_bytes).hexdigest()
    expected = bundle["subject"]["contentDigest"]
    assert actual == expected, (
        f"{fixture.name}: content digest mismatch\n  expected: {expected}\n  actual:   {actual}"
    )


def test_digest_mismatch_fixture_actually_mismatches() -> None:
    """The invalid/01-digest-mismatch.json fixture must actually
    exhibit the digest mismatch — i.e. recomputed digest does NOT
    equal subject.contentDigest. Without this, the test above would
    silently produce false positives."""
    fixture = INVALID_DIR / "01-digest-mismatch.json"
    bundle = json.loads(fixture.read_text(encoding="utf-8"))
    content_bytes = base64.b64decode(bundle["content"]["bytesB64"])
    actual = "sha256:" + hashlib.sha256(content_bytes).hexdigest()
    expected = bundle["subject"]["contentDigest"]
    assert actual != expected, (
        f"{fixture.name}: claims to be a digest-mismatch fixture but "
        "actually matches — fixture is broken"
    )


# ─────────────────────────────────────────────────────────────────────
# Reference-implementation conformance
#
# The PrimitiveHub HTTP Trust API, fed real noop-signed content,
# produces bundles that pass the same schema the suite enforces. This
# is the loop that catches drift between code and spec.
# ─────────────────────────────────────────────────────────────────────
def test_noop_backend_output_conforms_to_schema(
    schema_validator: Draft202012Validator,
) -> None:
    """A bundle synthesized via the noop backend (the same path
    test_trust_endpoints.py uses) MUST satisfy the v0.1 schema. If
    this fails, the API is producing non-conformant bundles in
    production-shape paths."""
    from registry.schemas import (
        TrustBundleAttestation,
        TrustBundleContent,
        TrustBundleOut,
        TrustBundleSubject,
    )
    from signing.backends import NoopSigstoreBackend
    from signing.statement import build_statement

    body = b"# Conformance probe\n\nfor noop backend output check.\n"
    digest = hashlib.sha256(body).hexdigest()
    statement = build_statement(
        subject_name="conformance-probe", subject_sha256_hex=digest, predicate={}
    )
    backend = NoopSigstoreBackend()
    result = backend.sign(statement, identity_token="t")

    bundle = TrustBundleOut(
        subject=TrustBundleSubject(
            slug="conformance-probe",
            semver="0.1.0",
            content_digest=f"sha256:{digest}",
        ),
        content=TrustBundleContent(
            bytes_b64=base64.b64encode(body).decode("ascii"),
            size_bytes=len(body),
        ),
        attestation=TrustBundleAttestation(
            predicate_type=result.backend_name
            and ("https://primitivehub.ai/context-ci/v0.1/Attestation"),
            predicate={},
            backend_name=result.backend_name,
            cert_chain_pem=result.cert_chain_pem,
            signature_b64=result.signature_b64,
            statement_b64=result.statement_b64,
            rekor_log_index=result.rekor_log_index,
            rekor_log_id=result.rekor_log_id,
            rekor_inclusion_proof_json=result.rekor_inclusion_proof_json,
            verify_url=result.verify_url,
            signed_at="2026-05-31T00:00:00+00:00",
        ),
    )
    # Pydantic Schema → dict via `model_dump(by_alias=True)` to mirror
    # the JSON the API emits over the wire (camelCase keys).
    # exclude_none mirrors the API's actual wire output — optional fields
    # are omitted, not serialized as null. (The JSON Schema treats
    # `detailUrl` as optional; null fails its type:string constraint.)
    bundle_dict = bundle.model_dump(by_alias=True, exclude_none=True)
    # The schema requires `signedAt` as a string; model_dump may produce
    # datetime depending on the field type — string-coerce defensively.
    if not isinstance(bundle_dict["attestation"]["signedAt"], str):
        bundle_dict["attestation"]["signedAt"] = str(bundle_dict["attestation"]["signedAt"])
    errors = list(schema_validator.iter_errors(bundle_dict))
    assert not errors, "noop backend produced a non-conformant bundle:\n  " + "\n  ".join(
        f"{list(e.absolute_path)}: {e.message}" for e in errors
    )
