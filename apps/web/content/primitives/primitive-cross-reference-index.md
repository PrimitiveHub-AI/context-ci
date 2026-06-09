---
spec_version: "0.1"
name: primitive-cross-reference-index
version: 0.1.0
type: reference
domain: meta
author: PrimitiveHub Labs (2026-05-30)
license: CC-BY-4.0
tokens: 1800
token_budget: 2500
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
  - v0
  - windsurf
use_when:
  - "Starting work on a PrimitiveHub surface and deciding which primitives to load first"
  - "Reviewing a PR that touches a specific feature"
  - "Auditing a feature for missing safeguards / coverage"
do_not_use_when:
  - "Trivial changes (one-line fixes, typo, formatting)"
attestation: cci-v0.1
description: "Lookup table from PrimitiveHub features → the 5-10 most relevant primitives. Bounded by the bloat-control rule — never load more than what's actually load-bearing for the change in front of you."
keywords: [index, reference, lookup, primitive-map, bloat-control]
---

# Primitive Cross-Reference Index

> **Bloat-control rule:** Max 10 primitives per feature. If the surface
> needs more, the surface is too broad and should split. The list per
> row is the maximum you'd ever need — most changes use 2-4.
>
> All primitives live in `apps/web/content/primitives/`. Architecture
> Decision Records live in `docs/decisions/`. Strategic docs live in
> `docs/`.

## How to use

1. Find the feature/surface the change touches.
2. Read the listed primitives (or scan their Decision Rules).
3. Apply the bloat-control discipline — if you reached for 6+ on a
   single PR, surface the breadth to the user and consider splitting.

## Before any surface: discovery & design

Every row below answers *how to build* a known surface. The step that
comes first — *whether and what to build, and when to stop and ask* — is
its own cross-cutting primitive, loaded before the table:

| Moment | Primitive to load |
|---|---|
| Starting any new feature / surface / behavior change (scaled design gate) | `discovery-and-design-discipline` (Mode B), then the surface row below |
| A strategic / GTM / opportunity / positioning question | `discovery-and-design-discipline` (Mode A) + `doctrine` |

## Frontend surfaces

| Surface | Primitives to load |
|---|---|
| `/registry` browse + filters | `nextjs-16-app-router`, `react-19-patterns`, `frontend-design-elite`, `shadcn-ui-composition`, `accessibility-wcag22` |
| `/primitive/[slug]` detail page | `nextjs-16-app-router` (SSG + hydration), `react-19-patterns` (TanStack), `frontend-design-elite`, `shadcn-ui-composition`, `accessibility-wcag22` |
| `/bundles` page | `react-19-patterns`, `frontend-design-elite`, `shadcn-ui-composition` |
| `/contributors` (queue + list) | `react-19-patterns`, `frontend-design-elite`, `dashboard-information-design`, `accessibility-wcag22` |
| `/validation` (pipeline visualization) | `frontend-design-elite`, `tufte-data-visualization`, `dashboard-information-design`, `accessibility-wcag22`, `framer-motion-discipline` |
| `/forge` (Primitive Forge — markdown editor / authoring surface) | `nextjs-16-app-router`, `react-19-patterns`, `frontend-design-elite`, `accessibility-wcag22` |
| `/auth/login` + `/auth/callback` + `/auth/logout` | `nextjs-16-app-router`, `security-engineering-supplychain` |
| Navbar + user dropdown + org picker | `shadcn-ui-composition`, `frontend-design-elite`, `react-19-patterns`, `accessibility-wcag22` |
| Sign-in / OIDC flow review | `security-engineering-supplychain`, ADR-0007, ADR-0009, ADR-0010 |
| Any Tailwind / `globals.css` change | `tailwind-v4-mastery`, `frontend-design-elite` |
| Any Radix overlay (dialog, dropdown, popover) | `shadcn-ui-composition`, `accessibility-wcag22`, `framer-motion-discipline` (if animated) |
| Any chart / score / numeric data display | `tufte-data-visualization`, `frontend-design-elite` |
| Any dashboard surface | `dashboard-information-design`, `tufte-data-visualization`, `frontend-design-elite` |

## Backend surfaces

| Surface | Primitives to load |
|---|---|
| New Ninja endpoint | `django-ninja-production`, `ddia-multi-tenant`, `security-engineering-supplychain` |
| New model / migration | `ddia-multi-tenant`, `postgresql-production`, `django-ninja-production`, `security-engineering-supplychain` |
| Tenant scoping / RLS / org-context | `ddia-multi-tenant`, `security-engineering-supplychain`, ADR-0006 |
| Upload endpoint (storage layer) | `security-engineering-supplychain`, `ddia-multi-tenant`, `django-ninja-production`, ADR-0008 |
| Download endpoint (content-addressed) | `security-engineering-supplychain`, `django-ninja-production`, ADR-0008 |
| Attestation / signing path (Phase 4) | `security-engineering-supplychain`, `ddia-multi-tenant`, ADR-0010-adjacent (Sigstore choice) |
| Postgres query optimization | `postgresql-production`, `ddia-multi-tenant` |
| Caching / Valkey work | `valkey-caching-patterns`, `ddia-multi-tenant` |
| Procrastinate task definition | `django-ninja-production`, `ddia-multi-tenant`, `security-engineering-supplychain` |
| Authentik / OIDC backend change | `security-engineering-supplychain`, ADR-0007 |

## Infrastructure surfaces

| Surface | Primitives to load |
|---|---|
| Dockerfile edit | `docker-compose-discipline`, `feedback-containerize` memory |
| compose.yaml / overlay edit | `docker-compose-discipline`, `feedback-localhost-only` memory |
| postgres init / role / grant change | `docker-compose-discipline`, `postgresql-production`, ADR-0006 |
| CI workflow edit | `docker-compose-discipline` |

## Strategic / spec surfaces

| Surface | Primitives + docs to load |
|---|---|
| Touching cryptographic vocabulary | `security-engineering-supplychain`, `docs/spec.md` § Vocabulary, `CLAUDE.md` § Cryptographic vocabulary |
| Touching attestation predicate | `docs/spec.md` § Attestation, `docs/threat-model.md`, `security-engineering-supplychain` |
| Adding to threat model | `security-engineering-supplychain`, `docs/threat-model.md`, `docs/principles.md` |
| Writing a new primitive doc itself | `design-md-spec`, `feedback-load-primitives` memory |
| Updating DESIGN.md | `frontend-design-elite`, `design-md-spec`, `tufte-data-visualization` |
| Strategic decisions (architecture, vendor, pattern) | `docs/decisions/README.md` (write an ADR), `docs/principles.md`, `docs/vision.md` |

## Universal-load primitives (every PR considers these)

| Primitive | Why universal |
|---|---|
| `frontend-design-elite` | Every UI change is a taste call |
| `security-engineering-supplychain` | Every backend change has a security goal triplet |
| `feedback-bloat-control` (memory) | Discipline on which primitives to load |
| `feedback-no-fake-numbers` (memory) | Every UI metric is reproducible OR labeled |
| `feedback-self-audit` (memory) | Run the audit before reporting done |

## Priority stack when primitives conflict

```
1. Security / cryptographic correctness  (security-engineering-supplychain)
2. Truth (no fake numbers / reproducibility)
3. Tenant isolation (ddia-multi-tenant)
4. Spec conformance (the spec is the contract)
5. Stack correctness (nextjs / tailwind / shadcn primitives)
6. Quantitative truth (tufte / dashboard primitives)
7. Accessibility (accessibility-wcag22)
8. Taste / restraint (frontend-design-elite)
9. Velocity
```

Higher always wins. Cross-reference `feedback-priority-stack` memory rule.

## How this index stays current

When a primitive is added: add it to the relevant surface row.
When a surface is added: add a row.
When a primitive is renamed / merged / removed: update every row that
referenced it.

This file is the lookup table — `feedback-load-primitives` memory tells
you to read it; `CLAUDE.md` § Expert primitives is the canonical pointer.
