"""Initial migration for the registry app — the core artifact graph."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("orgs", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Registry",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("slug", models.SlugField(max_length=64)),
                ("name", models.CharField(max_length=200)),
                (
                    "visibility",
                    models.CharField(
                        choices=[("public", "Public"), ("private", "Private")],
                        default="private",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="registries",
                        to="orgs.organization",
                    ),
                ),
            ],
            options={"db_table": "registry_registry"},
        ),
        migrations.AddConstraint(
            model_name="registry",
            constraint=models.UniqueConstraint(
                fields=("organization", "slug"), name="registry_org_slug_unique"
            ),
        ),
        migrations.AddIndex(
            model_name="registry",
            index=models.Index(fields=["organization"], name="registry_reg_org_idx"),
        ),
        migrations.CreateModel(
            name="Repository",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("slug", models.SlugField(max_length=64)),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="repositories",
                        to="orgs.organization",
                    ),
                ),
                (
                    "registry",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="repositories",
                        to="registry.registry",
                    ),
                ),
            ],
            options={"db_table": "registry_repository"},
        ),
        migrations.AddConstraint(
            model_name="repository",
            constraint=models.UniqueConstraint(
                fields=("registry", "slug"),
                name="registry_repo_registry_slug_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="repository",
            index=models.Index(fields=["organization"], name="registry_repo_org_idx"),
        ),
        migrations.AddIndex(
            model_name="repository",
            index=models.Index(fields=["registry"], name="registry_repo_reg_idx"),
        ),
        migrations.CreateModel(
            name="Primitive",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("slug", models.SlugField(max_length=64)),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("software-engineering", "Software Engineering"),
                            ("product-design", "Product Design"),
                            ("cybersecurity", "Cybersecurity"),
                            ("research-writing", "Research & Writing"),
                            ("architecture", "Architecture"),
                            ("performance", "Performance"),
                            ("agent-behavior", "Agent Behavior"),
                            ("domain-expertise", "Domain Expertise"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "risk_level",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                        ],
                        default="low",
                        max_length=8,
                    ),
                ),
                ("deprecated_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="primitives",
                        to="orgs.organization",
                    ),
                ),
                (
                    "repository",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="primitives",
                        to="registry.repository",
                    ),
                ),
            ],
            options={"db_table": "registry_primitive"},
        ),
        migrations.AddConstraint(
            model_name="primitive",
            constraint=models.UniqueConstraint(
                fields=("repository", "slug"),
                name="registry_primitive_repo_slug_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="primitive",
            index=models.Index(fields=["organization"], name="registry_prim_org_idx"),
        ),
        migrations.AddIndex(
            model_name="primitive",
            index=models.Index(fields=["repository"], name="registry_prim_repo_idx"),
        ),
        migrations.AddIndex(
            model_name="primitive",
            index=models.Index(fields=["category"], name="registry_prim_cat_idx"),
        ),
        migrations.AddIndex(
            model_name="primitive",
            index=models.Index(fields=["-created_at"], name="registry_prim_created_idx"),
        ),
        migrations.CreateModel(
            name="PrimitiveVersion",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("semver", models.CharField(max_length=64)),
                ("content_digest", models.CharField(max_length=80, unique=True)),
                ("storage_key", models.CharField(max_length=80, unique=True)),
                ("tokens", models.PositiveIntegerField()),
                ("token_budget", models.PositiveIntegerField()),
                ("license", models.CharField(max_length=64)),
                ("spec_version", models.CharField(default="0.1", max_length=16)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                (
                    "verdict",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("submitted", "Submitted"),
                            ("in_review", "In Review"),
                            ("trusted", "Trusted"),
                            ("experimental", "Experimental"),
                            ("deprecated", "Deprecated"),
                            ("rejected", "Rejected"),
                        ],
                        default="submitted",
                        max_length=16,
                    ),
                ),
                ("attested_at", models.DateTimeField(blank=True, null=True)),
                ("quality_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("safety_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("efficiency_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("impact_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="primitive_versions",
                        to="orgs.organization",
                    ),
                ),
                (
                    "primitive",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="versions",
                        to="registry.primitive",
                    ),
                ),
                (
                    "submitted_by",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="submitted_versions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "registry_primitive_version"},
        ),
        migrations.AddConstraint(
            model_name="primitiveversion",
            constraint=models.UniqueConstraint(
                fields=("primitive", "semver"),
                name="registry_pv_primitive_semver_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="primitiveversion",
            index=models.Index(fields=["organization"], name="registry_pv_org_idx"),
        ),
        migrations.AddIndex(
            model_name="primitiveversion",
            index=models.Index(fields=["primitive"], name="registry_pv_prim_idx"),
        ),
        migrations.AddIndex(
            model_name="primitiveversion",
            index=models.Index(fields=["content_digest"], name="registry_pv_digest_idx"),
        ),
        migrations.AddIndex(
            model_name="primitiveversion",
            index=models.Index(fields=["verdict"], name="registry_pv_verdict_idx"),
        ),
        migrations.AddIndex(
            model_name="primitiveversion",
            index=models.Index(fields=["-submitted_at"], name="registry_pv_submitted_idx"),
        ),
        migrations.CreateModel(
            name="Attestation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "predicate_type",
                    models.CharField(
                        default="https://primitivehub.ai/context-ci/v0.1/Attestation",
                        max_length=200,
                    ),
                ),
                (
                    "predicate",
                    models.JSONField(
                        help_text="In-toto Statement predicate payload (Spec §5.3)."
                    ),
                ),
                ("threat_model_version", models.CharField(default="0.1", max_length=16)),
                ("spec_version", models.CharField(default="0.1", max_length=16)),
                (
                    "signature_envelope",
                    models.TextField(
                        blank=True,
                        help_text="DSSE envelope (base64). Null until Sigstore signing wires in Phase 4.",
                    ),
                ),
                (
                    "rekor_entry_id",
                    models.CharField(
                        blank=True,
                        help_text="Sigstore Rekor transparency log entry ID.",
                        max_length=200,
                    ),
                ),
                ("signed_at", models.DateTimeField(blank=True, null=True)),
                ("recorded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="attestations",
                        to="orgs.organization",
                    ),
                ),
                (
                    "primitive_version",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="attestation",
                        to="registry.primitiveversion",
                    ),
                ),
            ],
            options={"db_table": "registry_attestation"},
        ),
        migrations.AddIndex(
            model_name="attestation",
            index=models.Index(fields=["organization"], name="registry_attest_org_idx"),
        ),
        migrations.AddIndex(
            model_name="attestation",
            index=models.Index(fields=["-recorded_at"], name="registry_attest_recorded_idx"),
        ),
    ]
