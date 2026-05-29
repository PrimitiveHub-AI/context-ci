"""RLS policy for registry_bundle, matching the 0002 pattern."""

from __future__ import annotations

from django.db import migrations

ENABLE_RLS_SQL = """
ALTER TABLE registry_bundle ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_bundle FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_bundle_tenant_isolation ON registry_bundle
    USING (organization_id = primitivehub_current_org());
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS registry_bundle_tenant_isolation ON registry_bundle;
ALTER TABLE registry_bundle DISABLE ROW LEVEL SECURITY;
"""


def _apply(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(ENABLE_RLS_SQL)


def _revert(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DISABLE_RLS_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0004_bundle"),
    ]

    operations = [
        migrations.RunPython(_apply, _revert),
    ]
