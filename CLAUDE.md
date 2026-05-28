# CLAUDE.md — PrimitiveHub project guidance

> **This file is auto-loaded into every Claude Code session in this repository.**
> It enforces project-specific conventions, points to canonical docs, and
> tells future-Claude which **expert primitives** to load before any frontend
> work. It is not optional reading. It is the contract.

## Project identity

PrimitiveHub is a **CyberOrca Labs initiative** — the trusted registry for
AI Context Primitives. The product positions itself as "GitHub Enterprise
for trusted AI Context Primitives" and launches alongside an arXiv
technical paper on **agent-context as a new supply-chain attack surface**.

- **Domain:** primitivehub.ai (owned, **not yet announced**)
- **Launch posture:** pre-launch, secret. No public deploys. No social
  posts. No indexing.
- **Target launch:** Q3 2026 alongside the arXiv paper.

See [project memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_primitivehub.md)
and [launch posture memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_launch_posture.md)
for the full picture. **Read both before responding to a strategic question.**

## Canonical documents (treat as authoritative)

| Path | What it defines |
|---|---|
| [`docs/threat-model.md`](./docs/threat-model.md) | 10 supply-chain attack categories Context CI is designed to detect. Cited by the paper. |
| [`docs/spec.md`](./docs/spec.md) | Primitive Spec v0.1: frontmatter, body sections, content addressing, in-toto Attestation predicate, Sigstore signing model, SLSA mapping. |
| [`docs/README.md`](./docs/README.md) | Doc index + planned OSS sibling repos. |

When you write code that touches any of: cryptographic vocabulary,
attestation, signing, primitive validation, or the threat model — **read
the relevant docs/* first.** The spec is the contract; the threat model
is the justification.

## Expert primitives — load these before any frontend work

The directory [`content/primitives/`](./content/primitives/) holds the
project's expert cognition primitives, calibrated to the actual stack
and the actual codebase. **Before making any non-trivial frontend
change, read the primitives in the second column.**

| Touching… | Load these primitives |
|---|---|
| Tailwind classes, `app/globals.css`, theme tokens, fonts | [`content/primitives/tailwind-v4-mastery.md`](./content/primitives/tailwind-v4-mastery.md) |
| Any file in `app/` (pages, layouts, route handlers, server/client decisions) | [`content/primitives/nextjs-16-app-router.md`](./content/primitives/nextjs-16-app-router.md) |
| Components in `components/ui/` or `components/<feature>/`, variants, primitives composition | [`content/primitives/shadcn-ui-composition.md`](./content/primitives/shadcn-ui-composition.md) |
| **Any** UI / visual design decision — taste, hierarchy, microcopy, restraint | [`content/primitives/frontend-design-elite.md`](./content/primitives/frontend-design-elite.md) |
| Producing a DESIGN.md, documenting a screen's visual logic | [`content/primitives/design-md-spec.md`](./content/primitives/design-md-spec.md) |

**These primitives reference each other.** Loading `frontend-design-elite`
references the demo-data discipline from `feedback-no-fake-numbers`
memory; loading `tailwind-v4-mastery` references the actual
`app/globals.css`; loading `nextjs-16-app-router` references the
server-split PR we already shipped. Read them as a connected system, not
as isolated docs.

## Hard rules

These are **enforced by user instruction**; not negotiable.

1. **Containerize everything** — every service runs in Docker. See
   [feedback-containerize memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md).
2. **pnpm only**, never npm. See
   [feedback-pnpm memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md).
3. **Localhost-only dev binding** — `127.0.0.1`, never `0.0.0.0`,
   ever. See [feedback-localhost-only memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md).
4. **No fake numbers as fact** — every UI metric is either reproducible
   or labeled `<DemoDataBadge>`. See
   [feedback-no-fake-numbers memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_no_fake_numbers.md).
5. **No public deploys, no social posts, no domain references** anywhere
   indexable until the paper publishes. Use `noindex` defenses + the
   `chore/noindex-everywhere` belt-and-suspenders that's already merged
   or pending merge.
6. **No npx skill installs.** External AI skills get *read into
   /tmp/primitivehub-skills/, distilled into a spec-conformant
   primitive in `content/primitives/`, source deleted*. The npx
   install path is treated as a supply-chain attack vector (T5 in our
   threat model).

## Cryptographic vocabulary (locked)

- **Content Digest** = SHA-256 hash of the canonical content
- **Signature** = Ed25519 (planned via Sigstore keyless OIDC; not yet
  implemented)
- **Attestation** = Context CI validation record (in-toto Statement with
  PredicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`)
- **Provenance Chain** = author → validation → review → release

**Never write "SHA-256 signed"** — SHA-256 is a hash, not a signature.
This wording is load-bearing for the paper's correctness.

## Architecture (locked decisions)

- **Frontend:** Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui ✓ done
- **Backend (Phase 3+):** Django 5 + Django Ninja + Postgres 17
- **Cache / sessions:** Valkey (not Redis)
- **Jobs:** Procrastinate (Postgres-backed; defers RabbitMQ to Phase 5+)
- **Object storage:** Cloudflare R2 (v1); MinIO swap-in for enterprise
  self-host (Phase 7). Object key = `sha256:<hex>` always.
- **Auth / identity:** Authentik (OIDC, self-hosted, containerized)
- **Signing:** Public Sigstore (Phase 4); self-hosted Sigstore (Phase 7
  for private registries — public Rekor's transparency log would
  publicly disclose private-registry author identities)
- **Multi-tenancy:** Shared schema + `organization_id` + Postgres RLS
- **CI:** GitHub Actions → GHCR
- **Deployment:** Hetzner CX22+ (8GB) + Docker Compose

## Build hygiene

- `pnpm typecheck` must pass before any commit touching `.ts`/`.tsx`.
- `pnpm check:data` must pass before any commit touching `lib/data/*`
  or `lib/types.ts`. The data-integrity guard is non-negotiable.
- Real TS errors block builds — `next.config.mjs` does NOT silence them
  (the v0 `ignoreBuildErrors: true` flag was removed in Phase 1).

## Workflow

- **PRs over direct-to-main.** Even for docs.
- **One logical change per PR.** Reviewability is itself a trust signal.
- **Branch from `main`** unless there's a stated reason to stack.
- **No merging without the user's explicit OK** — even on a session
  where they've trusted you to do everything else.

## When in doubt

1. Read the relevant primitive in `content/primitives/`.
2. Read the relevant `docs/*`.
3. Read the relevant memory file.
4. **Ask.** The user has stated repeatedly that they value being
   consulted on direction. They prefer two clarifying questions to one
   wrong assumption.

---

This file is updated whenever a primitive is added or the contract
shifts. It is meant to be a load-bearing reference, not a snapshot.
