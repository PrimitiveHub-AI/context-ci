# CLAUDE.md — PrimitiveHub project guidance

> **This file is auto-loaded into every Claude Code session in this repository.**
> It is the **contract**: the non-negotiable rules + a router to the
> detailed docs. It is intentionally lean (ADR-0040 anti-bloat) — reference
> material lives in the linked docs, not here. Not optional reading.

## Project identity

PrimitiveHub is a **CyberOrca Labs initiative** — the trusted registry for
AI Context Primitives, positioned as "GitHub Enterprise for trusted AI
Context Primitives." Category: **Context Firewall for AI agents** (the
defense layer is the moat, not the storage layer — see Hard rule #9).

- **Domain:** primitivehub.ai (owned, **not yet announced**)
- **Launch posture (since 2026-06-07):** PRODUCT-FIRST, owner-triggered
  ([ADR-0042](./docs/decisions/0042-product-first-public-launch-and-distribution-repo.md)).
  Paper decoupled and owner-owned; the assistant does not raise it. The
  irreversible go-public flips stay human-only (Hard rule #5).

**Read before any strategic answer:**
[project memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_primitivehub.md)
+ [launch-posture memory](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_launch_posture.md)
+ [`docs/doctrine.md`](./docs/doctrine.md).

## Reference map — where everything lives

This contract routes; the detail lives in these docs. Read the relevant
one before working in its area.

| Topic | Document |
|---|---|
| Repository layout + phase status | [`docs/repo-structure.md`](./docs/repo-structure.md) |
| **Which expert primitive to load** for a change | [`docs/primitive-routing.md`](./docs/primitive-routing.md) |
| Per-app build/test gates | [`docs/build-hygiene.md`](./docs/build-hygiene.md) |
| Dev host requirements + memory troubleshooting | [`docs/dev-host.md`](./docs/dev-host.md) |
| Pinned tech versions | `apps/web/package.json` + `apps/api/pyproject.toml` |
| Operational law, category, decision algorithm | [`docs/doctrine.md`](./docs/doctrine.md) |
| Voice — killer phrases + banned vocabulary | [`docs/brand-voice.md`](./docs/brand-voice.md) |
| Architecture Decision Records | [`docs/decisions/`](./docs/decisions/) |
| Full doc index + strategic layer | [`docs/README.md`](./docs/README.md) |

## Hard rules

**Enforced by user instruction; not negotiable.**

1. **Containerize everything** — every service runs in Docker; no host
   installs ([feedback-containerize](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md)).
2. **pnpm only**, never npm
   ([feedback-pnpm](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md)).
3. **Localhost-only dev binding — six layers, not one.** `127.0.0.1`,
   never `0.0.0.0`, ever. Covers compose port specs + direct process
   binds + host reverse proxies + public DNS + firewall state + running-
   container bindings. Before claiming pre-launch posture intact, run
   `scripts/check-pre-launch-posture.sh` on the live host; CI auto-gates
   layer 1. Canonical incident: [docs/bugs.md § 26](./docs/bugs.md);
   automation: [ADR-0031](./docs/decisions/0031-pre-launch-posture-automation.md);
   [feedback-localhost-only](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md).
4. **No fake numbers as fact** — every UI metric is either reproducible
   or labeled `<DemoDataBadge>`
   ([feedback-no-fake-numbers](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_no_fake_numbers.md)).
5. **Public exposure is owner-triggered and product-first**
   ([ADR-0042](./docs/decisions/0042-product-first-public-launch-and-distribution-repo.md)).
   The arXiv paper is decoupled and owner-owned — it no longer gates
   launch, and the assistant does not raise it or volunteer paper advice.
   Distribution is one public OSS repo, `primitivehub/context-ci` (verify
   + phub + mcp-server + the phub-scan action), assembled from this
   monorepo via `scripts/build-public-repo.sh`; users download via npm +
   GitHub Releases. The dev monorepo stays private. The irreversible
   external flips — create/push the public repo, claim the `@primitivehub`
   npm org, run the gated `npm publish` workflows, flip DNS, lift
   `noindex` — are **HUMAN-ONLY** (the assistant prepares, never pulls
   these triggers; the ADR-0022 three-lock survives). `noindex` stays
   live until the owner flips it; the **website** DNS/noindex flip waits
   until Explorer + Forge round-trip + `/check` + a seed catalog exist —
   the package publish need not wait.
6. **No npx skill installs.** External AI skills are *read into
   `/tmp/primitivehub-skills/`, audited, distilled into a spec-conformant
   primitive in `apps/web/content/primitives/`, source deleted* — the
   six-step discipline + SK-NNN receipt in
   [ADR-0043](./docs/decisions/0043-external-skill-consumption-discipline.md)
   + [`docs/skill-consumption-ledger.md`](./docs/skill-consumption-ledger.md).
   The `npx` install path is a supply-chain vector (T5). Audit a cloned
   skill with `phub audit` (whole-tree — it warns on executable surface it
   does not cover) before reading it ([ADR-0025](./docs/decisions/0025-active-posture-and-phub-audit.md)).
7. **Active by default; passive only by explicit user choice.** Principle
   19 + [ADR-0025](./docs/decisions/0025-active-posture-and-phub-audit.md):
   we ship *guardians*, not just *linters*. Every new user-facing surface
   declares itself passive (waits for a target) or active (discovers its
   own targets) in its design note.
8. **False-positive triage is mandatory.** Principle 20 +
   [ADR-0030](./docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md).
   When `phub audit`/`phub scan`/the Context CI pipeline flags content,
   classify it via the four-path tree in
   [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md)
   § 1 BEFORE proposing a resolution. An `allow:` entry in
   `.primitivehub/policy.yaml` without a matching `FP-NNN` ledger entry in
   the same commit is a defect. Path A = edit content. B = narrow allow +
   ledger. C = lockstep detector tightening (Python + TS, ADR-0023). D =
   escalate; never silently allow.
9. **PrimitiveHub is "agent-context AV plus registry," not "GitHub for
   prompts."** [ADR-0030](./docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md)
   § 3 locks the product-family parallel. When writing copy, answering
   "what is this?", or shaping a surface, the AV product-family map
   (scanner / signature DB / allowlist DB / FP portal / on-access guard /
   runtime gate / cloud lookup / provenance) is the reference frame.

## Decision algorithm (from [`docs/doctrine.md`](./docs/doctrine.md))

For any non-trivial decision (PR scope, feature proposal, design-partner
ask, dependency add, marketing copy), ask in order:

1. **Does this serve an Operating Law?** (`docs/doctrine.md` § The
   Operating Laws.) Yes → priority. No → continue.
2. **Does this serve an active OKR this quarter?**
   ([`docs/okrs/2026-Q3.md`](./docs/okrs/2026-Q3.md).) Yes → schedule.
   No → continue.
3. **Does this preserve our category position?** ("We are the Context
   Firewall, not a registry.") Yes → maybe. No → reject.

If a decision cannot pass step 3, the answer is no. Note it in the
relevant ADR or PR description; do not re-litigate next month.

## Locked decisions

### Cryptographic vocabulary

- **Content Digest** = SHA-256 hash of the canonical content
- **Signature** = Ed25519 (planned via Sigstore keyless OIDC; not yet
  implemented)
- **Attestation** = Context CI validation record (in-toto Statement,
  PredicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`)
- **Provenance Chain** = author → validation → review → release

**Never write "SHA-256 signed"** — SHA-256 is a hash, not a signature.
This wording is load-bearing for the paper's correctness.

### Architecture

(Pinned versions live in the manifests — `apps/web/package.json` +
`apps/api/pyproject.toml`. A consolidated `docs/tech-stack.md` inventory
is planned on the `docs/tech-stack-inventory` branch.)

- **Frontend:** Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui (`apps/web/`)
- **Backend:** Django 5 + Django Ninja + Postgres 17 (`apps/api/`)
- **Cache / sessions:** Valkey (not Redis)
- **Jobs:** Procrastinate (Postgres-backed; defers RabbitMQ to Phase 5+)
- **Object storage:** Cloudflare R2 (v1); MinIO swap-in for enterprise
  self-host (Phase 7). Object key = `sha256:<hex>` always.
- **Auth / identity:** Authentik (OIDC, self-hosted, containerized)
- **Signing:** backend-abstracted ([ADR-0011](./docs/decisions/0011-sigstore-backend-abstraction.md)) —
  public Sigstore (v1), sigstage.dev (dev/CI), self-hosted Sigstore
  (Phase 7 private registries). One env var (`SIGSTORE_BACKEND`) swaps
  backends; the sign-call code never branches.
- **Multi-tenancy:** shared schema + `organization_id` + Postgres RLS
- **CI:** GitHub Actions → GHCR. **Deployment:** Hetzner CX22+ (8GB) + Docker Compose

## Loading the right primitives

[`apps/web/content/primitives/`](./apps/web/content/primitives/) holds the
project's expert cognition primitives, calibrated to our stack. **Before
any non-trivial change, load the matching primitives** — the full
touch → primitive map is in
**[`docs/primitive-routing.md`](./docs/primitive-routing.md)**. Max 5-10
per change ([feedback-bloat-control](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md));
if more match, the change is too broad — split it.

**Start here:** [`discovery-and-design-discipline`](./apps/web/content/primitives/discovery-and-design-discipline.md)
(what to build + when to stop and ask) and
[`primitive-cross-reference-index`](./apps/web/content/primitives/primitive-cross-reference-index.md)
(feature → primitives). When you write code touching cryptographic
vocabulary, attestation, signing, primitive validation, or the threat
model — read the relevant `docs/*` first. The spec is the contract; the
threat model is the justification.

## Canonical & strategic docs

**Authoritative — treat with the same discipline as code:**

| Doc | Defines |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Unified design doctrine — theme, palette, typography, components |
| [`docs/doctrine.md`](./docs/doctrine.md) | **Operational law** — mission, category, named enemy, Operating Laws, decision algorithm, north-star metric |
| [`docs/brand-voice.md`](./docs/brand-voice.md) | Voice filter — killer phrases, banned vocabulary; every external sentence passes through it |
| [`docs/threat-model.md`](./docs/threat-model.md) | The 10 supply-chain attack categories (Context CI Top 10) |
| [`docs/spec.md`](./docs/spec.md) | Primitive Spec v0.1 — frontmatter, content addressing, attestation predicate, Trust Bundle |
| [`docs/cbom-v0.1.md`](./docs/cbom-v0.1.md) | Context Bill of Materials v0.1 — agent-context inventory wire format ([ADR-0033](./docs/decisions/0033-cbom-v01.md)) |
| [`docs/corpus-v0.1.md`](./docs/corpus-v0.1.md) | Adversarial corpus — per-detector precision/recall/F1 ([ADR-0032](./docs/decisions/0032-adversarial-corpus-and-detector-precision-recall.md), v0.2 [ADR-0038](./docs/decisions/0038-corpus-v0_2-expansion-and-holdout-split.md)) |
| [`docs/owasp-llm-top10-crosswalk.md`](./docs/owasp-llm-top10-crosswalk.md) | Our Top 10 ↔ OWASP LLM Top 10 map; the scope boundary ([ADR-0040](./docs/decisions/0040-surface-architecture-and-anti-bloat-contract.md) §4) |
| [`docs/execution-plan.md`](./docs/execution-plan.md) | The 18-week arc, acceptance gates G-A..G-G, standards workstreams |
| [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md) | FP-NNN ledger + four-path triage (read before any `allow:` entry) |
| [`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md) | FN-NNN ledger — detector *misses* from the corpus gate |
| [`docs/skill-consumption-ledger.md`](./docs/skill-consumption-ledger.md) | SK-NNN ledger — every external skill consumed under Hard rule #6 ([ADR-0043](./docs/decisions/0043-external-skill-consumption-discipline.md)) |

**Strategic layer — read before any non-trivial work:**
[`vision.md`](./docs/vision.md) (WHY) ·
[`positioning.md`](./docs/positioning.md) (WHO we are NOT) ·
[`principles.md`](./docs/principles.md) (non-negotiable beliefs) ·
[`roadmap.md`](./docs/roadmap.md) (WHEN) ·
[`okrs/2026-Q3.md`](./docs/okrs/2026-Q3.md) (what we measure now) ·
[`bugs.md`](./docs/bugs.md) (what broke — grep before re-deriving).

**Discipline:** before a new feature, skim `vision.md` + `principles.md`.
Before a load-bearing library, skim `positioning.md` + write an ADR.
After fixing a bug, add a `bugs.md` entry (root cause + prevention)
*before* the fix merges — no silent fixes. Before debating an
architecture pattern, search `decisions/` for an existing ADR; supersede,
don't silently violate.

## Auto-memory rules (enforcement map)

Memories live in `/home/primitive/.claude/projects/-srv-primitivehub-app/memory/`,
surfaced via `MEMORY.md`. Each is consulted when its condition triggers.

| Rule | Triggers when… |
|---|---|
| [`feedback-pnpm`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_pnpm.md) | Adding/removing JS deps, lockfile work |
| [`feedback-containerize`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_containerize.md) | Spinning up any new service or dev workflow |
| [`feedback-localhost-only`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_localhost_only.md) | Any port binding in compose / app config |
| [`feedback-no-fake-numbers`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_no_fake_numbers.md) | Any numeric / metric in UI or copy |
| [`feedback-load-primitives`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_load_primitives.md) | Start of any non-trivial feature |
| [`feedback-audit-methodology`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_audit_methodology.md) | Before marking a feature "done" |
| [`feedback-self-audit`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_self_audit.md) | Before reporting work complete |
| [`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md) | Picking primitives for a feature |
| [`feedback-priority-stack`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_priority_stack.md) | Two primitives give conflicting guidance |
| [`feedback-extract-reusable`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_extract_reusable.md) | Building any component/helper/SDK |
| [`feedback-offer-test-commands`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_offer_test_commands.md) | Shipping any user-facing surface |
| [`feedback-skill-consumption-receipt`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_skill_consumption_receipt.md) | Consuming any external skill (Hard rule #6) |
| [`feedback-never-delete-held-code`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_never_delete_held_code.md) | Encountering `HELD` markers in code |
| [`user-workflow`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/user_workflow.md) | User pastes a prompt from another AI assistant |
| [`project-primitivehub`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_primitivehub.md) | Any strategic question |
| [`project-launch-posture`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/project_launch_posture.md) | Anything touching public-facing surface |

## Build, test & workflow

- **Build/test gates** (run before committing the relevant surface):
  [`docs/build-hygiene.md`](./docs/build-hygiene.md). **Dev host slow?**
  [`docs/dev-host.md`](./docs/dev-host.md) first — half of apparent bugs
  are memory exhaustion.
- **PRs over direct-to-main.** Even for docs.
- **One logical change per PR.** Reviewability is itself a trust signal.
- **Branch from `main`** unless there's a stated reason to stack.
- **No merging without the user's explicit OK** — even on a session where
  they've trusted you to do everything else.

## When in doubt

1. Read the relevant primitive
   ([`docs/primitive-routing.md`](./docs/primitive-routing.md) → the file).
2. Read the relevant `docs/*`.
3. Read the relevant memory file.
4. **Ask.** The user values being consulted on direction — they prefer
   two clarifying questions to one wrong assumption.

---

This file is the load-bearing contract. When a rule changes, a primitive
is added, or the structure shifts, update it (and the linked doc) in the
same PR. Keep it lean — reference detail belongs in the linked docs, not
here.
