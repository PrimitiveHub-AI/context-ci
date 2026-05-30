# PrimitiveHub Positioning

> **Status:** Living document. Updated when a meaningful competitor
> ships a capability that overlaps ours, or when our differentiation
> shifts.

## The fence

We are at the intersection of **package registry**, **identity-bound
publishing**, **attestation infrastructure**, and **AI-agent runtime**.
No single existing platform occupies all four corners.

```
                         Identity-bound publishing
                                     │
                                     │
                       GitHub  ┐     │
                               │     │
   Package registry ────────── ├ ─── + ─── Attestation infra
   (npm, PyPI, Hugging Face)  │     │     (Sigstore, in-toto, SLSA)
                               │     │
                               │     │
                        PrimitiveHub ← (we are HERE — the only product
                                       that is all four at once for
                                       agent-context artifacts)
                                     │
                                     │
                        AI-agent runtime
                        (LangChain, MCP, Claude, Cursor, …)
```

## Competitor matrix

| Competitor | What they do | Why they're NOT us |
|---|---|---|
| **GitHub** (Marketplace, Skills) | Code + Actions marketplace; recently added AI "skills" for Copilot | Code-first. Agent-context is a wrapper on top of code repos with no cryptographic provenance for the context itself. No Context CI. |
| **Hugging Face** (Spaces, Datasets, Models) | Model + dataset + space hosting with safetensors signing | Model-weight-first. Doesn't model agent context as a primitive class; safetensors signing is for weights, not for the system prompts / skills agents load alongside them. |
| **npm / PyPI** | Package registries with optional provenance via Sigstore | Code packages, not cognition. provenance via npm uses Sigstore but for the *tarball* — not for the human-authored prompt-shaped artifacts that agents consume. |
| **MCP Registry** (Anthropic) | Discovery + install for Model Context Protocol servers | Server-binary-first. MCP is the *protocol*; PrimitiveHub is the trust layer for what the server says. (We will integrate with MCP, not compete with it.) |
| **Vercel v0 / claude.ai skills / Anthropic skill registry** | First-party agent skill registries | Closed garden, single-vendor, no attestation, no cryptographic verifiability, no threat-model coverage. PrimitiveHub is the multi-vendor, attested layer underneath. |
| **Sigstore / Fulcio / Rekor** | Keyless signing + transparency log for arbitrary artifacts | Infrastructure layer. We **use** Sigstore (Phase 4) — we don't compete with it. PrimitiveHub is what serious teams build on top of Sigstore for the agent-cognition use case. |
| **in-toto / SLSA** | Provenance attestation framework | Spec, not a product. We **adopt** in-toto (our Attestation predicate is in-toto) and operate within SLSA framing. Same relationship as Sigstore: foundation, not rival. |
| **Vercel Templates / Skill repos (wshobson, etc.)** | Curated GitHub repos of agent skills | Curated lists. No cryptographic verification, no role-bound publishing, no review workflow, no revocation, no metrics. Lovely community resource; not a trust layer. |
| **Awesome-* lists** | Same as above, less curated | Same critique. |

## Differentiation, ranked

1. **Cryptographic content addressing as the identity.** Every primitive
   IS its SHA-256 hash. Re-hash-on-read is the canonical verification.
   No other registry in our space treats the digest as the name.

2. **In-toto Attestation predicate, custom-typed.** Our predicate
   type — `https://primitivehub.ai/context-ci/v0.1/Attestation` — is the
   first attestation format published for the agent-context use case.
   This is what the arXiv paper anchors on.

3. **10-stage Context CI pipeline addressing 10 named threat
   categories.** Threat-model first, not pipeline first. Every stage
   exists because a specific named attack exists.

4. **Role-bound publishing with security-reviewer veto.** Maintainer /
   verified-expert / reviewer / security-reviewer / author /
   registry-admin — roles map to authority over different primitive
   risk levels. Security-reviewer approval is REQUIRED for any
   primitive flagged as `high` risk.

5. **Sigstore-keyless OIDC signing in v1.** No long-lived signing keys.
   Authors prove identity via OIDC; Fulcio issues an ephemeral cert;
   Rekor logs the signature for public verifiability. (Phase 4 for
   public registry; Phase 7 for self-hosted Sigstore in private
   enterprise registries.)

6. **Multi-tenant from day one.** Postgres RLS enforces tenant
   isolation at the database layer. Application-level scoping is the
   second layer. Most agent-skill registries treat multi-tenancy as a
   Phase 4+ refactor; we shipped it in Phase 3.

7. **Spec-first.** Primitive Spec v0.1 is published, versioned, and
   open. Anyone can author a primitive that loads in any
   spec-conformant registry.

## Where we are intentionally weaker (for now)

- **Hosted compute / model inference.** We host content, not compute.
  HF Spaces wins this; we're not interested.
- **Code packages.** That's npm / PyPI / GitHub Packages territory. A
  primitive may reference code, but the registry isn't for code.
- **Public marketplace UX polish.** Pre-launch posture means we're not
  optimizing for marketplace-style browsing yet. The trust layer is the
  product; the marketplace is the surface that exposes it.

## The "competing with monsters" question

GitHub is 100M+ users, ~$1B revenue, owned by Microsoft. We are pre-
launch with a single maintainer + AI engineering partner. How does
this work?

**We don't compete with GitHub on "where you store your code". We
compete on "where you publish trusted agent cognition", and GitHub
isn't there yet.** When GitHub eventually tries to be there, our
spec is already the standard, our threat model is already the
vocabulary, our attestation predicate is already in-toto-compatible.
Microsoft's response will be to adopt the spec — and at that point,
the early ecosystem we shepherded is the moat.

This is the open-source-foundation play, not the marketplace play.

Three concrete asymmetries that make this winnable:

1. **GitHub can't move pre-emptively.** Microsoft's product calendar
   is committed years out. By the time agent-context-as-supply-chain
   shows up on a roadmap, our spec exists, our paper has citations,
   and the trust hierarchy already names PrimitiveHub.

2. **The paper is the moat.** Anyone can fork a registry. Few can fork
   a published peer-reviewed framework for "AI agent context as
   supply-chain material" without admitting it came from us.

3. **Security posture is hard to retrofit.** We shipped RLS + role-
   bound publishing + tenant isolation in Phase 3. Retrofitting that
   into an existing public registry without breaking changes is a
   multi-year project. We have it on day one.

## How to use this document

When considering a feature, ask:

1. Does it deepen one of the seven ranked differentiators? Or is it
   undifferentiated marketplace polish?
2. Does it move us into territory we're intentionally weak in (compute,
   code-package hosting, marketplace UX before trust)?
3. Would GitHub ship this in v1? If yes, are we shipping it because
   it's table stakes, or are we wasting an opportunity to be different?

The answers shape priority.
