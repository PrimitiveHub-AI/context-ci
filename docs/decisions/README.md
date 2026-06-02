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
| [0031](./0031-mcp-server-as-transport.md) | `@primitivehub/mcp-server` as the MCP transport layer (Gate G-D opener) | Accepted |
| [0030](./0030-fp-resolution-and-av-vendor-parallel.md) | False-positive resolution methodology + AV-vendor product-family framing | Accepted |
| [0026](./0026-phub-lock-format-and-drift-detection.md) | `phub.lock` format + drift detection (`--check-lock` / `--update-lock`) | Accepted |
| [0025](./0025-active-posture-and-phub-audit.md) | Active posture + `phub audit` (the five-surface arc) | Accepted |
| [0024](./0024-sarif-and-github-action.md) | SARIF 2.1.0 as canonical CI integration + composite GitHub Action | Accepted |
| [0023](./0023-phub-cli-and-detector-parity.md) | `phub` CLI as user-facing surface + detector-parity discipline | Accepted |
| [0022](./0022-publishing-deferred-to-launch.md) | `@primitivehub/verify` npm publish deferred to launch (three-lock gate) | Accepted |
| [0021](./0021-conformance-suite-as-executable-contract.md) | Conformance suite as the executable contract definition | Accepted |
| [0020](./0020-verify-as-reference-implementation.md) | `@primitivehub/verify` as the TS/JS reference implementation | Accepted |
| [0019](./0019-doctrine-versioning-policy.md) | Doctrine + brand-voice + OKRs versioning policy | Accepted |
| [0018](./0018-context-policy-language.md) | Context Policy Language v0.1 spec + phub as reference implementation | Accepted |
| [0017](./0017-workbench-to-primitive-forge-rename.md) | Workbench v2 → Primitive Forge rename | Accepted |
| [0016](./0016-context-ci-top-10-versioning.md) | Context CI Top 10 v0.1 — taxonomy as versioned public spec | Accepted |
| [0015](./0015-trust-contract-versioning.md) | Trust Contract v0.1 versioning + deprecation policy | Accepted |
| [0014](./0014-public-read-rls-policy.md) | Public-read RLS policy (visibility as a first-class concept) | Accepted |
| [0013](./0013-trust-bundle-format.md) | Trust Bundle format: `application/vnd.primitivehub.bundle+json` (superseded by Trust Contract v0.1 spec; original decision retained for history) | Accepted |
| [0012](./0012-detector-protocol.md) | Detector Protocol for Context CI | Accepted |
| [0011](./0011-sigstore-backend-abstraction.md) | Sigstore backend abstraction: public / staging / self-hosted | Accepted |
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
