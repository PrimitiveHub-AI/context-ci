"""RLS on validation_review_item + validation_pipeline_stage.

Postgres-only by design (see registry/migrations/0002_rls_policies.py).
The vendor guard below exists for `dumpdata`/`inspectdb` against foreign
backends only — production and tests run against Postgres.
"""

from __future__ import annotations

from django.db import migrations

ENABLE_RLS_SQL = """
ALTER TABLE validation_review_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_review_item FORCE ROW LEVEL SECURITY;
CREATE POLICY validation_review_item_tenant_isolation ON validation_review_item
    USING (organization_id = primitivehub_current_org());

ALTER TABLE validation_pipeline_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_pipeline_stage FORCE ROW LEVEL SECURITY;
CREATE POLICY validation_pipeline_stage_tenant_isolation ON validation_pipeline_stage
    USING (organization_id = primitivehub_current_org());
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS validation_review_item_tenant_isolation ON validation_review_item;
ALTER TABLE validation_review_item DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS validation_pipeline_stage_tenant_isolation ON validation_pipeline_stage;
ALTER TABLE validation_pipeline_stage DISABLE ROW LEVEL SECURITY;
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
        ("validation", "0001_initial"),
        ("registry", "0002_rls_policies"),
    ]

    operations = [
        migrations.RunPython(_apply, _revert),
    ]
