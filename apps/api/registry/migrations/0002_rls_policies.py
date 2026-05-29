"""Enable Postgres Row-Level Security on every tenant-scoped table.

PrimitiveHub is Postgres-only by design. The tenant-context middleware
(`accounts.tenant_middleware.TenantContextMiddleware`) sets
`SET LOCAL primitivehub.current_organization = '<uuid>'` at the start of
each request. RLS policies below restrict visibility to rows where
`organization_id` matches that session setting. An unset setting denies
every row — RLS fails closed.

Postgres role attributes:
  - The api container runs as the `primitivehub` role (NOSUPERUSER).
    RLS applies to it.
  - Migrations and admin tooling run as `primitivehub` too (still
    NOSUPERUSER); the `FORCE ROW LEVEL SECURITY` clause means even the
    table owner is subject to RLS.
  - The `postgres` superuser bypasses RLS by Postgres design but is
    never used by the application.

Vendor guard
  The `if vendor != "postgresql"` early-return below exists ONLY so
  `manage.py dumpdata` / `inspectdb` against a foreign backend doesn't
  raise — production and tests both run against Postgres. The test suite
  (settings_test.py) uses a dedicated `primitivehub_test` database on
  the same Postgres service, NOT sqlite. sqlite is explicitly forbidden
  for tests because it would silently skip RLS and hide tenant-isolation
  regressions.
"""

from __future__ import annotations

from django.db import migrations

ENABLE_RLS_SQL = """
-- Tenant context: every request begins with `SET LOCAL primitivehub.current_organization = '<uuid>'`.
-- A NULL setting means "no tenant context" — RLS denies access by default.

CREATE OR REPLACE FUNCTION primitivehub_current_org() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('primitivehub.current_organization', true), '')::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- registry_registry
ALTER TABLE registry_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_registry FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_registry_tenant_isolation ON registry_registry
    USING (organization_id = primitivehub_current_org());

-- registry_repository
ALTER TABLE registry_repository ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_repository FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_repository_tenant_isolation ON registry_repository
    USING (organization_id = primitivehub_current_org());

-- registry_primitive
ALTER TABLE registry_primitive ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_primitive FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_primitive_tenant_isolation ON registry_primitive
    USING (organization_id = primitivehub_current_org());

-- registry_primitive_version
ALTER TABLE registry_primitive_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_primitive_version FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_pv_tenant_isolation ON registry_primitive_version
    USING (organization_id = primitivehub_current_org());

-- registry_attestation
ALTER TABLE registry_attestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_attestation FORCE ROW LEVEL SECURITY;
CREATE POLICY registry_attestation_tenant_isolation ON registry_attestation
    USING (organization_id = primitivehub_current_org());

-- orgs_member (the membership table itself is tenant-scoped via organization_id)
ALTER TABLE orgs_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs_member FORCE ROW LEVEL SECURITY;
CREATE POLICY orgs_member_tenant_isolation ON orgs_member
    USING (organization_id = primitivehub_current_org());
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS registry_registry_tenant_isolation ON registry_registry;
ALTER TABLE registry_registry DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_repository_tenant_isolation ON registry_repository;
ALTER TABLE registry_repository DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_primitive_tenant_isolation ON registry_primitive;
ALTER TABLE registry_primitive DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_pv_tenant_isolation ON registry_primitive_version;
ALTER TABLE registry_primitive_version DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_attestation_tenant_isolation ON registry_attestation;
ALTER TABLE registry_attestation DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgs_member_tenant_isolation ON orgs_member;
ALTER TABLE orgs_member DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS primitivehub_current_org();
"""


def _apply_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(ENABLE_RLS_SQL)


def _revert_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DISABLE_RLS_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0001_initial"),
        ("orgs", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(_apply_rls, _revert_rls),
    ]
