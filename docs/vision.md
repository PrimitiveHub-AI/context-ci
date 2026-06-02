# PrimitiveHub Vision

> **Status:** Living document. Read this before any work that shapes
> the product. Edit only when the underlying conviction shifts.

## One-line

PrimitiveHub is the trust layer for AI agent cognition — the registry
where every piece of context an AI agent loads can be inspected,
verified, attested, and revoked.

## The thesis

The traditional software supply chain is well-studied. SLSA, in-toto,
Sigstore, package-manager provenance — the industry knows how to verify
that a compiled artifact originated from a source commit, was built in
a hardened environment, and was signed by an authorized identity.

**Agent context is the next supply-chain surface.** Every AI agent —
Claude Code, Cursor, Codex, Copilot, v0, Windsurf, and the MCP
ecosystem — loads a new class of artifact at runtime: cognition files.
Markdown primitives, skill definitions, system prompts, tool
descriptions, RAG corpora. These artifacts shape what the agent does
just as surely as code shapes what a program does. And the tooling to
verify, attest, sign, score, and revoke them does not exist at the
scale the agent ecosystem now requires.

PrimitiveHub builds that tooling. We are GitHub Enterprise for trusted
AI Context Primitives — a registry where every primitive carries a
content digest, every author identity is OIDC-bound, every release is
attested by a 10-stage Context CI pipeline, and every consumer can
prove that the cognition they loaded into their agent is the cognition
they thought they were loading.

## Why this exists

Three claims, in order of how much they reshape the world:

1. **Agent context is supply-chain material.** It propagates the same
   way code does — via package managers, marketplaces, copy-paste from
   READMEs, embedded in MCP servers. It can be backdoored the same way
   code can. It is currently treated like configuration. It is not
   configuration; it is executable cognition.

2. **Trust must be earned, not declared.** A "Trusted" badge means
   nothing if it isn't backed by an attestation that can be verified
   against a transparency log. The current ecosystem is full of
   "best-practice templates" with no provenance, no signature, no
   review history. We make trust *cryptographically falsifiable*: every
   `Trusted` claim either has an attestation backing it, or the claim
   is wrong.

3. **Socio-technical, not technical.** Anderson is right: security is
   not crypto. The hard problem isn't signing; it's the human +
   organizational + economic system around signing. PrimitiveHub bakes
   in reviewer reputation, role-bound publishing, governance escalation,
   abuse reporting, and revocation as first-class — not as
   afterthoughts. We import 30 years of AV-vendor process discipline
   (numbered FP ledgers, narrow allowlist entries with required
   justification, signature precision tuning, periodic re-review)
   because the FP-handling problem the AV industry already solved is
   structurally identical to the FP-handling problem an
   agent-context scanner faces — see
   [ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md).
   The product family parallel is load-bearing: we are the
   AV-product-family equivalent for agent cognition, not a registry
   with a side scanner.

## What we are NOT

- Not a prompt-injection detection company. The pipeline catches it,
  but the product is trust, not a single attack.
- Not an LLM provider, an agent framework, or a model marketplace.
- Not a github-pages-tier static site that lists "awesome prompts".
- Not a closed garden. The spec is open, the validator is open-source,
  the threat model is published, the paper is on arXiv.

## What "winning" looks like

### 1-year horizon (post-paper-launch)

- The Primitive Spec v0.1 is the canonical format for verified agent
  context. At least three independent implementations exist.
- ≥10,000 attested primitives in the public registry, signed via
  Sigstore.
- The Context CI pipeline is the reference detector for the 10
  supply-chain attack categories in our threat model. Cited in ≥5
  security-research papers.
- Enterprise self-hosted Sigstore is in production at ≥2 design partners.

### 3-year horizon

- "PrimitiveHub Trusted" is the badge agent frameworks display when
  loading verified context — analogous to "Verified by GitHub" today.
- The registry is the source of truth for ≥1M primitives across public
  + private surfaces.
- Context CI is the de-facto pre-submit check in CI/CD pipelines that
  ship agent products.
- The arXiv paper is the canonical reference for "AI agent context as
  supply-chain material" and has shaped industry standards (analog: how
  SLSA became the canonical software-supply-chain framework after the
  founding paper).

### 10-year horizon

- Every production AI agent loads only attested primitives by default.
  Unattested context is the unsafe default the way unsigned binaries
  are today.
- PrimitiveHub is to AI cognition what GitHub is to code: the place
  serious teams ship from, the place serious consumers trust by
  reference.
- The threat-model categories we publish today are vocabulary the
  industry uses to discuss agent compromise.
- The company is a foundational piece of internet infrastructure for
  agentic systems, comparable in scope and trust burden to a CA, a
  package registry, or a CDN.

## Active by default — what shipping the vision means

The vision sentence — "every piece of context an AI agent loads can be
inspected, verified, attested, and revoked" — has two halves. The
*passive* half is "given a file, tell me if it's safe." The *active*
half is "find every piece of context an agent could load, and tell me
what's safe." A registry that only delivers the passive half is a
linter; one that delivers both is infrastructure.

We commit to both halves. The five active surfaces locked in
[ADR-0025](./decisions/0025-active-posture-and-phub-audit.md) —
`phub audit`, `phub.lock`, `phub watch`, `phub install`, the MCP
runtime gate — are how the active half ships. Each subsequent feature
declares itself active or passive in its design note (per
[Principle 19](./principles.md)). The product does not advance toward
the 1/3/10-year horizon by stacking passive features; it advances by
shipping active surfaces that close "context can be inspected,
verified, attested, and revoked" from a thesis into observable default
behavior.

## Posture today

We are pre-launch and secret. The product is being built; the paper
is being written; the registry is being seeded. No public deploys, no
social posts, no domain references in indexable surfaces.

Launch is coordinated with arXiv publication in Q3 2026.

Until then, every commit is design work for that moment.

## How to use this document

When a decision needs to be made — a feature, a refactor, a partnership,
a wording choice in copy — ask:

1. Does this move us toward the 1/3/10-year horizon, or away from it?
2. Does this match what we are NOT, or contradict it?
3. Does this honor the three thesis claims, or quietly cheapen one?

If "yes / no / yes" — proceed. Otherwise — re-evaluate or surface to the
maintainer.
