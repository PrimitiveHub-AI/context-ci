# ADR-0002: Monorepo with apps/web + apps/api

**Status:** Accepted
**Date:** 2026-05-28

## Context

When Phase 3 began, the v0-generated Next.js landing-page prototype
sat at the repo root. We needed a backend. Two structural choices:

1. Multi-repo: `primitivehub/web` + `primitivehub/api` + future
   `primitivehub/scanners`, `primitivehub/cli`.
2. Monorepo: `primitivehub/` containing `apps/web/`, `apps/api/`,
   `apps/scanners/`, etc.

Both are defensible. The decision affects every cross-cutting concern
(types, contracts, CI, release).

## Decision

Monorepo: `primitivehub/app/` (the repo) → `apps/web/` + `apps/api/`
as siblings. Future apps (scanners, CLI) land as `apps/<name>/`.

Cross-cutting concerns (`docs/`, `infra/`, `compose.yaml`) live at
the repo root.

## Alternatives considered

1. **Multi-repo** — Each app independently versioned, deployable, and
   ownable. Rejected because:
   - The frontend `Primitive` TypeScript type and the backend
     `PrimitiveOut` Ninja schema have to stay in lockstep. In a
     multi-repo world, this is a manual sync per change; in a monorepo,
     a parity test in `apps/api/tests/test_parity.py` catches drift
     in CI.
   - The OIDC flow spans both apps (web does the redirect + token
     storage, api validates JWTs). Cross-repo coordination would slow
     this kind of change.
   - We're a single maintainer + AI engineering partner. Multi-repo
     overhead is not what we need; single-repo discipline is what we
     need.

2. **Turborepo / Nx workspace** — Same monorepo structure with task
   orchestration on top. Rejected for v1 because:
   - We don't have shared TypeScript packages between apps (web is TS,
     api is Python; no JS code is shared).
   - `docker compose` is the task orchestrator; we don't need a
     second one.
   - Can be adopted later if we add a `packages/` layer (shared types,
     a JS SDK) without restructuring.

3. **Polyrepo with git submodules** — Same complexity as multi-repo,
   plus submodule UX problems. Rejected outright.

## Consequences

**Positive:**
- One PR can touch web + api atomically (e.g., the OIDC PR touched
  both sides; reviewing it as one diff was clearer than two
  cross-referenced PRs).
- Single CI configuration. `apps/web/**` paths trigger the web build,
  `apps/api/**` paths trigger the api build (configured in
  `.github/workflows/`).
- Strategic docs (`docs/`, `CLAUDE.md`, `DESIGN.md`) sit above both
  apps and are universally referenced.
- `apps/web/content/primitives/` holds expert cognition primitives that
  guide BOTH apps (frontend-design-elite influences UI; django-ninja-
  production influences API). Living in the web app is historical (the
  primitives are also the registry's seed data); they're cross-cutting
  in practice.

**Negative:**
- A `git clone` pulls everything, even if a contributor only cares
  about one app. Acceptable — the repo is < 100 MB.
- Tooling has to be tolerant of two stacks (pnpm + uv side by side).
  The Dockerfiles isolate this cleanly.
- Migration path if we ever need to split: each `apps/<name>/` is
  already self-contained (own Dockerfile, own deps, own README). A
  future split is a `git filter-branch` away.

## References

- `compose.yaml` — orchestrates all apps from the root.
- `CLAUDE.md` § Repository layout — canonical structure.
- `apps/web/content/primitives/feedback-bloat-control.md` (memory) —
  why we limit primitive proliferation.
