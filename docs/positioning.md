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
| **NVIDIA garak / NeMo Guardrails** | garak red-teams a live LLM/agent with adversarial probes (prompt injection, jailbreak, encoding attacks); NeMo Guardrails filters inputs/outputs at inference. garak v0.15.0 (May 2026) added an Agent-breaker probe for agent tool-use. | Model-behavior-first, **downstream** of us. Both inspect a *running model's* behavior; neither scans the static context artifacts (`AGENTS.md`, skills, `.cursor/rules`, `mcp.json`) an agent loads for supply-chain attacks. We gate the context **before load**, deterministically, no model required. A complementary layer — we sit in front of the model, not beside it. |
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

## The supply-chain stack framing

Every other supply-chain ecosystem walked the same arc. Agent-context
sits at era 0; PrimitiveHub is built to deliver the whole stack:

| Era | npm | Docker | Python | Agent-context (PrimitiveHub) |
|---|---|---|---|---|
| 0 — Install by name | `npm install` | `docker pull` | `pip install` | `phub install` (PR 5.7.4, ADR-0028 planned) |
| 1 — Lockfile | `package-lock.json` | image digests | `requirements.txt` pins | `phub.lock` (PR 5.7.2, ADR-0026 planned) |
| 2 — Auditor | `npm audit` | Trivy / Snyk | `pip-audit` | `phub audit` (PR 5.7.1, ADR-0025) |
| 3 — Provenance / signing | npm Sigstore provenance | cosign + SLSA | PEP 740 | Trust Contract v0.1 + Sigstore (Phase 4 ✓) |
| 4 — Runtime guard | (immature) | Falco / admission controllers | (immature) | MCP `verify_before_load` (PR 5.7.5, ADR-0029 planned) |
| 5 — SBOM | CycloneDX everywhere | CycloneDX everywhere | CycloneDX everywhere | CBOM v0.1 (Phase 5.6, ADR-0019 planned) |

The advantage of building this for AI cognition *now*, before any
incumbent ships it: we author all six rows under one Trust Contract,
in one coherent spec. The competing platforms will have to retrofit
five rows on top of an existing storage layer; we ship all five rows
shaped by row 3 (the cryptographic contract) from day one.

## Product-family parallel — "agent-context AV plus registry"

The category framing locked in
[ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md):
PrimitiveHub is **not** a registry with a side scanner. It is the
**AV-product-family equivalent for agent cognition**, with
cryptographic provenance native to the stack. The mapping:

| AV product family | PrimitiveHub equivalent | State |
|---|---|---|
| On-demand scanner (`avscan file.exe`) | `phub scan AGENTS.md` | shipped |
| Full system scan | `phub audit .` | shipped (ADR-0025) |
| Signature database | Context CI Top 10 v0.1 | shipped (ADR-0016) |
| Signature precision tuning | Detector lockstep PRs (Python + TS) | shipped (ADR-0023) |
| FP submission portal | `docs/false-positive-resolution.md` + FP-NNN ledger | shipped (ADR-0030) |
| Allowlist / exception DB | `.primitivehub/policy.yaml` `allow:` array | shipped (ADR-0018) |
| On-access guard | `phub watch` | planned (ADR-0027) |
| Boot-time integrity check | `phub.lock` + `phub audit --check-lock` | shipped (ADR-0026) |
| HIPS / behavior blocker at runtime | MCP runtime gate (`verify_before_load`) | planned (ADR-0029) |
| Cloud lookup / reputation | Trust API by-digest lookup | shipped (ADR-0013) |
| Provenance / signature attestation | Sigstore-keyless OIDC | shipped (Phase 4) |
| Quarantine vault | (not adopted — we surface, we don't mutate) | n/a by design |

Why this framing matters strategically: GitHub, Hugging Face,
Anthropic, OpenAI can each ship a "verified prompt registry" in a
quarter. None of them can ship the AV-product-family disciplines
(numbered FP ledger, narrow allowlist with required justification,
signature precision tuning, periodic re-review, on-access guard,
runtime gate) in less than the multi-year arc the AV industry already
walked. The defense layer is the moat, not the storage layer. And the
defense layer is what we ship from day one.

When asked "what kind of product is this?", the right answer is
**"agent-context AV plus registry, with cryptographic provenance
native."** Not "GitHub for prompts." Not "Snyk for skills." The AV
product family is the closest existing category; our novelty is
applying it to agent context with spec-first, open-source, attested
discipline.

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
