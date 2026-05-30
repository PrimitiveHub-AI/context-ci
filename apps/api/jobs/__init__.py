"""jobs — background tasks orchestrated by Procrastinate.

Tasks live in `tasks.py` files and are auto-discovered by the
`procrastinate.contrib.django` integration. The worker is a separate
container (`api-worker` in compose.yaml) that long-polls the Postgres
`procrastinate_jobs` table for queued work.

Tenant context (`SET LOCAL primitivehub.current_organization`) is NOT
set by middleware here — tasks run outside the request cycle. Every
tenant-scoped task is responsible for setting it explicitly inside
its own transaction. See `tasks.ping` for the canonical pattern.
"""
