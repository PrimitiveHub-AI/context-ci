---
spec_version: "0.1"
name: docker-compose-discipline
version: 0.1.1
type: engineering
domain: infrastructure
author: PrimitiveHub AI (synthesized 2026-05-30 from production Docker patterns + maintainer experience)
license: CC-BY-4.0
tokens: 3600
token_budget: 5000
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
use_when:
  - "Writing or editing any Dockerfile in the project"
  - "Writing or editing compose.yaml / compose.override.yaml / compose.prod.yaml"
  - "Adding a new service to compose"
  - "Diagnosing slow builds, large image sizes, or container startup failures"
  - "Reviewing security posture of containers (non-root, secrets, capabilities)"
  - "Wiring env_file, healthchecks, depends_on, or resource limits"
do_not_use_when:
  - "Bare metal deployment without containers"
  - "Kubernetes-native work (different patterns apply)"
attestation: cci-v0.1
description: "Docker + Compose discipline for PrimitiveHub's 6-service stack: web (Next.js 16), api (Django + Ninja + uv), postgres 17, valkey 8, authentik-server, authentik-worker. Multi-stage builds, layer caching, security hardening, env_file precedence, health checks, network isolation."
keywords: [docker, docker-compose, multi-stage, dockerfile, hardening, env-file, healthcheck]
references:
  - "https://docs.docker.com/build/cache/"
  - "https://docs.docker.com/compose/compose-file/"
---

# Docker + Compose Discipline

## Purpose

PrimitiveHub runs as 6 containers on `docker compose`: web, api, postgres,
valkey, authentik-server, authentik-worker. The MinIO service is opt-in
via `--profile minio`. This primitive captures the patterns that keep
the build fast, the images small, the runtime safe, and the env wiring
predictable.

The most common AI-output failures: (a) bloated images from sloppy
layer ordering, (b) secrets baked into `ENV`/`ARG` and visible in
`docker history`, (c) `:latest` tags that break reproducibility,
(d) `docker compose restart` after `.env` changes (env_file isn't
re-read — see ADR-0009 backstory), (e) misunderstanding compose's
`environment:` vs `env_file:` precedence (empty defaults silently
override).

## Core Principles

- **Multi-stage builds.** Separate build env from runtime. The final
  image contains only what the process needs. Named stages
  (`AS deps`, `AS builder`, `AS runner`) make the intent legible.
  PrimitiveHub's `apps/api/Dockerfile` uses `deps → builder → runner`;
  `apps/web/Dockerfile` uses the Next.js standalone pattern.

- **Pin base images by exact version.** `python:3.13-slim` not
  `python:slim`. `node:22.11.0-alpine3.20` not `node:22-alpine`. Never
  `latest` in production. For paranoid reproducibility, pin to the
  digest (`@sha256:...`).

- **Layer order: least-changing first.** System deps → user creation →
  dependency manifests → install → source → build. Re-orderings that
  put `COPY . .` before `RUN pip install` invalidate the dep cache on
  every commit and slow CI builds 5-10×.

- **Cache-clean in the SAME layer.** `apt-get install ... && rm -rf
  /var/lib/apt/lists/*` — the cleanup in a separate `RUN` keeps the
  apt cache in the prior layer's image diff (no savings). For Alpine,
  `apk add --no-cache`. For pip, `--no-cache-dir`. For npm/pnpm,
  `--ignore-scripts` then `prune --production`.

- **`.dockerignore` is mandatory.** `.git`, `node_modules`, `.next`,
  `.env*`, `__pycache__`, `*.pyc`, IDE dirs, logs. Without it, the
  build context is your entire repo (slow `COPY .`, secrets risk).

- **Non-root user.** Containers run as a dedicated UID. The PrimitiveHub
  api uses `djangouser` (UID 1001); web uses `nextjs` (UID 1001).
  `COPY --chown=user:group` keeps file permissions correct.

- **`CMD` in exec form.** `CMD ["node", "server.js"]`, never `CMD node
  server.js`. Shell form swallows signals; the process never receives
  SIGTERM and graceful shutdown breaks.

- **Compose `environment:` > `env_file:`** Always. An entry in the
  `environment:` block — even `${VAR:-}` with an empty default —
  overrides what env_file would have injected. For dev secrets, OMIT
  the var from `environment:` and let env_file populate it. (This bit
  us — see `docs/bugs.md` #12 + ADR-0005.)

## Decision Rules

### Build hygiene

- **IF adding a new Dockerfile THEN** use multi-stage, exec-form CMD,
  non-root user, healthcheck, `.dockerignore` checked.
- **IF the base image tag has no patch version (`:slim`, `:alpine`)
  THEN** add the patch: `python:3.13.1-slim`, `node:22.11.0-alpine3.20`.
- **IF a `RUN` uses apt or apk THEN** clean the cache in the same
  `RUN` — `&& rm -rf /var/lib/apt/lists/*` or `--no-cache` for Alpine.
- **IF `COPY . .` appears before dep install THEN** reorder. Manifests
  first, install, then source.
- **IF a secret appears in `ENV`, `ARG`, `RUN echo`, or a
  manifest-committed `.env` THEN** reject. Use BuildKit `--mount=type=
  secret`, compose `secrets:`, or runtime env from a secret manager.

### Compose hygiene

- **IF a service depends on another service being READY (not just
  started) THEN** use `depends_on: condition: service_healthy` with
  a real healthcheck on the dependency. `service_started` is not
  enough — Postgres can be "started" but not accepting connections.
  (PrimitiveHub api service depends on `postgres: service_healthy`
  + `valkey: service_started` correctly.)
- **IF an env var with a secret needs to reach a container THEN** put
  it in env_file (gitignored) and ensure the var is NOT in the
  `environment:` block of compose.yaml. If you need a non-secret
  default in `environment:`, that's fine — but be explicit about
  which path provides the value.
- **IF an `.env` file changes THEN** `docker compose up -d --no-deps
  --force-recreate <service>`. `restart` alone does NOT re-read
  env_file. (`docs/bugs.md` #3.)
- **IF you add a new service that mounts an anonymous volume from a
  shared image (e.g. `- /opt/venv`) AND the image's content at that
  path changed since the volume was first populated THEN** include
  `--renew-anon-volumes` on `docker compose up`. Anonymous volumes
  SURVIVE `--force-recreate` — only the container is replaced; the
  stale volume content persists. Symptom: `ModuleNotFoundError` for
  a dep that the image clearly installs and other services using
  the same image import fine. (`docs/bugs.md` #23.)
- **IF a port is bound for a non-public service THEN** prefix with
  `127.0.0.1:`. Never `0.0.0.0` or bare port. Pre-launch posture is
  absolute (see `feedback-localhost-only` memory rule).
- **IF a volume holds persistent data (postgres, authentik secrets)
  THEN** use a named volume, not a bind mount — Docker manages
  permissions and backup boundaries cleanly.

### Security

- **IF building a runtime image THEN** create a non-root user (UID >
  1000), `COPY --chown`, `USER <name>` near the end. The api/web
  images already do this.
- **IF a container needs to bind a port < 1024 THEN** prefer a higher
  port + a reverse proxy. If you must, `cap_add: [NET_BIND_SERVICE]`
  + `cap_drop: [ALL]`.
- **IF you're tempted by `privileged: true` THEN** stop. Find another
  way. Privileged containers bypass all isolation.
- **IF you're tempted to mount the Docker socket THEN** stop. The
  socket is root-equivalent on the host.

## Anti-Patterns

- **`:latest` tag in production.** Non-reproducible. Silent breaking
  changes the next time the image is pulled.
- **Secrets in `ENV` or `ARG`.** Visible in `docker history` and
  `docker inspect`. Use BuildKit secrets or compose secrets.
- **Cleanup in a separate `RUN`.** Doesn't reduce image size — the
  prior layer's diff still contains the cached packages.
- **`COPY . .` before dep install.** Breaks the dependency cache on
  every commit. Source goes AFTER install.
- **`ADD` when `COPY` would do.** `ADD` auto-extracts tars and fetches
  URLs — surprising behavior, security risk. Use `COPY`.
- **Shell-form `CMD`.** No signal forwarding. Graceful shutdown fails.
- **Running as root.** A container compromise becomes a host compromise
  faster than you think.
- **Logging to files inside the container.** Files disappear when the
  container is removed. Log to stdout/stderr; let Docker capture.
- **Empty defaults in compose `environment:` (`${VAR:-}`) for secrets
  meant to come from env_file.** The empty string wins. (`docs/bugs.md`
  #12.)

## Review Checklist

**Dockerfile:**
- [ ] Multi-stage with named stages
- [ ] Base image pinned to patch version (or digest)
- [ ] Package cache cleaned in the same `RUN` layer
- [ ] Manifests copied before source; install runs against manifests only
- [ ] Non-root user with `COPY --chown`
- [ ] `HEALTHCHECK` defined and matches a real liveness endpoint
- [ ] `CMD` in exec form
- [ ] No secrets in `ENV`, `ARG`, or `RUN`
- [ ] `.dockerignore` excludes `.git`, `node_modules`, `.env*`, build outputs

**Compose:**
- [ ] `depends_on: condition: service_healthy` where it matters
- [ ] Named volumes for persistent data
- [ ] Ports for non-public services bound to `127.0.0.1:`
- [ ] env_file used for secrets; not in `environment:` (no empty defaults)
- [ ] `restart: unless-stopped` in prod compose
- [ ] Resource limits set for prod-overlay services if running on a
      small host
- [ ] No `privileged: true`, no Docker socket mount

## Agent Behavior Instructions

1. Before adding a new service, read the existing `compose.yaml` to
   match its conventions (env style, network, naming).
2. When proposing a new Dockerfile, check whether a multi-stage pattern
   already exists in the repo for the same language and reuse the shape.
3. Surface env_file precedence explicitly when wiring secrets — say
   which file provides the var and confirm it's NOT in the
   `environment:` block of compose.yaml.
4. After any compose edit that adds/changes env vars, recommend
   `docker compose up -d --no-deps --force-recreate <service>` (NOT
   `restart`).
5. Cite `docs/bugs.md` entries (#3, #12) when the user is about to
   repeat a known compose pitfall.

## Expected Output Format

When proposing a Dockerfile or compose addition:

```
SERVICE: <name>
IMAGE: <base:exact-version>
STAGES: <list>
USER: <non-root UID>
HEALTHCHECK: <command + interval>
ENV SOURCE: <which compose block / env_file>
PORTS: <127.0.0.1:host:container | internal-only>
DEPENDS_ON: <service: condition>
VOLUMES: <named volumes for persistence>
```

## Examples

PrimitiveHub's `apps/api/Dockerfile` is the canonical 3-stage uv-based
Python example: deps → builder → runner, non-root djangouser, healthcheck
against `/api/v1/healthz`, exec-form CMD. `apps/web/Dockerfile` uses the
Next.js standalone output pattern with nextjs user.

`compose.yaml` + `compose.override.yaml` show the env_file pattern: api
service gets `env_file: ./apps/api/.env (required: false)` in the dev
overlay; secrets live in the gitignored `.env`. The base compose has NO
`S3_*` defaults in `environment:` because those would override env_file
(the bug we hit while wiring R2).

## References

- Docker docs: https://docs.docker.com/build/cache/
- Compose file spec: https://docs.docker.com/compose/compose-file/
- ADR-0005 (R2 + env_file) — wires the rule for secrets
- `docs/bugs.md` #3 (restart vs force-recreate), #12 (env_file precedence)
- Companion: `feedback-containerize` memory rule
- Companion: `feedback-localhost-only` memory rule
