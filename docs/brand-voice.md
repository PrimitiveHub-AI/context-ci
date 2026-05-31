# PrimitiveHub Brand Voice

> **Version:** v0.1
> **Last reviewed:** 2026-05-31
> **Owner:** mhm
> **Change policy:** See [ADR-0025](./decisions/0025-doctrine-versioning-policy.md). Killer-phrase additions and banned-vocabulary additions are non-breaking. Banned-vocabulary removals are breaking.
>
> **Status:** The doctrine made readable. Every external sentence about PrimitiveHub passes through this filter.

---

## Voice register

Technical. Plainspoken. Paper-grade.

We cite specifics. We quote digests, not adjectives. We refuse to use
marketing-grade superlatives. The reader is a CISO, a research
engineer, a regulator, an author who has been burned by a poisoned
skill — not a venture analyst skimming a pitch deck.

If a sentence sounds like it could appear unchanged on a generic SaaS
landing page, it is wrong.

## Killer phrases (use)

These are the load-bearing brand assets. Use them in copy, in talks,
in PR descriptions, in the paper.

- **Context Firewall** — the headline category. Use as a noun.
- **Context CI** — the named category we author. Like SAST/DAST.
- **executable influence** — the paper-grade phrase for what AI
  context has become. (Steal this for the paper title.)
- **trust runtime** — the architectural name (internal-leaning,
  technical audiences).
- **every byte verified** — when describing the verifier's coverage.
- **before agents consume it** — the temporal frame (we are
  pre-execution, not detection).
- **the verifier every registry embeds** — when explaining position
  vs. registries.
- **sit in front of** (not "compete with") — for positioning copy.
- **Trust Bundle** — the wire-format unit.
- **CBOM** — the manifest format.
- **Top 10** (short) / **Context CI Top 10** (long) — the taxonomy.
- **Primitive Forge** — the authoring surface. Never "Workbench" in
  external copy.
- **Primitive Explorer** — the transparency surface. Never "registry
  browser."
- **No context without verification** — the operating-law mnemonic.

Additions to this list are non-breaking per ADR-0025.

## Banned vocabulary (do not ship)

These do not appear in copy, descriptions, blog posts, talks, READMEs,
or the paper. They are auto-rejected at review.

- **AI-powered**, **AI-driven**, **AI-first** — vacuous; AI is the
  medium, not the claim.
- **next-generation**, **next-gen** — every category claims this;
  nobody believes it.
- **revolutionary**, **disruptive**, **game-changing** — superlatives
  that contain no claim.
- **democratize** — the word has been laundered to mean nothing.
- **empower** — empower someone to do what? Be specific.
- **synergy**, **synergistic** — never.
- **leverage** (as a verb) — use "use."
- **best-in-class**, **world-class**, **enterprise-grade** —
  unmeasurable.
- **trusted by [logos]** — only valid post-launch with real, signed
  logos. Pre-launch, do not fake.
- **seamless** — invariably untrue.
- **at scale** (in isolation) — meaningless without a number.
- **revolutionize**, **reimagine**, **transform** — verbs without an
  object.
- **cutting-edge**, **bleeding-edge**, **state-of-the-art** — show;
  do not claim.
- **simplify**, **streamline** (without a measured before/after) —
  assertion not evidence.
- **the future of [X]** — anyone can claim this; nobody can deliver
  it.
- **unlock** (as a verb for capability) — empty.
- **end-to-end** (without specifying which two ends) — vague.

Removals from this list are breaking per ADR-0025.

## Cryptographic vocabulary (locked — mirrored in CLAUDE.md)

- **Content Digest** = SHA-256 hash of the canonical content.
- **Signature** = Sigstore keyless OIDC (Fulcio cert + Rekor log entry).
- **Attestation** = Context CI validation record (in-toto Statement,
  predicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`).
- **Provenance Chain** = author → validation → review → release.

**Never write "SHA-256 signed."** SHA-256 is a hash, not a signature.
This wording is load-bearing for the paper's correctness.

## Voice examples — off vs on

| Off-voice (do not ship) | On-voice (ship) |
|---|---|
| "PrimitiveHub is the next-generation AI-powered platform for trusted AI primitives." | "PrimitiveHub is the Context Firewall for AI agents." |
| "We empower developers to leverage AI safely at scale." | "We verify every byte of context an AI agent consumes." |
| "Best-in-class Context CI scanner with seamless integration." | "Context CI scans AGENTS.md, SKILL.md, `.cursor/rules`, and MCP configs against the Context CI Top 10 before agents read them." |
| "Trusted by leading enterprises." | (Pre-launch: nothing. Post-launch: the named enterprise.) |
| "Revolutionizing how agents discover context." | "Sits in front of every registry an agent can read from." |
| "Our cutting-edge AI-driven verification platform." | "`@primitivehub/verify` is < 50KB and verifies a Trust Bundle offline against bundled Sigstore trust roots." |
| "Streamlines the AI context supply chain end-to-end." | "Every primitive is digested, attested, policy-gated, and logged to Rekor before any agent reads it." |
| "Democratizing trust for AI agents." | "An open, embeddable verifier under MIT license. Other tools integrate it; PrimitiveHub doesn't gate the standard." |
| "Unlock the future of agent context." | "AI-agent context has become executable influence. PrimitiveHub treats it like a supply-chain artifact: signed, attested, verifiable." |

## Author attribution

- The **company** is **PrimitiveHub** (legal entity TBD).
- The **research lab** is **CyberOrca Labs**.
- The **paper byline** is "mhm, CyberOrca Labs" (plus academic
  co-author when secured).
- The **product** is "PrimitiveHub" — not "PrimitiveHub by
  CyberOrca."
- The **footer** of the website reads "Powered by CyberOrca.sa" —
  small, factual, not the headline.

The paper is a CyberOrca Labs research output. The product is a
PrimitiveHub product. Do not blend the brands in the same sentence.

## How this document is used

- Every external piece of copy (landing pages, blog posts, paper
  sections, READMEs, conference abstracts) passes a brand-voice review
  before merge.
- The brand-voice review is a checklist: any killer phrase present
  (good)? any banned vocabulary present (block)? does it pass the
  off-voice / on-voice mirror test (compare to the table above)?
- Future AI contributors read this via CLAUDE.md auto-load. They are
  bound by it.
