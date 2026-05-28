#!/usr/bin/env python
"""Schema invariant guard — Python equivalent of apps/web/scripts/check-data.mjs.

Run with: uv run python scripts/check_schema.py

Validates assertions that should always hold about the Django models even
before any data lands:
  - Every tenant-scoped model has an `organization` FK.
  - Every model that is content-addressed declares `content_digest` + `storage_key`.
  - Every model with timestamps follows the (`created_at`, `updated_at`)
    convention.
  - The Attestation predicate type matches the spec.

Exits non-zero on any failure so CI can gate merges.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "primitivehub_api.settings_test")

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.db import models  # noqa: E402

FAILURES: list[str] = []


def fail(msg: str) -> None:
    FAILURES.append(msg)
    print(f"  \033[31m✗\033[0m {msg}")


def ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}")


def main() -> int:
    print("\n\033[1mPrimitiveHub API :: schema invariant checks\033[0m\n")

    # ── tenant-scoped tables must have organization FK ─────────────────────
    print("tenant scoping")
    TENANT_SCOPED = {
        "registry.Registry",
        "registry.Repository",
        "registry.Primitive",
        "registry.PrimitiveVersion",
        "registry.Attestation",
        "orgs.OrganizationMember",
    }
    for label in TENANT_SCOPED:
        model = apps.get_model(label)
        if not any(
            isinstance(f, models.ForeignKey)
            and f.related_model._meta.label == "orgs.Organization"
            and f.name == "organization"
            for f in model._meta.get_fields()
        ):
            fail(f"{label}: missing `organization` ForeignKey")
    if not [f for f in FAILURES if "organization" in f]:
        ok(f"{len(TENANT_SCOPED)} tenant-scoped models all carry organization FK")

    # ── content-addressed tables ───────────────────────────────────────────
    print("\ncontent addressing")
    Pv = apps.get_model("registry.PrimitiveVersion")
    field_names = {f.name for f in Pv._meta.get_fields()}
    for required in ("content_digest", "storage_key", "tokens", "token_budget", "semver"):
        if required not in field_names:
            fail(f"PrimitiveVersion: missing required field `{required}`")
    if not [f for f in FAILURES if "PrimitiveVersion" in f]:
        ok("PrimitiveVersion declares content_digest, storage_key, tokens, token_budget, semver")

    # ── Attestation predicate type matches the spec ────────────────────────
    print("\nattestation predicate")
    Attestation = apps.get_model("registry.Attestation")
    pred_field = Attestation._meta.get_field("predicate_type")
    expected = "https://primitivehub.ai/context-ci/v0.1/Attestation"
    if pred_field.default != expected:
        fail(f"Attestation.predicate_type default is {pred_field.default!r}, expected {expected!r}")
    else:
        ok(f"Attestation.predicate_type defaults to {expected}")

    # ── audit fields convention ────────────────────────────────────────────
    print("\ntimestamps")
    AUDIT_TABLES = {
        "orgs.Organization",
        "registry.Registry",
        "registry.Primitive",
    }
    for label in AUDIT_TABLES:
        model = apps.get_model(label)
        names = {f.name for f in model._meta.get_fields()}
        missing = {"created_at", "updated_at"} - names
        if missing:
            fail(f"{label}: missing audit fields: {sorted(missing)}")
    if not [f for f in FAILURES if any(t in f for t in AUDIT_TABLES)]:
        ok(f"{len(AUDIT_TABLES)} models carry created_at + updated_at")

    print()
    if FAILURES:
        print(f"\033[31m\033[1m{len(FAILURES)} schema check(s) failed.\033[0m")
        return 1
    print("\033[32m\033[1mAll schema invariant checks passed.\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
