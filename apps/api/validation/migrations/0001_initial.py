"""Initial validation app schema — ReviewItem + PipelineStage."""

from __future__ import annotations

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("orgs", "0001_initial"),
        ("registry", "0003_primitive_metadata"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReviewItem",
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
                    "status",
                    models.CharField(
                        choices=[
                            ("needs_security_review", "Needs Security Review"),
                            ("benchmark_failed", "Benchmark Failed"),
                            ("human_review_pending", "Human Review Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        max_length=32,
                    ),
                ),
                ("comments_count", models.PositiveIntegerField(default=0)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_items",
                        to="orgs.organization",
                    ),
                ),
                (
                    "primitive_version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_items",
                        to="registry.primitiveversion",
                    ),
                ),
                (
                    "reviewer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviews_assigned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "validation_review_item",
            },
        ),
        migrations.CreateModel(
            name="PipelineStage",
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
                ("name", models.CharField(max_length=120)),
                (
                    "position",
                    models.PositiveSmallIntegerField(
                        help_text="0-based position in the pipeline (Schema=0, Safety=1, …)"
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("passed", "Passed"),
                            ("warning", "Warning"),
                            ("failed", "Failed"),
                        ],
                        max_length=12,
                    ),
                ),
                (
                    "score",
                    models.PositiveSmallIntegerField(
                        blank=True,
                        help_text="0-100; null for non-scoring stages",
                        null=True,
                    ),
                ),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("log", models.TextField(blank=True)),
                ("executed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pipeline_stages",
                        to="orgs.organization",
                    ),
                ),
                (
                    "primitive_version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pipeline_stages",
                        to="registry.primitiveversion",
                    ),
                ),
                (
                    "reviewer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pipeline_stages_executed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "validation_pipeline_stage",
            },
        ),
        migrations.AddConstraint(
            model_name="pipelinestage",
            constraint=models.UniqueConstraint(
                fields=("primitive_version", "position"),
                name="validation_pipeline_pv_position_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="reviewitem",
            index=models.Index(fields=["organization"], name="validation__organiz_e1b342_idx"),
        ),
        migrations.AddIndex(
            model_name="reviewitem",
            index=models.Index(fields=["primitive_version"], name="validation__primiti_99cb78_idx"),
        ),
        migrations.AddIndex(
            model_name="reviewitem",
            index=models.Index(fields=["status"], name="validation__status_9c2941_idx"),
        ),
        migrations.AddIndex(
            model_name="reviewitem",
            index=models.Index(fields=["-submitted_at"], name="validation__submitt_4b1a01_idx"),
        ),
        migrations.AddIndex(
            model_name="pipelinestage",
            index=models.Index(fields=["organization"], name="validation__organiz_de83f1_idx"),
        ),
        migrations.AddIndex(
            model_name="pipelinestage",
            index=models.Index(
                fields=["primitive_version", "position"],
                name="validation__primiti_5f7c52_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="pipelinestage",
            index=models.Index(fields=["status"], name="validation__status_3e0a51_idx"),
        ),
    ]
