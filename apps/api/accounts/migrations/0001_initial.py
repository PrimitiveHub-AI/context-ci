"""Initial migration for the accounts app."""

from __future__ import annotations

import uuid

import django.db.models.manager
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies: list[tuple[str, str]] = []

    operations = [
        migrations.CreateModel(
            name="User",
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
                ("password", models.CharField(max_length=128, verbose_name="password")),
                (
                    "last_login",
                    models.DateTimeField(blank=True, null=True, verbose_name="last login"),
                ),
                (
                    "subject",
                    models.CharField(
                        help_text="The OIDC `sub` claim. Stable identifier from the IdP.",
                        max_length=255,
                        unique=True,
                    ),
                ),
                ("email", models.EmailField(blank=True, db_index=True, max_length=254)),
                ("display_name", models.CharField(blank=True, max_length=200)),
                ("is_active", models.BooleanField(default=True)),
                ("is_staff", models.BooleanField(default=False)),
                ("is_superuser", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "user",
                "verbose_name_plural": "users",
                "db_table": "accounts_user",
            },
            managers=[
                ("objects", django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["email"], name="accounts_us_email_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["-created_at"], name="accounts_us_created_idx"),
        ),
    ]
