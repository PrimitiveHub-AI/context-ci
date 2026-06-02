# PrimitiveHub Documentation

The strategic + canonical reference layer for PrimitiveHub. Two
classes of document live here:

1. **Canonical, citable, versioned** — the artifacts the paper
   references. Stability matters; updates ratchet a version and
   preserve the prior edition for citation.
2. **Operational / strategic** — internal reference for the team
   (currently maintainer + AI engineering partner). Living documents,
   updated as the project evolves.

## Canonical references (paper-cited)

- **[Threat Model](./threat-model.md)** — The 10 supply-chain attack
  categories PrimitiveHub's Context CI pipeline is designed to detect,
  with realistic scenarios, related real-world incidents, and
  detection methodology per category. Currently `v0.1`.

- **[Primitive Spec](./spec.md)** — The interchange and attestation
  specification: frontmatter schema, body section structure, content
  addressing semantics, Context CI Attestation predicate type,
  Sigstore signing model, verification procedure, SLSA + in-toto
  mapping. Currently `v0.1`.

## Strategic foundation (operational + team-facing)

- **[Vision](./vision.md)** — Why PrimitiveHub exists. The
  agent-context-as-supply-chain thesis. 1 / 3 / 10-year horizon. The
  North Star every decision is checked against.

- **[Positioning](./positioning.md)** — Competitive landscape.
  GitHub, Hugging Face, npm / PyPI, MCP Registry, vendor skill
  registries, Sigstore, in-toto. What we are AND what we deliberately
  are not. The "competing with monsters" play.

- **[Principles](./principles.md)** — The 18 non-negotiable beliefs.
  Trust is cryptographic or it doesn't exist. The spec is the
  contract. Postgres is the truth. And so on. Read before any
  decision that smells like architecture or product.

- **[Roadmap](./roadmap.md)** — Phased plan from now through Phase 12.
  Each phase carries a target window, ship list, and success metric.

- **[Bug log](./bugs.md)** — Every load-bearing bug we hit + root
  cause + fix + prevention + one-liner lesson. AI-engineering
  hallucinations are catalogued separately at the bottom. Grep here
  before re-deriving a known symptom.

- **[False-positive resolution](./false-positive-resolution.md)** —
  Methodology + append-only ledger for handling `phub audit` /
  `phub scan` false positives. The AV-vendor discipline (ADR-0030)
  applied to our threat model: four-path triage (true positive /
  domain WAI / detector defect / escalate), strict allow-entry
  format, numbered `FP-NNN` ledger, quarterly + version-bump
  re-review. **Read before adding any `allow:` entry to
  `.primitivehub/policy.yaml`.** Every policy entry MUST be
  back-referenced by a ledger entry committed in the same PR.

- **[Decisions](./decisions/)** — Architecture Decision Records. One
  file per load-bearing choice (Django Ninja over DRF, Postgres RLS,
  Cloudflare R2 v1, Authentik for OIDC, content-addressed storage,
  the two-issuer OIDC compose pattern, httpOnly cookies for tokens,
  …). Status, context, alternatives, consequences, references.

## How these relate

```
   vision.md              ← WHY we exist
       │
       ▼
   positioning.md         ← WHO we are NOT, vs. competitors
       │
       ▼
   principles.md          ← WHAT we believe is non-negotiable
       │
       ▼
   roadmap.md             ← WHEN we ship what, with success metrics
       │
       ▼
   decisions/             ← HOW we built it, with rationale
       │
       ▼
   bugs.md                ← WHAT BROKE so we don't repeat it
       │
       ▼
   spec.md, threat-model.md  ← the SPEC artifacts the paper cites
```

The threat model justifies what the spec demands.
The spec is the contract; the threat model is the justification.
The decisions implement the spec.
The bugs are what we learned implementing it.
The vision is why all of it matters.

## Related repositories (planned)

The following repositories are planned for public release near paper
submission (per the launch posture documented in the project memory).
They do not exist yet.

| Repo | Content | License |
|---|---|---|
| `primitivehub-spec` | Mirror of the canonical documents in this directory + machine-readable schema files | CC-BY 4.0 |
| `primitivehub-scanners` | Reference implementations of the Context CI scanners (Python/Rust libraries) | Apache-2.0 |
| `primitivehub-corpus` | Curated benchmark dataset of labeled known-good and known-bad primitives, for scanner evaluation | CC-BY 4.0 |
| `primitivehub-verifier` | Standalone library for verifying a primitive against an attestation; embeddable in third-party tools and agent runtimes | Apache-2.0 |

## Document conventions

- Canonical references use IETF RFC 2119 keywords (MUST, SHOULD, MAY)
  for normative language; strategic documents read like prose.
- Document version is stated in the first section (canonical only).
- Strategic documents have a "How to use this document" closing
  section so future-me knows how to apply them in practice.
- External references link to authoritative sources where possible.
- Cross-doc references use relative links.

## When to add a new document here

When the work-in-progress can't be answered by:

- The codebase (it's not a code question).
- A primitive (it's not an engineering pattern question).
- A memory file (it's not a per-session preference).
- An existing doc (the question doesn't fit any of the above).

Then it belongs here. Surface in chat first; the maintainer + AI
engineering partner sign off on adding to the strategic layer.
