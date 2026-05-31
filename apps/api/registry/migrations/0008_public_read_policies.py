"""Public-read RLS policies on registry tables — Phase 5.5 PR 5.5.2.

Adds a SECOND policy on each tenant-scoped registry table:

  registry_<table>_public_read   USING (chain rolls up to registry.visibility = 'public')

Postgres ORs every USING policy together. The existing
`*_tenant_isolation` policy keeps own-org behavior unchanged; the new
`*_public_read` policy lets unauthenticated reads (current_org IS NULL)
see rows whose registry has `visibility = 'public'`.

No role switching, no BYPASSRLS — the same `primitivehub_app` role works
for both authenticated and anonymous reads. RLS remains the single
security boundary. See ADR-0014.

Truth table
-----------
For each row, with current_org context X and the row's registry having
visibility V, is the row visible to a SELECT?

  X = NULL (anon)   V = public   → public_read PASS  → visible
  X = NULL (anon)   V = private  → both FAIL         → hidden
  X = own org      V = public   → tenant_isolation PASS → visible
  X = own org      V = private  → tenant_isolation PASS → visible (own data)
  X = other org    V = public   → public_read PASS  → visible (cross-org browse OK)
  X = other org    V = private  → both FAIL         → hidden (privacy preserved)

The "browse other org's public primitives" case (last row above) is the
intended behavior for the Snyk-overlay shape: anyone can verify any
public primitive's attestation regardless of where they are.

Vendor guard
------------
Matches migration 0002's pattern — skip on non-Postgres so that
`manage.py inspectdb` against a foreign backend doesn't error.
Production + tests are Postgres.
"""

from __future__ import annotations

from django.db import migrations

ADD_PUBLIC_READ_POLICIES_SQL = """
-- registry_registry — direct visibility column
CREATE POLICY registry_registry_public_read ON registry_registry
    FOR SELECT
    USING (visibility = 'public');

-- registry_repository — visibility lives on the parent Registry
CREATE POLICY registry_repository_public_read ON registry_repository
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM registry_registry r
            WHERE r.id = registry_repository.registry_id
              AND r.visibility = 'public'
        )
    );

-- registry_primitive — visibility lives on the grand-parent Registry
CREATE POLICY registry_primitive_public_read ON registry_primitive
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM registry_repository repo
            JOIN registry_registry r ON r.id = repo.registry_id
            WHERE repo.id = registry_primitive.repository_id
              AND r.visibility = 'public'
        )
    );

-- registry_primitive_version — same chain via primitive
CREATE POLICY registry_pv_public_read ON registry_primitive_version
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM registry_primitive p
            JOIN registry_repository repo ON repo.id = p.repository_id
            JOIN registry_registry r ON r.id = repo.registry_id
            WHERE p.id = registry_primitive_version.primitive_id
              AND r.visibility = 'public'
        )
    );

-- registry_attestation — same chain via primitive_version
CREATE POLICY registry_attestation_public_read ON registry_attestation
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM registry_primitive_version pv
            JOIN registry_primitive p ON p.id = pv.primitive_id
            JOIN registry_repository repo ON repo.id = p.repository_id
            JOIN registry_registry r ON r.id = repo.registry_id
            WHERE pv.id = registry_attestation.primitive_version_id
              AND r.visibility = 'public'
        )
    );
"""

DROP_PUBLIC_READ_POLICIES_SQL = """
DROP POLICY IF EXISTS registry_registry_public_read ON registry_registry;
DROP POLICY IF EXISTS registry_repository_public_read ON registry_repository;
DROP POLICY IF EXISTS registry_primitive_public_read ON registry_primitive;
DROP POLICY IF EXISTS registry_pv_public_read ON registry_primitive_version;
DROP POLICY IF EXISTS registry_attestation_public_read ON registry_attestation;
"""


def apply_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(ADD_PUBLIC_READ_POLICIES_SQL)


def revert_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DROP_PUBLIC_READ_POLICIES_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0007_attestation_signing_fields"),
    ]

    operations = [
        migrations.RunPython(apply_policies, revert_policies),
    ]
