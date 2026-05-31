"""Attestation signing fields — Phase 4 PR #4.

Adds the state machine + Sigstore-signing fields to `Attestation`:

  status, attempts, failure_reason, idempotency_key
  backend_name, cert_chain_pem, signature_b64, statement_b64
  rekor_log_index, rekor_log_id, rekor_inclusion_proof_json
  verify_url

Plus two indexes:
  registry_at_status_idx     — for "find pending attestations to retry"
  registry_at_rekoridx_idx   — for lookup by Rekor log_index

Hand-written to keep this migration focused on the Attestation changes
alone — the orgs/accounts model-drift renames from bug #22 are NOT
included here; they'll land in their own fix PR. See `docs/bugs.md` #22.

RLS: the existing Attestation RLS policy filters by organization_id;
all new fields ride on that. No policy change needed.
"""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0006_rename_registry_attest_org_idx_registry_at_organiz_b345c5_idx_and_more"),
    ]

    operations = [
        # ── State machine ──────────────────────────────────────────
        migrations.AddField(
            model_name="attestation",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("signing", "Signing"),
                    ("signed", "Signed"),
                    ("failed", "Failed"),
                ],
                default="pending",
                help_text="Lifecycle state. Transitions: pending → signing → signed | failed.",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="attempts",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="How many sign attempts have been made. Bumped on each task run.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="failure_reason",
            field=models.TextField(
                blank=True,
                help_text="Populated when status=failed. The user-visible reason. "
                "Full traceback goes to logs, not here.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="idempotency_key",
            field=models.CharField(
                blank=True,
                help_text="Per-attestation idempotency key. Set at row creation; "
                "re-enqueueing for the same key is a no-op at the task layer.",
                max_length=80,
                unique=True,
            ),
        ),
        # ── Sigstore signing fields ────────────────────────────────
        migrations.AddField(
            model_name="attestation",
            name="backend_name",
            field=models.CharField(
                blank=True,
                help_text="Which SigstoreBackend produced this "
                "(public/staging/self-hosted/noop). "
                "Stored so a verifier knows which trust root to use.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="cert_chain_pem",
            field=models.TextField(
                blank=True,
                help_text="PEM-encoded leaf cert + chain from Fulcio. Empty until status=signed.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="signature_b64",
            field=models.TextField(
                blank=True,
                help_text="Base64-encoded raw signature over the in-toto Statement.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="statement_b64",
            field=models.TextField(
                blank=True,
                help_text="Base64-encoded in-toto Statement bytes that the cert "
                "binds to. Stored for offline re-verification.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="rekor_log_index",
            field=models.BigIntegerField(
                blank=True,
                help_text="Rekor transparency-log entry index. "
                "Stable across CT log restructurings.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="rekor_log_id",
            field=models.CharField(
                blank=True,
                help_text="Hex SHA-256 of Rekor's public key. Identifies WHICH Rekor.",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="rekor_inclusion_proof_json",
            field=models.TextField(
                blank=True,
                help_text="JSON-serialized inclusion proof; lets third parties verify offline.",
            ),
        ),
        migrations.AddField(
            model_name="attestation",
            name="verify_url",
            field=models.URLField(
                blank=True,
                help_text="Human-readable URL to inspect the Rekor entry in the appropriate UI.",
                max_length=400,
            ),
        ),
        # ── Help-text updates on existing fields ───────────────────
        migrations.AlterField(
            model_name="attestation",
            name="rekor_entry_id",
            field=models.CharField(
                blank=True,
                help_text="Sigstore Rekor entry UUID. Convenience field; "
                "rekor_log_index is the canonical identifier.",
                max_length=200,
            ),
        ),
        migrations.AlterField(
            model_name="attestation",
            name="signature_envelope",
            field=models.TextField(
                blank=True,
                help_text="DSSE envelope. Reserved for future use "
                "(DSSE wrapping ships post-PR #4).",
            ),
        ),
        # ── Indexes ────────────────────────────────────────────────
        migrations.AddIndex(
            model_name="attestation",
            index=models.Index(fields=["status"], name="registry_at_status_idx"),
        ),
        migrations.AddIndex(
            model_name="attestation",
            index=models.Index(fields=["rekor_log_index"], name="registry_at_rekoridx_idx"),
        ),
    ]
