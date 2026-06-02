# PrimitiveHub Doctrine

> **Version:** v0.1
> **Last reviewed:** 2026-05-31
> **Owner:** mhm
> **Change policy:** See [ADR-0019](./decisions/0019-doctrine-versioning-policy.md). Breaking changes require a `doctrine-rfc` issue with ≥48h review.
>
> **Status:** This is the operational law of the project. It is short on purpose. Every line is load-bearing.
>
> **Relationship to other docs:** [`docs/principles.md`](./principles.md) is the philosophical layer — the 18 beliefs the project ships against. This document is the operational layer — what we enforce on every PR. Principles inform; doctrine commands. They are complementary, not duplicative.

---

## Mission

**Operational mission:**
Prevent AI agents from consuming untrusted context.

**Philosophical mission:**
Make AI-agent context verifiable before it becomes executable influence.

Use the operational mission when explaining to customers and engineers.
Use the philosophical mission when explaining to researchers,
regulators, and the paper.

## Category statement

**PrimitiveHub is the Context Firewall for AI agents.**

The product enterprises buy is a control plane that verifies, governs,
attests, and gates every piece of context an AI agent consumes —
instructions, skills, rules, MCP configs, AGENTS.md, CLAUDE.md, anything.

- The **category** we define is **Context CI**.
- The **standard** we author is the **PrimitiveHub Trust Contract** +
  **Context CI Top 10** + **CBOM**.
- The **position** we occupy is **in front of every registry** —
  including the ones that do not exist yet.

We are not a registry. We are the verifier every registry eventually
embeds.

## The named enemy

**Unverified agent context.**

Specifically:

- Random Markdown consumed at runtime
- Poisoned `SKILL.md` / `AGENTS.md` / `CLAUDE.md` files
- Malicious `.cursor/rules`
- Untrusted MCP configs (`mcp.json`)
- Blind `npx` skill installs
- Prompt injection hidden in documentation
- Enterprise AI agents consuming context with no provenance, no
  digest, no attestation, and no policy

Every PR, every spec, every feature must reduce the surface area of
unverified agent context — or it does not belong on the roadmap.

## Ideal Customer Profile (ICP)

**ICP-1 — primary launch target.**
Head of AI Safety / Head of Engineering / VP Security at a regulated
mid-market enterprise (banking, healthcare, energy, government,
defense) running internal AI agents in production. Budget:
$50k–$250k/yr. Decision cycle: 60–120 days. Compliance-driven.
Procurement requires audit trails.

**ICP-2 — secondary, post-launch.**
CISO at a Fortune 1000 with an internal LLM/agent platform team.
Larger budget, slower cycle, longer reference chains.

**ICP-3 — strategic, embed-not-customer.**
Platform / security team at a model provider (Anthropic, OpenAI,
Google) or IDE vendor (Cursor, JetBrains, GitHub Copilot). Goal:
integration, not revenue.

All product, copy, and pricing decisions in 2026 optimize for ICP-1.
ICP-2 informs the feature backlog (audit logs, SSO, RBAC, self-hosted).
ICP-3 informs the embed strategy (verifier ergonomics, MIT license,
< 50KB kernel).

## The Operating Laws

These are the project's operational laws. A PR that violates one is
not a tradeoff to discuss — it is rejected on sight.

1. **No context without verification.** Every primitive PrimitiveHub
   touches is scanned before it is trusted.
2. **No verification without digest.** Verification claims pin to a
   SHA-256 content digest. No digest, no claim.
3. **No digest without attestation.** Every trusted digest has an
   in-toto attestation backed by Sigstore.
4. **No attestation without transparency.** Attestations live in a
   public log (Rekor); pre-launch they live in Sigstore staging.
5. **No install without policy.** `phub`, the GitHub Action, and the
   MCP server gate installs through `.primitivehub/policy.yaml`.
6. **No benchmark without reproducibility.** Every paper claim ships
   with a reproducible eval harness. No marketing-grade percentages.
7. **No trust claim without evidence.** "Trusted" requires
   `attestation.signed_at IS NOT NULL` AND a valid Rekor entry AND all
   Context CI detectors green.
8. **No primitive accepted without provenance.** Author → validation →
   review → release is mandatory.
9. **No enterprise adoption without auditability.** Every block
   decision and every allow decision produces an inspectable record.
10. **No fake AI hype.** No "AI-powered," no "next-gen," no
    "revolutionary." See [`brand-voice.md`](./brand-voice.md).

The Operating Laws version with this document. Changes require a
`doctrine-rfc` issue per ADR-0019.

## Decision algorithm

For any non-trivial decision (PR scope, feature proposal, design
partner ask, dependency add, marketing copy), ask in order:

1. **Does this serve an Operating Law?**
   Yes → priority. No → continue.

2. **Does this serve an active OKR this quarter?**
   (See [`okrs/2026-Q3.md`](./okrs/2026-Q3.md).)
   Yes → schedule. No → continue.

3. **Does this preserve our category position?**
   ("We are the Context Firewall, not a registry.")
   Yes → maybe. No → reject.

If a decision cannot pass step 3, the answer is no. Note the decision
in the relevant ADR or PR description; do not re-litigate next month.

## We are not …

The category is defined by what we refuse to be.

- We are **not** skills.sh — they accelerate installation; we verify
  it. Their tagline implies *"install fast."* Ours implies *"trust
  first."*
- We are **not** HuggingFace for prompts.
- We are **not** GitHub Verified AGENTS.md (when GitHub eventually
  ships it). We sit in front of it.
- We are **not** Cursor's marketplace, or any vendor-locked skill
  store.
- We are **not** a Notion template site.
- We are **not** a prompt engineering studio.
- We are **not** a "prompt marketplace."
- We are **not** a "Markdown CMS."
- We are **not** an AI productivity toy.
- We are **not** a pretty frontend around files.

Additions to this list are non-breaking. Removals require a
`doctrine-rfc` per ADR-0019.

## Layers of the Trust Runtime

(These are **layers** — product-system planes — not phases. Phases
live in [`roadmap.md`](./roadmap.md). Weeks and gates live in
[`execution-plan.md`](./execution-plan.md). This is parallel
vocabulary, not competing taxonomy.)

| Layer | Role | Backing artifacts |
|---|---|---|
| Trust Contract | The wire format. The spine. | `docs/spec.md` § 10, ADR-0013, planned ADR-0015 |
| Context CI | The scanner / detector pipeline. | `apps/api/scanners/`, ADR-0012, planned Top 10 spec |
| Verify Library | The trust kernel. | `@primitivehub/verify` (Phase 5.5.4) |
| Registry | Where primitives are registered. | `apps/api/registry/` |
| phub CLI | Developer enforcement layer. | Phase 5.5.3 |
| GitHub Action | Enterprise CI gate. | Execution plan PR 5.5.6 |
| MCP Server | Agent gateway. | Phase 5.5.5 |
| Primitive Forge | Authoring + live-validation surface. | Execution plan Phase 5.6 |
| Primitive Explorer | Etherscan-like transparency layer. | Execution plan PR 5.6.7 |
| Policy Engine | Decision layer. | Execution plan PR 5.5.G |
| CBOM | Inventory of agent-context dependencies. | Execution plan PR 5.6.5 |

If a surface needs trust logic that isn't in the Trust Contract, the
**contract gets extended** (with versioning discipline per planned
ADR-0015) — the surface does not branch. That rule is the difference
between a standard and a pile of features.

## North-star metric

**Verified context loads per week.**

Not GitHub stars. Not registered users. Not primitives published. Not
page views.

A verified context load is: an external caller (CLI, MCP, GitHub
Action, embed) successfully verifies a Trust Bundle against a digest.
It compounds with embed adoption. It is the metric that proves
PrimitiveHub is infrastructure.

Secondary metrics (track but do not optimize against):

- Context CI scans per week
- Risky context PRs blocked (in design-partner repos)
- Attestations issued
- CBOMs generated
- Enterprise policies enforced
- Third-party tools embedding `@primitivehub/verify`
- Organizations running private PrimitiveHub

Forbidden as a primary metric: anything that resembles "downloads" or
"users." They measure adoption shape, not category capture.

## Paper thesis (locked)

> AI-agent context has become executable influence. Existing software
> supply-chain controls protect code artifacts, but they do not
> adequately govern the natural-language and Markdown-based instruction
> artifacts consumed by AI agents. PrimitiveHub introduces Context CI,
> Trust Bundles, the Context CI Top 10 taxonomy, and CBOM as the
> manifest format for verifiable AI-agent context supply chains.

Use this verbatim in pitch decks, partner briefings, and the paper
abstract until the paper is accepted. Re-version on paper acceptance.

## Voice

See [`brand-voice.md`](./brand-voice.md) for killer phrases, banned
vocabulary, and on-voice / off-voice examples. The voice is the
doctrine made readable.

## How this document is used

- Every PR description references at least one Operating Law or KR
  from the active OKR set.
- Every ADR cites doctrine when an architectural decision derives from
  it.
- Every external piece of copy passes the decision algorithm and the
  brand-voice rules.
- Future AI contributors read this file via CLAUDE.md auto-load.
- Doctrine changes are PRs, reviewed against ADR-0019.

This file is short on purpose. If it grows past ~300 lines, something
has been added that should be in an ADR, a principle, or a primitive,
not here.
