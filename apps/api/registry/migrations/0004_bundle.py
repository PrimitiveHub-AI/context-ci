"""Add Bundle + Bundle↔Primitive M2M."""

from __future__ import annotations

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0003_primitive_metadata"),
        ("orgs", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Bundle",
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
                ("use_case", models.CharField(blank=True, max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="bundles",
                        to="orgs.organization",
                    ),
                ),
                (
                    "primitives",
                    models.ManyToManyField(
                        blank=True, related_name="bundles", to="registry.primitive"
                    ),
                ),
            ],
            options={
                "db_table": "registry_bundle",
            },
        ),
        migrations.AddConstraint(
            model_name="bundle",
            constraint=models.UniqueConstraint(
                fields=("organization", "slug"), name="registry_bundle_org_slug_unique"
            ),
        ),
        migrations.AddIndex(
            model_name="bundle",
            index=models.Index(fields=["organization"], name="registry_bu_organiz_a47de2_idx"),
        ),
        migrations.AddIndex(
            model_name="bundle",
            index=models.Index(fields=["-created_at"], name="registry_bu_created_d9fb78_idx"),
        ),
    ]
