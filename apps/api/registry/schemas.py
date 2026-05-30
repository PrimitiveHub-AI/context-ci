"""Ninja Pydantic schemas for the registry surface.

These schemas are the contract the frontend (Step 4) will read against. Keys
are camelCase on the wire to match `apps/web/lib/types.ts`. The frontend's
existing `Primitive` interface dictates what fields must appear; this file
is the single point where API ↔ frontend types stay aligned.

Deferred fields (return defaults until later phases):
  - downloads     → 0      (Phase 6: append-event counter per DDIA)
  - reviewerBadge → null   (Phase 4: human-review workflow)
"""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — Pydantic needs runtime access
from typing import Any

from ninja import Schema
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel


class CamelSchema(Schema):
    """Base schema that emits camelCase JSON keys but accepts snake_case in code.

    Ninja's response serialization calls `model_dump()` without `by_alias=True`,
    so we override the method to force-emit aliases.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        kwargs.setdefault("by_alias", True)
        return super().model_dump(**kwargs)

    def model_dump_json(self, **kwargs: Any) -> str:
        kwargs.setdefault("by_alias", True)
        return super().model_dump_json(**kwargs)


class RegistryOut(CamelSchema):
    id: str
    slug: str
    name: str
    visibility: str
    organization_slug: str
    created_at: datetime


class RepositoryOut(CamelSchema):
    id: str
    slug: str
    name: str
    description: str
    registry_slug: str
    organization_slug: str
    created_at: datetime


class PrimitiveOut(CamelSchema):
    """Shape mirrors `apps/web/lib/types.ts:Primitive`. Field-by-field parity
    is enforced by `tests/test_parity.py`."""

    slug: str
    name: str
    file_name: str
    category: str
    description: str
    author: str
    version: str
    tokens: int
    token_budget: int
    quality_score: int
    safety_score: int
    context_efficiency: int
    agent_impact: int
    status: str
    compatible_agents: list[str]
    license: str
    last_updated: str
    use_when: list[str]
    do_not_use_when: list[str]
    risk_level: str
    content_digest: str
    install_command: str
    downloads: int = 0
    reviewer_badge: str | None = None


class PrimitiveVersionOut(CamelSchema):
    """Per-version detail. Used by /primitives/{slug}/versions/{semver}."""

    semver: str
    content_digest: str
    storage_key: str
    tokens: int
    token_budget: int
    license: str
    spec_version: str
    verdict: str
    submitted_at: datetime
    attested_at: datetime | None = None
    quality_score: int | None = None
    safety_score: int | None = None
    efficiency_score: int | None = None
    impact_score: int | None = None
    compatible_agents: list[str]
    use_when: list[str]
    do_not_use_when: list[str]


class AttestationOut(CamelSchema):
    """Context CI attestation record (in-toto Statement).

    Phase 4 PR #4 added the signing-pipeline fields (status,
    backend_name, cert, signature, Rekor fields, statement bytes).
    Empty/null until the Procrastinate sign_version task completes —
    `status` is the source of truth for "is this signed yet?".
    """

    id: str
    status: str
    attempts: int
    failure_reason: str | None = None
    predicate_type: str
    predicate: dict[str, Any]
    threat_model_version: str
    spec_version: str

    # Sigstore signing fields (populated when status=signed)
    backend_name: str | None = None
    cert_chain_pem: str | None = None
    signature_b64: str | None = None
    statement_b64: str | None = None
    rekor_log_index: int | None = None
    rekor_log_id: str | None = None
    rekor_inclusion_proof_json: str | None = None
    verify_url: str | None = None

    # Legacy / supplementary
    rekor_entry_id: str | None = None
    signed_at: datetime | None = None
    recorded_at: datetime


class PrimitivePage(CamelSchema):
    """A cursor-paginated page of primitives."""

    items: list[PrimitiveOut]
    next_cursor: str | None = None
    page_size: int


# ─────────────────────────────────────────────────────────────────────
# Trust bundle (Phase 5.5 — runtime trust API)
# ─────────────────────────────────────────────────────────────────────
#
# `BundleOut` is the canonical artifact returned by /api/v1/trust/*
# endpoints. It bundles:
#   - the primitive content bytes (base64),
#   - the Sigstore bundle (cert chain + signature + Rekor inclusion
#     proof) — sufficient for OFFLINE verification,
#   - the Context CI verdicts from the attestation predicate.
#
# A consumer (CLI, MCP server, custom agent) can verify a bundle WITHOUT
# calling back to PrimitiveHub: the Sigstore trust root is bundled in
# every verifier; the inclusion proof is in the bundle; the digest
# binds the content. This is the wire contract for the
# `application/vnd.primitivehub.bundle+json` media type defined in
# `docs/spec.md` § Bundle and ADR-0013.


class TrustBundleSubject(CamelSchema):
    """The primitive being attested — name + digest."""

    slug: str
    semver: str
    content_digest: str  # "sha256:<hex>"


class TrustBundleContent(CamelSchema):
    """The actual primitive bytes, base64-encoded.

    Stored separately from the attestation so a consumer that already
    trusts a cached copy (digest match) can skip re-downloading.
    """

    bytes_b64: str
    size_bytes: int
    media_type: str = "text/markdown; charset=utf-8"


class TrustBundleAttestation(CamelSchema):
    """The cryptographic attestation — Sigstore bundle + Context CI
    verdicts. Field shapes mirror AttestationOut; this is a subset
    focused on what a verifier needs.
    """

    predicate_type: str
    predicate: dict[str, Any]
    backend_name: str
    cert_chain_pem: str
    signature_b64: str
    statement_b64: str
    rekor_log_index: int
    rekor_log_id: str
    rekor_inclusion_proof_json: str
    verify_url: str
    signed_at: datetime


class TrustBundleOut(CamelSchema):
    """The trust bundle — what /api/v1/trust/* returns.

    Self-contained: a verifier with the Sigstore trust root can
    validate this bundle without further network calls. The wire
    contract is locked in `docs/spec.md` § Bundle (ADR-0013).

    Naming note: there's also a `BundleOut` in this module for
    marketplace bundles (curated collections of primitives). They are
    UNRELATED — different domain, different consumers. Renaming the
    marketplace one would touch the web app + tests; leaving them
    distinct via the `Trust` prefix is the lower-risk move.
    """

    bundle_version: str = "0.1"
    subject: TrustBundleSubject
    content: TrustBundleContent
    attestation: TrustBundleAttestation
    # Convenience back-link to the human-browsable detail page on
    # this PrimitiveHub instance; consumers may ignore this.
    detail_url: str | None = None
