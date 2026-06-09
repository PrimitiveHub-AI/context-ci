# Build hygiene — per-app gates

> Extracted from `CLAUDE.md` to keep the contract lean (ADR-0040
> anti-bloat). These gates are non-negotiable; run them before any commit
> that touches the relevant surface.

## Frontend (`apps/web/`)

All web commands run from `apps/web/`.

- `cd apps/web && pnpm typecheck` must pass before any commit touching
  `.ts`/`.tsx`.
- `cd apps/web && pnpm check:data` must pass before any commit touching
  `apps/web/lib/data/*` or `apps/web/lib/types.ts`. The data-integrity
  guard is non-negotiable.
- Real TS errors block builds — `apps/web/next.config.mjs` does NOT silence
  them (the v0 `ignoreBuildErrors: true` flag was removed in Phase 1).
- Container builds: `docker compose build web` from the repo root.

## Backend (`apps/api/`)

All Python commands run from `apps/api/` via `uv`.

- `uv run ruff check .` must pass — Python lint (S = security, B = bugbear, DJ = Django).
- `uv run ruff format --check .` must pass — formatter is non-negotiable.
- `uv run mypy primitivehub_api accounts orgs registry storage validation jobs` must pass — strict typing on (django-stubs plugin enabled). The flat-layout means there's no `apps/` subdir to globally target; list the Django apps explicitly.
- `uv run python scripts/check_schema.py` must pass — schema invariant guard.
- `uv run python manage.py check --fail-level WARNING` must pass — Django system check.
- `uv run pytest` must pass — smoke + business tests. Default run
  skips `@pytest.mark.integration` (network-dependent tests against
  sigstage Fulcio + Rekor; opt-in with `uv run pytest -m integration`
  + `SIGSTAGE_OIDC_TOKEN` env). **Tests run against Postgres**, not sqlite. The `primitivehub_test` database is provisioned
  by `infra/postgres/init-multi-db.sh` (one-time on fresh clusters; for
  existing clusters, run the script's SQL manually). pytest-django uses
  `--reuse-db` so the test database persists across runs and keeps the
  `test_bypass_rls` role grants. Tests bypass RLS in their fixture
  setup via `SET ROLE test_bypass_rls`; the dedicated
  `test_rls_actually_isolates.py` resets back to `primitivehub_app`
  (NOSUPERUSER, NOBYPASSRLS) to prove RLS enforces. **sqlite is
  forbidden for tests** — it skips RLS migrations and would hide
  tenant-isolation regressions.
- Migrations: hand-edited migrations are committed; never use `--squash` on
  released migrations. RLS migrations have an `if vendor != "postgresql"`
  early-return for `dumpdata`/`inspectdb` against foreign backends only;
  production and tests are Postgres.
- Container builds: `docker compose build api` from the repo root.

## CLI (`packages/phub/`)

All phub commands run from `packages/phub/`.

- `pnpm -s typecheck` must pass.
- `pnpm -s test` must pass (Vitest). `phub audit --check-lock` drift on
  agent-context artifacts is intentional after editing `CLAUDE.md` or any
  primitive — re-seal with `phub audit --update-lock` and commit the
  regenerated `.primitivehub/phub.lock`.
