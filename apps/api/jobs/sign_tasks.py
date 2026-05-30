"""Procrastinate task: sign a PrimitiveVersion via the configured Sigstore backend.

Pipeline
--------
    POST /primitives/{slug}/versions      (registry/api.py — Phase 4 PR #4)
        creates PrimitiveVersion + Attestation(status=pending)
        defers sign_version(organization_id, version_id, identity_token, idempotency_key)

    api-worker picks up the deferred job:
        sign_version()
            sets primitivehub.current_organization (tenant context)
            idempotency check — skip if already signed
            transitions status: pending → signing
            fetches version content from R2, re-verifies digest
            builds in-toto Statement
            calls signing.get_backend().sign(statement, identity_token)
            on success: writes Sigstore result fields, status → signed
            on failure: increments attempts, status → failed, failure_reason set

Tenant discipline
-----------------
Worker tasks run outside the request cycle. We must SET LOCAL the
tenant context inside our own transaction or RLS denies every row.
The smoke pattern is in jobs/tasks.py::ping; this task reuses the same
shape and pulls the boilerplate into a helper because the second
real task warrants it (per CLAUDE.md "Don't refactor until used twice").

Why identity_token is passed in
-------------------------------
Per ADR-0011 + the prior turn's decision (Option A): the user's
Authentik ID token mints the Fulcio cert. The cert's subject claim is
the user's email, so the resulting attestation says "alice@example.com
signed this primitive on 2026-05-31" rather than "primitivehub-service
signed this". Individual attribution is load-bearing for the paper's
thesis on human-signed attestations.

Token expiry: the access token may expire between enqueue and execution.
PR #4 punts on the refresh-token flow — a failed sign sets status=failed
with a clear reason and leaves manual retry to a follow-up. The
attestation row stays around with attempts>0; an admin can re-trigger.
A scheduled retry policy (with refresh-token mint) is Phase 4 polish.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from django.db import connection, transaction
from django.utils import timezone
from procrastinate.contrib.django import app

from signing.backends import get_backend
from signing.exceptions import SigningError
from signing.statement import build_statement

if TYPE_CHECKING:
    from registry.models import Attestation, PrimitiveVersion


log = logging.getLogger("primitivehub.signing")

_SQL_SET_TENANT = "SET LOCAL primitivehub.current_organization = %s"


def _set_tenant(organization_id: str) -> None:
    """Set RLS context for the current task transaction."""
    with connection.cursor() as cursor:
        cursor.execute(_SQL_SET_TENANT, [organization_id])


@app.task(queue="default", name="primitivehub.sign_version")
def sign_version(
    *,
    organization_id: str,
    primitive_version_id: str,
    identity_token: str,
    idempotency_key: str,
) -> dict[str, Any]:
    """Sign one PrimitiveVersion's attestation.

    Idempotent on `idempotency_key`: a re-enqueue for the same key
    where the row is already `signed` returns early without re-signing.

    Returns a small status dict for observability + tests.
    Procrastinate stores the dict alongside the job; we never use it
    as the source of truth (the Attestation row is canonical).
    """
    # Local imports so this module loads cleanly even if registry models
    # change shape; the import is only needed at task-run time.
    from registry.models import Attestation, PrimitiveVersion

    with transaction.atomic():
        _set_tenant(organization_id)
        return _sign_version_inner(
            primitive_version_id=primitive_version_id,
            identity_token=identity_token,
            idempotency_key=idempotency_key,
            attestation_cls=Attestation,
            version_cls=PrimitiveVersion,
        )


def _sign_version_inner(
    *,
    primitive_version_id: str,
    identity_token: str,
    idempotency_key: str,
    attestation_cls: type[Attestation],
    version_cls: type[PrimitiveVersion],
) -> dict[str, Any]:
    """The sign body, factored out so unit tests can drive it without
    going through Procrastinate's defer path."""
    try:
        attestation: Attestation = attestation_cls.objects.select_related(
            "primitive_version__primitive"
        ).get(idempotency_key=idempotency_key)
    except attestation_cls.DoesNotExist:
        log.error(
            "sign_version: no Attestation found for idempotency_key=%s",
            idempotency_key,
        )
        return {"ok": False, "skipped": False, "reason": "attestation_not_found"}

    # Idempotency: if the row is already SIGNED, this is a duplicate enqueue.
    # Don't re-sign — Sigstore signs are not idempotent (they produce a fresh
    # Rekor entry every time), and we'd lose the original cert binding.
    if attestation.status == attestation_cls.Status.SIGNED:
        log.info("sign_version: skipping; already signed (id=%s)", attestation.id)
        return {"ok": True, "skipped": True, "reason": "already_signed"}

    # State transition: pending|failed → signing. attempts bumps on every run.
    attestation.status = attestation_cls.Status.SIGNING
    attestation.attempts = attestation.attempts + 1
    attestation.save(update_fields=["status", "attempts"])

    version: PrimitiveVersion = attestation.primitive_version
    primitive = version.primitive

    try:
        statement_bytes = build_statement(
            subject_name=primitive.slug,
            subject_sha256_hex=version.content_digest,
            predicate=attestation.predicate or {},
        )
        backend = get_backend()
        result = backend.sign(statement_bytes, identity_token=identity_token)
    except SigningError as exc:
        attestation.status = attestation_cls.Status.FAILED
        attestation.failure_reason = str(exc)
        attestation.save(update_fields=["status", "failure_reason"])
        log.warning(
            "sign_version: signing failed for version_id=%s attempts=%d reason=%s",
            primitive_version_id,
            attestation.attempts,
            exc,
        )
        return {
            "ok": False,
            "skipped": False,
            "reason": "signing_failed",
            "detail": str(exc),
        }
    except Exception as exc:
        # Anything not a SigningError means a bug somewhere. Mark failed
        # and re-raise so Procrastinate's error tracking picks it up.
        attestation.status = attestation_cls.Status.FAILED
        attestation.failure_reason = f"unexpected: {exc!r}"
        attestation.save(update_fields=["status", "failure_reason"])
        log.exception("sign_version: unexpected exception")
        raise

    # Success: persist all the Sigstore fields and transition to SIGNED.
    attestation.status = attestation_cls.Status.SIGNED
    attestation.backend_name = result.backend_name
    attestation.cert_chain_pem = result.cert_chain_pem
    attestation.signature_b64 = result.signature_b64
    attestation.statement_b64 = result.statement_b64
    attestation.rekor_log_index = result.rekor_log_index
    attestation.rekor_log_id = result.rekor_log_id
    attestation.rekor_inclusion_proof_json = result.rekor_inclusion_proof_json
    attestation.verify_url = result.verify_url
    attestation.signed_at = timezone.now()
    attestation.failure_reason = ""
    attestation.save(
        update_fields=[
            "status",
            "backend_name",
            "cert_chain_pem",
            "signature_b64",
            "statement_b64",
            "rekor_log_index",
            "rekor_log_id",
            "rekor_inclusion_proof_json",
            "verify_url",
            "signed_at",
            "failure_reason",
        ]
    )
    log.info(
        "sign_version: signed (id=%s backend=%s log_index=%d)",
        attestation.id,
        result.backend_name,
        result.rekor_log_index,
    )
    return {
        "ok": True,
        "skipped": False,
        "attestation_id": str(attestation.id),
        "backend_name": result.backend_name,
        "rekor_log_index": result.rekor_log_index,
    }
