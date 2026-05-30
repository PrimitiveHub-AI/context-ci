"""Idempotent seed for the dev/test registry.

Run via `uv run python manage.py seed_registry`. Safe to re-run — every step
is `get_or_create` keyed by stable identifiers. Production data lands via
the upload endpoint (Phase 3 Step 3), not this command.
"""

from __future__ import annotations

import hashlib
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orgs.models import Organization, OrganizationMember, Role
from registry.fixtures.seed_primitives import (
    SEED_ORG_NAME,
    SEED_ORG_SLUG,
    SEED_PRIMITIVES,
    SEED_REGISTRY_NAME,
    SEED_REGISTRY_SLUG,
    SEED_REPOSITORIES,
)
from registry.models import (
    Attestation,
    Primitive,
    PrimitiveVersion,
    Registry,
    Repository,
)


def _fake_digest(slug: str, semver: str) -> str:
    """Deterministic placeholder content digest until real upload exists."""
    return hashlib.sha256(f"{slug}@{semver}:seed".encode()).hexdigest()


class Command(BaseCommand):
    help = "Seed the local registry with representative primitives for dev + tests."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing seed rows before re-seeding (dev only).",
        )

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Deleting existing seed rows…"))
            org = Organization.objects.filter(slug=SEED_ORG_SLUG).first()
            if org:
                org.delete()  # cascades through everything below

        User = get_user_model()
        seed_user, _ = User.objects.get_or_create(
            subject=settings.DEV_OIDC_SUBJECT,
            defaults={
                "email": settings.DEV_OIDC_EMAIL,
                "display_name": settings.DEV_OIDC_NAME,
            },
        )

        org, _ = Organization.objects.get_or_create(
            slug=SEED_ORG_SLUG,
            defaults={
                "name": SEED_ORG_NAME,
                "visibility": Organization.Visibility.PUBLIC,
            },
        )

        OrganizationMember.objects.get_or_create(
            organization=org,
            user=seed_user,
            defaults={"roles": [Role.MAINTAINER.value, Role.AUTHOR.value]},
        )

        registry, _ = Registry.objects.get_or_create(
            organization=org,
            slug=SEED_REGISTRY_SLUG,
            defaults={
                "name": SEED_REGISTRY_NAME,
                "visibility": Registry.Visibility.PUBLIC,
            },
        )

        repos_by_slug: dict[str, Repository] = {}
        for repo_spec in SEED_REPOSITORIES:
            repo, _ = Repository.objects.get_or_create(
                registry=registry,
                slug=repo_spec["slug"],
                defaults={
                    "organization": org,
                    "name": repo_spec["name"],
                    "description": repo_spec["description"],
                },
            )
            repos_by_slug[repo.slug] = repo

        for spec in SEED_PRIMITIVES:
            repo = repos_by_slug[spec["repository_slug"]]
            primitive, _ = Primitive.objects.get_or_create(
                repository=repo,
                slug=spec["slug"],
                defaults={
                    "organization": org,
                    "name": spec["name"],
                    "description": spec["description"],
                    "category": spec["category"],
                    "risk_level": spec["risk_level"],
                },
            )

            v = spec["version"]
            digest = _fake_digest(spec["slug"], v["semver"])
            storage_key = f"sha256:{digest}"
            now = timezone.now()
            verdict = v["verdict"]
            attested_at = now if verdict == "trusted" else None

            version, _created = PrimitiveVersion.objects.get_or_create(
                primitive=primitive,
                semver=v["semver"],
                defaults={
                    "organization": org,
                    "content_digest": digest,
                    "storage_key": storage_key,
                    "tokens": v["tokens"],
                    "token_budget": v["token_budget"],
                    "license": v["license"],
                    "spec_version": "0.1",
                    "submitted_by": seed_user,
                    "verdict": verdict,
                    "attested_at": attested_at,
                    "quality_score": v["quality_score"],
                    "safety_score": v["safety_score"],
                    "efficiency_score": v["efficiency_score"],
                    "impact_score": v["impact_score"],
                    "compatible_agents": v["compatible_agents"],
                    "use_when": v["use_when"],
                    "do_not_use_when": v["do_not_use_when"],
                },
            )

            if v.get("has_attestation"):
                Attestation.objects.get_or_create(
                    primitive_version=version,
                    defaults={
                        "organization": org,
                        "predicate": {
                            "subject": [
                                {
                                    "name": f"{primitive.slug}@{version.semver}",
                                    "digest": {"sha256": version.content_digest},
                                }
                            ],
                            "validation": {
                                "tool": "context-ci",
                                "version": "0.1",
                                "verdict": verdict,
                                "stages": ["schema", "safety", "efficiency", "impact"],
                            },
                        },
                        "threat_model_version": "0.1",
                        "spec_version": "0.1",
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded org={org.slug}, registry={registry.slug}, "
                f"repos={len(repos_by_slug)}, primitives={len(SEED_PRIMITIVES)}."
            )
        )
