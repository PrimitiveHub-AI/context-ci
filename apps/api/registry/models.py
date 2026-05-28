"""Registry data model.

Every primitive lives at a path:
    <organization.slug>/<registry.slug>/<repository.slug>/<primitive.slug>@<version>

Content-addressing: `PrimitiveVersion.content_digest` is the SHA-256 hex of
the primitive's canonical content (per docs/spec.md §4). The same hex is the
object-storage key, so verification = re-hash on read, compare to the digest.

Multi-tenancy: every table that is tenant-scoped has `organization` FK plus a
matching Postgres RLS policy (added in migration 0002). The application sets
`SET LOCAL primitivehub.current_organization` per request and the RLS policy
limits visibility to rows where `organization_id` matches.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.orgs.models import Organization


class Registry(models.Model):
    """A namespace within an organization. Org `public` has the public registry."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="registries"
    )
    slug = models.SlugField(max_length=64)
    name = models.CharField(max_length=200)
    visibility = models.CharField(
        max_length=16, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "registry_registry"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="registry_org_slug_unique"
            ),
        ]
        indexes = [models.Index(fields=["organization"])]

    def __str__(self) -> str:
        return f"{self.organization.slug}/{self.slug}"


class Repository(models.Model):
    """A grouping of related primitives within a Registry."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="repositories"
    )
    registry = models.ForeignKey(
        Registry, on_delete=models.CASCADE, related_name="repositories"
    )
    slug = models.SlugField(max_length=64)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "registry_repository"
        constraints = [
            models.UniqueConstraint(
                fields=["registry", "slug"], name="registry_repo_registry_slug_unique"
            ),
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["registry"]),
        ]

    def __str__(self) -> str:
        return f"{self.registry}/{self.slug}"


class Primitive(models.Model):
    """The mutable name pointer. Versions are immutable; the primitive is not."""

    class RiskLevel(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Category(models.TextChoices):
        SOFTWARE_ENGINEERING = "software-engineering", "Software Engineering"
        PRODUCT_DESIGN = "product-design", "Product Design"
        CYBERSECURITY = "cybersecurity", "Cybersecurity"
        RESEARCH_WRITING = "research-writing", "Research & Writing"
        ARCHITECTURE = "architecture", "Architecture"
        PERFORMANCE = "performance", "Performance"
        AGENT_BEHAVIOR = "agent-behavior", "Agent Behavior"
        DOMAIN_EXPERTISE = "domain-expertise", "Domain Expertise"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="primitives"
    )
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="primitives"
    )
    slug = models.SlugField(max_length=64)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=32, choices=Category.choices)
    risk_level = models.CharField(
        max_length=8, choices=RiskLevel.choices, default=RiskLevel.LOW
    )
    deprecated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "registry_primitive"
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "slug"], name="registry_primitive_repo_slug_unique"
            ),
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["repository"]),
            models.Index(fields=["category"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.repository}/{self.slug}"


class PrimitiveVersion(models.Model):
    """An immutable, content-addressed primitive version.

    `content_digest` is the SHA-256 hex of the primitive's canonical content
    (per docs/spec.md §4). The same value is the object-storage key —
    PrimitiveHub is content-addressed by construction.
    """

    class Verdict(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        IN_REVIEW = "in_review", "In Review"
        TRUSTED = "trusted", "Trusted"
        EXPERIMENTAL = "experimental", "Experimental"
        DEPRECATED = "deprecated", "Deprecated"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="primitive_versions"
    )
    primitive = models.ForeignKey(
        Primitive, on_delete=models.CASCADE, related_name="versions"
    )
    semver = models.CharField(max_length=64)
    content_digest = models.CharField(max_length=80, unique=True)
    storage_key = models.CharField(max_length=80, unique=True)
    tokens = models.PositiveIntegerField()
    token_budget = models.PositiveIntegerField()
    license = models.CharField(max_length=64)
    spec_version = models.CharField(max_length=16, default="0.1")
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_versions",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    verdict = models.CharField(
        max_length=16, choices=Verdict.choices, default=Verdict.SUBMITTED
    )
    attested_at = models.DateTimeField(blank=True, null=True)
    quality_score = models.PositiveSmallIntegerField(blank=True, null=True)
    safety_score = models.PositiveSmallIntegerField(blank=True, null=True)
    efficiency_score = models.PositiveSmallIntegerField(blank=True, null=True)
    impact_score = models.PositiveSmallIntegerField(blank=True, null=True)

    class Meta:
        db_table = "registry_primitive_version"
        constraints = [
            models.UniqueConstraint(
                fields=["primitive", "semver"],
                name="registry_pv_primitive_semver_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["primitive"]),
            models.Index(fields=["content_digest"]),
            models.Index(fields=["verdict"]),
            models.Index(fields=["-submitted_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.primitive}@{self.semver}"


class Attestation(models.Model):
    """An in-toto Statement carrying the Context CI validation record.

    Predicate type: https://primitivehub.ai/context-ci/v0.1/Attestation
    Predicate payload: see docs/spec.md §5.3.

    Signature: Ed25519 via Sigstore (Phase 4). Until then, the envelope is
    null and `signed_at` stays null.
    """

    PREDICATE_TYPE = "https://primitivehub.ai/context-ci/v0.1/Attestation"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="attestations"
    )
    primitive_version = models.OneToOneField(
        PrimitiveVersion, on_delete=models.CASCADE, related_name="attestation"
    )
    predicate_type = models.CharField(max_length=200, default=PREDICATE_TYPE)
    predicate = models.JSONField(
        help_text="In-toto Statement predicate payload (Spec §5.3)."
    )
    threat_model_version = models.CharField(max_length=16, default="0.1")
    spec_version = models.CharField(max_length=16, default="0.1")
    signature_envelope = models.TextField(
        blank=True,
        help_text="DSSE envelope (base64). Null until Sigstore signing wires in Phase 4.",
    )
    rekor_entry_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Sigstore Rekor transparency log entry ID.",
    )
    signed_at = models.DateTimeField(blank=True, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "registry_attestation"
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["-recorded_at"]),
        ]

    def __str__(self) -> str:
        return f"attestation:{self.primitive_version}"
