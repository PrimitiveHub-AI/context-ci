# PrimitiveHub Documentation

Canonical reference documents for PrimitiveHub. These are versioned, citable
artifacts that the technical paper accompanying the launch references
directly. Stability matters; updates ratchet a version and preserve the
prior edition for citation.

## Documents

- **[Threat Model](./threat-model.md)** — The supply-chain attack categories
  PrimitiveHub's Context CI pipeline is designed to detect, with realistic
  scenarios, related real-world incidents, and detection methodology per
  category. Currently `v0.1`.

- **[Primitive Spec](./spec.md)** — The interchange and attestation
  specification: frontmatter schema, body section structure, content
  addressing semantics, Context CI Attestation predicate type, Sigstore
  signing model, verification procedure, SLSA + in-toto mapping. Currently
  `v0.1`.

## How these relate

- The **threat model** justifies what the **spec** demands.
- The **spec** is the contract; the threat model is the justification.
- Both are versioned independently but in lockstep — the Context CI
  Attestation predicate carries both the spec version (which interface) and
  the threat model version (which detection rules) so verifiers can reason
  precisely about what guarantees a given attestation represents.

## Related repositories (planned)

The following repositories are planned for public release near paper
submission (per the launch posture documented in the project memory). They
do not exist yet.

| Repo | Content | License |
|---|---|---|
| `primitivehub-spec` | Mirror of the documents in this directory + machine-readable schema files | CC-BY 4.0 |
| `primitivehub-scanners` | Reference implementations of the Context CI scanners (Python/Rust libraries) | Apache-2.0 |
| `primitivehub-corpus` | Curated benchmark dataset of labeled known-good and known-bad primitives, for scanner evaluation | CC-BY 4.0 |
| `primitivehub-verifier` | Standalone library for verifying a primitive against an attestation; embeddable in third-party tools and agent runtimes | Apache-2.0 |

## Document conventions

- All documents use IETF RFC 2119 keywords (MUST, SHOULD, MAY) for normative
  language.
- Document version is stated in the first section.
- External references link to authoritative sources where possible.
