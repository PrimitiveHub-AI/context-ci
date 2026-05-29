#!/usr/bin/env bash
# Postgres initdb hook — runs ONCE on first cluster creation.
#
# Sets up:
#   1. Additional databases listed in POSTGRES_MULTIPLE_DATABASES.
#   2. `primitivehub_app` — the NOSUPERUSER role the API container connects
#      as. RLS only applies to non-superuser non-bypassrls roles, so the
#      app role MUST be non-superuser for the tenant-isolation policy to
#      actually enforce. Owns the schema, can CREATEDB (so pytest-django's
#      test-DB lifecycle works), but is otherwise minimum-privilege.
#   3. `test_bypass_rls` — NOLOGIN BYPASSRLS role used only by the test
#      suite. Grants primitivehub_app membership WITH ADMIN OPTION so
#      conftest can SET ROLE into it for cross-org fixture setup. The
#      dedicated RLS-integration test (`test_rls_actually_isolates.py`)
#      RESETs back to primitivehub_app so its assertions exercise the
#      real policy path.
#   4. `primitivehub_test` — the test database, owned by primitivehub_app
#      so pytest-django can drop/recreate it without superuser help.
#
# Idempotent on the SQL side (DO blocks + IF NOT EXISTS), but the script
# itself only runs on fresh cluster init. For existing clusters, run the
# same SQL manually one time (instructions in apps/api/README.md).

set -euo pipefail

if [ -z "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  echo "init-multi-db.sh: POSTGRES_MULTIPLE_DATABASES not set, nothing to do"
  exit 0
fi

IFS=',' read -ra DBS <<< "$POSTGRES_MULTIPLE_DATABASES"
for db in "${DBS[@]}"; do
  db_trimmed="$(echo "$db" | tr -d '[:space:]')"
  [ -z "$db_trimmed" ] && continue
  echo "init-multi-db.sh: ensuring database '$db_trimmed' exists"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    SELECT 'CREATE DATABASE "$db_trimmed" OWNER "$POSTGRES_USER"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_trimmed')
    \gexec
SQL
done

echo "init-multi-db.sh: creating primitivehub_app + test_bypass_rls roles"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  DO \$\$
  BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'primitivehub_app') THEN
          CREATE ROLE primitivehub_app
              WITH LOGIN PASSWORD 'primitivehub_app'
              NOSUPERUSER CREATEDB NOCREATEROLE INHERIT;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_bypass_rls') THEN
          CREATE ROLE test_bypass_rls NOLOGIN BYPASSRLS;
      END IF;
  END\$\$;
  GRANT test_bypass_rls TO primitivehub_app WITH ADMIN OPTION;
SQL

echo "init-multi-db.sh: granting primitivehub_app on each database"
for db in "${DBS[@]}" "$POSTGRES_DB"; do
  db_trimmed="$(echo "$db" | tr -d '[:space:]')"
  [ -z "$db_trimmed" ] && continue
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db_trimmed" <<-SQL
    GRANT CONNECT ON DATABASE "$db_trimmed" TO primitivehub_app;
    GRANT USAGE, CREATE ON SCHEMA public TO primitivehub_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO primitivehub_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO primitivehub_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO primitivehub_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO primitivehub_app;
SQL
done

echo "init-multi-db.sh: wiring test_bypass_rls on the test database"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "primitivehub_test" <<-SQL
  GRANT ALL PRIVILEGES ON SCHEMA public TO test_bypass_rls;
  ALTER DEFAULT PRIVILEGES FOR ROLE primitivehub_app IN SCHEMA public
      GRANT ALL ON TABLES TO test_bypass_rls;
  ALTER DEFAULT PRIVILEGES FOR ROLE primitivehub_app IN SCHEMA public
      GRANT ALL ON SEQUENCES TO test_bypass_rls;
SQL

echo "init-multi-db.sh: done"
