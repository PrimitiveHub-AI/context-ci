# Architecture Decision Records

> **Purpose:** Capture every load-bearing architectural choice with
> enough context that future-me — or any new engineer — can
> understand WHY the system looks the way it does without re-deriving
> the analysis.

## Format

Each ADR is a single markdown file:
`NNNN-<kebab-case-title>.md`. Numbering is monotonic. Once an ADR
exists, it does not get renumbered; superseded ADRs link to their
replacement.

```markdown
# ADR-NNNN: Title

**Status:** Proposed / Accepted / Superseded / Deprecated
**Date:** YYYY-MM-DD
**Supersedes:** ADR-XXXX (if any)
**Superseded by:** ADR-YYYY (if any)

## Context
What was the situation? What constraints applied? What were we trying
to achieve?

## Decision
What we chose. Be specific.

## Alternatives considered
At least 2-3 alternatives, with the reason each was rejected.

## Consequences
What follows from this choice. Positive AND negative.

## References
Links to primitives, threat-model entries, vendor docs, prior ADRs.
```

## Active records (newest first)

| # | Title | Status |
|---|---|---|
| [0010](./0010-token-storage-httponly-cookies.md) | Token storage: httpOnly cookies + same-origin proxy | Accepted |
| [0009](./0009-oidc-two-issuer-compose-pattern.md) | OIDC two-issuer model in compose-dev | Accepted |
| [0008](./0008-content-addressed-storage.md) | Object key = SHA-256 digest | Accepted |
| [0007](./0007-authentik-for-oidc.md) | Authentik for OIDC (over alternatives) | Accepted |
| [0006](./0006-postgres-rls-multi-tenancy.md) | Postgres RLS for tenant isolation | Accepted |
| [0005](./0005-cloudflare-r2-v1.md) | Cloudflare R2 for v1; MinIO swap-in for enterprise | Accepted |
| [0004](./0004-procrastinate-over-celery.md) | Procrastinate over Celery for background jobs | Accepted |
| [0003](./0003-django-ninja-over-drf.md) | Django Ninja over DRF | Accepted |
| [0002](./0002-monorepo-apps-layout.md) | Monorepo with apps/web + apps/api | Accepted |
| [0001](./0001-nextjs-16-app-router.md) | Next.js 16 App Router for frontend | Accepted |

## When to write an ADR

Write one when:

- The decision affects how a class of future work has to be done
  (e.g., "we use Ninja, not DRF" affects every endpoint we'll ever
  ship).
- Reasonable engineers could have gone the other way.
- Reversing the decision later would be expensive (data migration,
  re-architecture, vendor lock-in, retraining the team).

Skip an ADR when:

- It's a one-off implementation choice with no future ripples
  ("we wrap this constant in a function for testability").
- It's just style (formatter, linter rules).
- It would only restate something already in the spec, the threat
  model, or a primitive.

## How to use these

When making a decision that smells like an ADR:

1. Search this index for an existing entry that already addresses it.
2. If yes, follow it. If you disagree, propose superseding it (don't
   silently violate).
3. If no, write one. Status `Proposed` while open; `Accepted` once
   merged.

ADRs become the institutional memory of the project. They are the
reason we can answer "why did we do it this way?" in three years
without guessing.
