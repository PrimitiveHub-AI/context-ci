"""Organization + members + role assignments.

PrimitiveHub is multi-tenant from Day 1. Every tenant-scoped object has an
`organization` FK, and Postgres RLS policies (added in migration 0002) ensure
queries can only see rows for the active organization context.

The role set matches the Governance section of the product:
  - maintainer        — policy + author promotion + deprecation
  - verified_expert   — domain-verified author, accelerated review
  - reviewer          — review submissions
  - security_reviewer — required approver for high-risk + security/* primitives
  - author            — submit primitives
  - registry_admin    — operate the registry itself (cannot bypass CI)
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Organization(models.Model):
    """A tenant. Holds zero or more registries."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=200)
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orgs_organization"
        ordering = ["slug"]

    def __str__(self) -> str:
        return self.slug


class Role(models.TextChoices):
    """The fixed role vocabulary. Stored as strings; per-org assignments are M2M."""

    MAINTAINER = "maintainer", "Maintainer"
    VERIFIED_EXPERT = "verified_expert", "Verified Expert"
    REVIEWER = "reviewer", "Reviewer"
    SECURITY_REVIEWER = "security_reviewer", "Security Reviewer"
    AUTHOR = "author", "Author"
    REGISTRY_ADMIN = "registry_admin", "Registry Admin"


class OrganizationMember(models.Model):
    """Links a User to an Organization with one or more roles.

    A user may belong to multiple organizations; roles are scoped per
    membership (a `maintainer` in Org A holds no authority in Org B).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    roles = models.JSONField(
        default=list,
        help_text="List of role strings from the Role enum.",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orgs_member"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="orgs_member_org_user_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization}"

    def has_role(self, role: str | Role) -> bool:
        target = role.value if isinstance(role, Role) else role
        return target in (self.roles or [])
