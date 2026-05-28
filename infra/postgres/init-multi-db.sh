#!/usr/bin/env bash
# Postgres initdb hook — create additional databases beyond POSTGRES_DB.
#
# Triggered when the cluster is first created. POSTGRES_MULTIPLE_DATABASES is a
# comma-separated list of names; each gets a CREATE DATABASE issued by the
# primary POSTGRES_USER. Idempotent: safe to re-run (DO NOTHING on conflict).
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

echo "init-multi-db.sh: done"
