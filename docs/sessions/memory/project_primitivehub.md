---
name: project-primitivehub
description: "PrimitiveHub project identity, ownership, mission, target architecture, and phased build plan"
metadata: 
  node_type: memory
  type: project
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

PrimitiveHub is a CyberOrca Labs initiative — not an independent entity. Domain: primitivehub.ai. Positions itself as **GitHub Enterprise for trusted AI Context Primitives** — a public registry + private/enterprise registry system for cryptographically attested, validated, versioned Markdown cognition modules.

**Repository:** github.com/DevXYZx/primitivehub (private). Local project root: `/srv/primitivehub/app`. Initial commit + Phase 1 refactor landed on main; `feat/server-split-and-demo-labels` open as Phase 2 workstream 1 PR.

**Core narrative:** "PrimitiveHub treats agent context as supply-chain material, not disposable prompt text." Anti–prompt-marketplace positioning. Dark/elite/technical/premium design language.

**Footer attribution:** "Powered by CyberOrca.sa" subtle, footer only. PrimitiveHub remains the primary product brand.

**Cryptographic vocabulary (locked):** Content Digest = SHA-256, Signature = Ed25519 (planned via Sigstore), Attestation = Context CI validation record, Provenance Chain = author → validation → review → release. NEVER say "SHA-256 signed" — SHA-256 is a hash.

**Strategic framing:** Two possible futures — (a) a public website where people browse Markdown primitives (small) or (b) a public + private registry where organizations govern, validate, version, sign, and distribute AI-agent context like software supply-chain artifacts (big). All architectural decisions must serve (b). Multi-tenancy (Organization → Registry → Repo → Primitive) belongs in the data model from Day 1.

**Target architecture (LOCKED, May 28 2026):**
| Layer | Choice |
|---|---|
| Frontend | Next.js 16 + TS + Tailwind v4 + shadcn/ui — DONE |
| Backend | Django 5 + **Django Ninja** (NOT DRF — chose Ninja for Pydantic models, async, auto-OpenAPI, ~50% less LOC) |
| Truth DB | PostgreSQL 17 |
| Cache / ephemeral state | Valkey (not Redis — OSS-governance fits the trust brand) |
| Task queue (v1) | **Procrastinate** (Postgres-backed, transactional, no broker) — defers RabbitMQ to Phase 5+ |
| Task broker (Phase 5+) | RabbitMQ — only when volume justifies |
| Object storage (v1, dev + prod) | **Cloudflare R2** — no MinIO container in v1. Free egress, built-in CDN, zero ops burden. Requires internet + Cloudflare account for dev. |
| Object storage (Phase 7 enterprise) | MinIO self-host as a swap-in via the S3 abstraction — same `boto3`/S3 client code, different endpoint. |
| Storage abstraction | S3-compatible client (`boto3` or `aiobotocore`) configured by env vars. Code never knows whether it's hitting R2 or MinIO. |
| Storage addressing | Content-addressed: object key = `sha256:<hex>` always |
| Auth / Identity | **Authentik** self-hosted (OIDC + SAML + LDAP). Shared Postgres with separate `authentik` DB for dev. |
| Signing (Phase 4, public) | **Public Sigstore** (Fulcio + Rekor) — keyless via OIDC. Free, hosted by Sigstore Foundation. |
| Signing (Phase 7, private/enterprise) | Self-hosted Fulcio + Rekor + Trillian — required because public Sigstore Rekor is publicly searchable and can't be used for private-registry author identities. |
| Multi-tenancy | **Shared schema + `organization_id` everywhere + Postgres RLS policies.** Simpler dev, fewer migrations. Schema-per-tenant deferred as Phase 7 option for air-gapped enterprise. |
| Schema (Day 1) | `Organization`, `OrganizationMember`, `Role`, `Registry`, `Repository`, `Primitive`, `PrimitiveVersion`, `Attestation`, `ValidationRun`, `ValidationFinding`, `AuditLog`. `Primitive.visibility = public \| private` flag from Day 1. |
| Search v1 / v2 | Postgres FTS / Meilisearch or Typesense |
| Analytics | Postgres event log v1, ClickHouse later (Phase 8+) |
| Observability | **Deferred** — no OpenTelemetry / tracing infrastructure in v1. Plain structured logs to stdout (captured by Docker). Real observability stack lands Phase 8+ alongside ClickHouse. |
| CI | GitHub Actions → GHCR (`ghcr.io/devxyzx/primitivehub-*`). CI builds + pushes all images. |
| Deployment v1 | Hetzner CX22+ (8GB RAM minimum) + Docker Compose |
| Dev machine target | 16GB+ RAM laptop, 7-container compose comfortable |
| Future enterprise self-host | Same images, different compose overlay, optional schema-per-tenant + self-hosted Sigstore |

**Phased build plan:**
- Phase 0 (done): v0 frontend, mock data
- Phase 1 (in progress, Phase 1 PR landed): clean architecture, lib/types, lib/data split, crypto vocab corrected, build hygiene
- Phase 2 (in progress, feat/server-split landed): server-split detail page, demo-data honesty, markdown content per primitive, lifecycle vocab, registry table view
- Phase 3: Real backend — Django/FastAPI + Postgres + Valkey + S3-compatible storage, primitive CRUD, versioning, auth (multi-tenant from Day 1)
- Phase 4: Context CI — RabbitMQ + Celery workers + validation pipeline + threat scanners
- Phase 5: Workbench + private repos + RBAC + audit logs
- Phase 6: Analytics + ClickHouse + enterprise dashboards
- Phase 7: Enterprise PrimitiveHub — SSO, on-prem MinIO, signed releases, allowlist/denylist, compliance exports

**Hard constraint (see [[feedback-containerize]]):** Every service runs in a container. Dev = docker compose. No host installs.

**Hard constraint (see [[feedback-pnpm]]):** pnpm is the JS package manager.

**Why this all matters:** The user is the lead. Credibility of the trust framing is the entire value proposition. Wrong cryptographic vocab, fake numbers presented as fact, host-installed services, single-tenant schema — all undermine the strategic position. Every decision should serve "GitHub Enterprise for AI Context Primitives," not "Markdown website."

Related: [[feedback-pnpm]], [[feedback-containerize]], [[user-workflow]]
