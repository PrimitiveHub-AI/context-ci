# Primitive Spec — v0.1

> **Status:** Draft. The PrimitiveHub interchange and attestation specification.
> Versioned alongside the [Threat Model](./threat-model.md). The current version
> identifier is `0.1`. This identifier appears in every Context CI attestation
> so verifiers can determine which spec edition a given primitive was validated
> against.
>
> This document is intended as canonical reference for the open-source
> [`primitivehub-spec`](https://github.com/) repository (planned, near paper
> submission) and for the technical paper. PrimitiveHub's `phub` CLI and
> registry web app are implementations of this specification.

## 1. Overview

A **PrimitiveHub Primitive** ("primitive") is a structured Markdown document
that encodes domain expertise an AI agent loads into its reasoning context.
A primitive consists of:

1. A **YAML frontmatter** carrying machine-readable metadata.
2. A **Markdown body** with a defined section structure.
3. An associated **Context CI Attestation** (an in-toto statement) carrying
   the validation provenance, signed via Sigstore.

A primitive is **content-addressed**: its canonical identifier within the
PrimitiveHub registry is the SHA-256 digest of its byte content. Two
primitives with identical bytes are the same primitive, regardless of where
they are stored. A primitive's content is immutable; corrections or updates
ship as a new version with a new digest.

This specification covers:

- The frontmatter schema (§2).
- The body section structure (§3).
- Content addressing semantics (§4).
- The Context CI Attestation predicate type and payload (§5).
- The Sigstore signing model (§6).
- The verification procedure (§7).
- Mapping to SLSA and in-toto (§8).
- Versioning and conformance levels (§9).
- Open issues deferred to future versions (§10).

PrimitiveHub's [threat model](./threat-model.md) is the justification for
what this spec demands. The spec is the contract.

## 2. Frontmatter schema

Every primitive **MUST** begin with a YAML frontmatter block delimited by
triple-dashes, conforming to the schema below.

### 2.1 Required fields

| Field | Type | Description |
|---|---|---|
| `spec_version` | string | The Primitive Spec version this primitive conforms to. For this spec, the value is `"0.1"`. |
| `name` | string | The primitive's canonical slug. Must match `^[a-z0-9][a-z0-9-]*[a-z0-9]$`. Unique within a registry namespace. |
| `version` | string | Semantic version (semver 2.0). |
| `type` | enum | One of: `engineering`, `design`, `security`, `research`, `architecture`, `performance`, `agent-behavior`, `domain-expertise`. |
| `domain` | string | Free-form human-readable domain label. |
| `author` | string | Human-readable author or organization name. (Cryptographic author identity is bound separately via Sigstore; see §6.) |
| `license` | string | SPDX license identifier. |
| `tokens` | integer | The primitive body's token count under a declared tokenizer. |
| `token_budget` | integer | Maximum acceptable token count (enforced at publish time). |
| `risk_level` | enum | One of: `low`, `medium`, `high`. Authorial declaration; verified by Context CI. |
| `content_digest` | string | The SHA-256 digest of the primitive's content. Format: `sha256:<64-hex-chars>`. (See §4.) |
| `compatible_agents` | list[string] | Identifiers of agent runtimes this primitive is known to be compatible with. |
| `use_when` | list[string] | Situations where the primitive should be loaded. Non-empty. |
| `do_not_use_when` | list[string] | Situations where the primitive should not be loaded. Non-empty. |

### 2.2 Recommended fields

| Field | Type | Description |
|---|---|---|
| `attestation` | string | Reference to the Context CI Attestation predicate; format `cci-v<spec-version>` (e.g., `cci-v0.1`). Present when the primitive has been validated. |
| `signature` | string \| null | Reference to the Sigstore signature bundle. `null` if unsigned. Format: `sigstore-bundle:<rekor-entry-id>`. |
| `tokenizer` | string | The tokenizer used to compute `tokens`. Default: `cl100k_base`. |
| `description` | string | One-sentence human-readable description. |
| `keywords` | list[string] | Discovery keywords. |
| `references` | list[string] | External references the body cites (must resolve). |
| `changelog` | string | Path to or inline brief changelog. |

### 2.3 Field semantics

**`content_digest` MUST equal** the SHA-256 of the primitive's content under
the canonicalization rules defined in §4. A frontmatter `content_digest` that
does not match the byte content's actual SHA-256 is a verification failure.

**`tokens` MUST equal** the result of tokenizing the primitive body (frontmatter
excluded) with the tokenizer declared in `tokenizer` (default `cl100k_base`).
A tokens declaration off by more than 5% from the actual count is a
verification failure.

**`spec_version` MUST be present and SHOULD match** the version of the
attestation. Mismatched spec versions are surfaced as a warning, not a hard
failure, to permit migration between spec editions.

### 2.4 Example frontmatter

```yaml
---
spec_version: "0.1"
name: secure-code-review
version: 1.2.0
type: security
domain: cybersecurity
author: SecureAI Contributors
license: Apache-2.0
tokens: 5100
token_budget: 6000
risk_level: low
content_digest: sha256:c9d1e2f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b8
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
  - v0
  - windsurf
use_when:
  - "Security audits"
  - "Reviewing authentication code"
  - "Handling sensitive data"
do_not_use_when:
  - "UI-only components"
  - "Documentation writing"
  - "CSS styling"
attestation: cci-v0.1
signature: sigstore-bundle:24296fb24b8ad77a...
tokenizer: cl100k_base
description: "OWASP-aligned secure code review with vulnerability detection rules"
keywords: [security, owasp, code-review, authentication]
references:
  - "https://owasp.org/Top10/"
changelog: |
  v1.2.0: added authentication-code-specific rules
---
```

## 3. Body section structure

The Markdown body following the frontmatter **MUST** contain the following
sections in this order. Sections are identified by H2 headings (`##`) matching
the canonical name. Section ordering is enforced by Context CI's structure
linter.

### 3.1 Required sections

1. `## Purpose` — What the primitive teaches the agent. ≥ 1 paragraph.
2. `## Core Principles` — The foundational rules the agent should apply. ≥ 3
   bulleted principles, each with at least one concrete example.
3. `## Decision Rules` — Conditional logic the agent applies. Each rule
   **SHOULD** be expressed in `IF … THEN …` form to permit deterministic
   evaluation. ≥ 3 rules.
4. `## Anti-Patterns` — Behaviors the agent should avoid, with explanation of
   *why* each is harmful and *what to do instead*. ≥ 3 anti-patterns.
5. `## Review Checklist` — A bulleted checklist a human reviewer can apply to
   the agent's output to verify the primitive was followed. ≥ 5 items.
6. `## Agent Behavior Instructions` — Runtime behavior expectations:
   confidence-reporting requirements, output format, token-budget discipline,
   and tool-use boundaries.

### 3.2 Recommended sections

7. `## Expected Output Format` — Field-level expectations for agent output
   under this primitive. STRONGLY RECOMMENDED for primitives where output
   format consistency matters (which is most of them).
8. `## Examples` — Worked examples with inputs and expected outputs.
9. `## References` — External sources cited. Each reference is verified by
   Context CI (T8 in the threat model).
10. `## Changelog` — Per-version notes (if not in the frontmatter `changelog`
    field).

### 3.3 Prohibited content

The following are rejected by Context CI's safety scan (corresponding to the
threat model categories cited):

- **T1.** Imperative override constructions targeted at the consuming agent
  (e.g., "ignore previous instructions").
- **T2.** Non-printable Unicode outside the allowlist (Tag characters,
  zero-width characters, bidi-override characters).
- **T3.** Encoded payloads exceeding entropy and length thresholds.
- **T4.** Imperative URL-fetch instructions targeting runtime-mutable sources.
- **T5.** `curl … | bash` and equivalent shell-pipeline-execute patterns.
- **T6.** Imperative read-and-output instructions targeting credential paths.

A primitive containing any of these in body content is rejected at publish
time, not merely flagged.

## 4. Content addressing

### 4.1 Canonical content

A primitive's **canonical content** is the byte sequence consisting of:

1. The frontmatter delimiter `---\n`.
2. The frontmatter YAML body, *with the `content_digest` field removed*.
3. The closing delimiter `---\n`.
4. The Markdown body.

The `content_digest` field is excluded from the digest computation because
its value is the digest itself; including it would create a circular
definition. All other frontmatter fields are included.

### 4.2 Computation

The digest is `sha256(canonical_content)`, hex-encoded, prefixed with
`sha256:`. This is the same convention used by Docker image references and
OCI artifact references.

### 4.3 Object storage layout

Primitives are stored in S3-compatible object storage under keys derived from
the digest:

```
primitives/sha256/<first-two-hex-chars>/<next-two-hex-chars>/<remaining-hex>.md
```

Example: a primitive with digest `sha256:c9d1e2f4a7b85c3d…` is stored at
`primitives/sha256/c9/d1/e2f4a7b85c3d….md`. The two-level prefix prevents
single-directory inflation in operational tooling.

### 4.4 Mutability

A primitive's content is immutable once published. Subsequent versions ship
under a new `version` semver and a new `content_digest`. The registry maps
`<name>@<version>` → `<content_digest>`. The mapping itself is mutable
(deprecation, withdrawal); the underlying content-addressed object is not.

## 5. Context CI Attestation

### 5.1 In-toto Statement structure

Every validated primitive carries an attestation conforming to the
[in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)
schema, with a PrimitiveHub-specific `predicateType`.

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "secure-code-review.md",
      "digest": {
        "sha256": "c9d1e2f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b8"
      }
    }
  ],
  "predicateType": "https://primitivehub.ai/context-ci/v0.1/Attestation",
  "predicate": {}
}
```

The `predicate` object's structure is defined in §5.3 below; the empty object
above is a placeholder so the surrounding Statement remains valid JSON.

### 5.2 Predicate type URI

The PredicateType URI is:

```
https://primitivehub.ai/context-ci/v<spec-version>/Attestation
```

For this spec edition: `https://primitivehub.ai/context-ci/v0.1/Attestation`.

### 5.3 Predicate payload

```json
{
  "spec_version": "0.1",
  "threat_model_version": "0.1",
  "registry": "primitivehub.ai/public",
  "run_id": "01J9X4...",
  "run_started_at": "2026-05-18T14:00:00Z",
  "run_completed_at": "2026-05-18T14:00:21Z",
  "environment": {
    "context_ci_version": "0.1.0",
    "scanner_versions": {
      "schema": "0.1.0",
      "structure-lint": "0.1.0",
      "safety-scan": "0.1.0",
      "copyright-similarity": "0.1.0",
      "token-efficiency": "0.1.0",
      "contradiction-detection": "0.1.0",
      "agent-benchmark": "0.1.0"
    },
    "corpus_version": "0.1.0"
  },
  "stages": [
    {
      "name": "schema-validation",
      "status": "passed",
      "score": 100,
      "duration_ms": 312,
      "findings": []
    },
    {
      "name": "structure-lint",
      "status": "passed",
      "score": 98,
      "duration_ms": 821,
      "findings": [
        {
          "severity": "info",
          "code": "STRUCT-RECOMMEND-MISSING",
          "message": "Recommended section 'References' not present"
        }
      ]
    },
    {
      "name": "safety-scan",
      "status": "passed",
      "score": 99,
      "duration_ms": 1184,
      "findings": []
    },
    {
      "name": "token-efficiency",
      "status": "warning",
      "score": 87,
      "duration_ms": 502,
      "findings": [
        {
          "severity": "warn",
          "code": "TOK-DENSITY-HIGH",
          "message": "Token count 5100 / 6000 budget (85%); above recommended density"
        }
      ]
    },
    {
      "name": "human-review",
      "status": "passed",
      "score": 94,
      "duration_ms": 187200000,
      "reviewer": {
        "oidc_subject": "marcus.webb@securai.example",
        "role": "security-reviewer",
        "decision": "approve",
        "notes": "2 minor suggestions incorporated"
      },
      "findings": []
    }
  ],
  "overall_verdict": "trusted",
  "overall_score": {
    "quality": 94,
    "safety": 99,
    "efficiency": 87,
    "impact": 91
  }
}
```

Fields:

- `spec_version` — The Primitive Spec version used. Must match the value in
  the primitive's frontmatter.
- `threat_model_version` — The version of the [threat model](./threat-model.md)
  that defines the safety-scan rules applied. Independently versioned from the
  spec.
- `registry` — The publishing registry's identifier.
- `run_id` — Unique identifier for the Context CI run.
- `run_started_at`, `run_completed_at` — ISO 8601 UTC timestamps.
- `environment` — The deterministic environment of the run: Context CI
  version, scanner versions, benchmark-corpus version. Required for
  reproducibility.
- `stages` — Ordered list of validation stages. Each carries name, status
  (`passed` / `warning` / `failed`), score (0–100), duration, and zero or
  more findings.
- `findings[*].code` — Stable identifier for the finding type, drawn from a
  PrimitiveHub-published codes registry (separate document, near paper
  submission).
- `findings[*].severity` — `info` / `warn` / `error`.
- `overall_verdict` — `trusted` / `in-review` / `experimental` / `rejected` /
  `deprecated`.
- `overall_score` — The four PrimitiveHub trust dimensions (Quality, Safety,
  Efficiency, Impact), each 0–100, computed from stage scores by a
  documented formula (see §5.4).

### 5.4 Score derivation

The four overall scores are weighted aggregates over stage scores. The
weights are versioned in `spec_version` and frozen for a given spec edition:

- **Quality** = mean(structure-lint, contradiction-detection, human-review).
- **Safety** = min(safety-scan, copyright-similarity, T1-T9 stage scores).
- **Efficiency** = token-efficiency score, capped by a context-bloat penalty
  (T10).
- **Impact** = agent-benchmark score.

The exact formula is implemented in the open-source `primitivehub-scanners`
repository and verifiable by any independent re-runner.

## 6. Signing model

### 6.1 Signer identity

Authors sign Context CI Attestations using
[Sigstore](https://www.sigstore.dev/)'s keyless signing flow:

1. The author authenticates via OIDC to the registry's identity provider
   (public PrimitiveHub uses Authentik; enterprise deployments use the
   customer's IdP).
2. The OIDC token is exchanged at
   [Fulcio](https://github.com/sigstore/fulcio) for a short-lived X.509
   certificate (typically 10-minute validity) binding the author's verified
   OIDC subject to a freshly generated keypair.
3. The author signs the attestation envelope.
4. The signing certificate and signature metadata are recorded in
   [Rekor](https://github.com/sigstore/rekor), Sigstore's transparency log.
   The Rekor entry ID becomes part of the primitive's metadata.
5. The certificate expires. There is no long-lived signing key to leak,
   rotate, or distribute.

### 6.2 Envelope

The attestation is wrapped in a [DSSE](https://github.com/secure-systems-lab/dsse)
(Dead Simple Signing Envelope) v1 payload, base64-encoded, with the
PrimitiveHub-specific `payloadType` of `application/vnd.in-toto+json` and the
PrimitiveHub PredicateType inside the in-toto Statement.

### 6.3 Public vs. private signing

- **Public PrimitiveHub:** uses Sigstore's public Fulcio + Rekor instances.
  All author identities are publicly searchable in the Rekor log. This is
  consistent with public-registry trust semantics; primitive authors are
  publicly attributable.
- **Private / enterprise PrimitiveHub:** uses customer-operated Fulcio +
  Rekor + Trillian deployment. Identities remain within the customer's
  control. (Phase 7 of the build plan; not implemented in v0.1.)

Public PrimitiveHub **MUST NOT** be used as the signing backend for private
primitives, because the Rekor transparency log would publicly disclose
internal author identities.

## 7. Verification procedure

A consumer (CLI, agent, or web client) verifying a primitive **MUST**:

1. **Re-canonicalize** the primitive content per §4.
2. **Re-compute** the SHA-256 digest.
3. **Compare** the computed digest to the frontmatter `content_digest`.
   Mismatch → reject.
4. **Fetch** the attestation envelope for the primitive's digest.
5. **Verify** the DSSE signature against the certificate in the envelope.
6. **Verify** the certificate via Fulcio's root certificate chain.
7. **Verify** the Rekor inclusion proof — the certificate's serial number and
   the signature payload are recorded in Rekor at the entry ID claimed by the
   metadata.
8. **Parse** the in-toto Statement.
9. **Confirm** the `subject[*].digest.sha256` matches the primitive's digest.
10. **Inspect** the predicate: spec version, threat-model version, overall
    verdict, individual stage findings.
11. **Apply** the consumer's policy: e.g., reject any verdict other than
    `trusted`; reject primitives whose `safety` score is below a threshold;
    reject primitives whose spec version is older than the consumer's
    minimum.

A failure at any step → reject.

The `phub verify` CLI implements all steps. The open-source
`primitivehub-verifier` library (planned, near paper submission) packages
steps 1–10 for embedding in third-party tools, agent runtimes, and CI
pipelines.

## 8. Mapping to SLSA and in-toto

### 8.1 in-toto

This spec uses in-toto's Statement v1 as the attestation container and
contributes a new PredicateType to the ecosystem. The PredicateType URI is
PrimitiveHub-controlled and registered in the
[in-toto Attestation Spec predicates list](https://github.com/in-toto/attestation/blob/main/spec/v1/predicates.md)
upon stabilization (currently scheduled with spec version 1.0).

### 8.2 SLSA v1.0 Build track

| SLSA L | Requirement | PrimitiveHub status (v0.1) |
|---|---|---|
| Build L1 | Provenance is generated | Met — every published primitive ships with an attestation. |
| Build L2 | Provenance is signed | Met — Sigstore signing. |
| Build L3 | Build platform is hosted and hardened | Partially met — Context CI runs in a controlled environment; the v0.1 release does not yet meet all SLSA L3 hardening checks (specifically, the "isolated build" requirement is approximated, not formally proved). Roadmap target: Build L3 by spec v0.2. |

PrimitiveHub does not currently model Source-track levels.

## 9. Versioning and conformance

### 9.1 Spec version

This spec is `0.1`. Spec versions follow a `MAJOR.MINOR` scheme. A MAJOR bump
indicates a backwards-incompatible change in attestation format, signing
model, or required fields. A MINOR bump may add fields, sections, or scanner
stages without invalidating prior attestations.

Verifiers **SHOULD** accept primitives from any spec version less than or
equal to the verifier's max-supported version; verifiers **MAY** apply
stricter policy.

### 9.2 Conformance levels

Three conformance levels are defined for primitive publishers:

- **Level 0 (Conformant).** Frontmatter schema (§2) is valid; required body
  sections (§3.1) are present; content-digest matches.
- **Level 1 (Attested).** Level 0 + has a valid Context CI Attestation with
  `overall_verdict ∈ {trusted, in-review, experimental}` and a valid Sigstore
  signature.
- **Level 2 (Trusted).** Level 1 + `overall_verdict == "trusted"` + human
  review stage passed.

Public PrimitiveHub displays primitives at Levels 0, 1, and 2 distinctly. A
Level 2 designation requires a positive human review by a reviewer whose OIDC
identity is bound to one of the documented PrimitiveHub reviewer roles.

## 10. Trust Bundle (the runtime wire format)

A **Trust Bundle** is the canonical artifact returned by PrimitiveHub's
runtime trust API (`/api/v1/trust/*`) and consumed by verifiers (CLI,
MCP server, custom agents). The bundle is **self-contained**: a
consumer with the Sigstore trust root can validate it offline without
calling back to PrimitiveHub.

### 10.1 Media type

`application/vnd.primitivehub.bundle+json` — a registered media type
for the bundle format. Servers MUST emit this Content-Type; consumers
SHOULD accept-negotiate it.

### 10.2 Bundle structure

```json
{
  "bundleVersion": "0.1",
  "subject": {
    "slug": "elite-mobile-design",
    "semver": "1.2.0",
    "contentDigest": "sha256:abc123..."
  },
  "content": {
    "bytesB64": "<base64-encoded primitive content>",
    "sizeBytes": 4123,
    "mediaType": "text/markdown; charset=utf-8"
  },
  "attestation": {
    "predicateType": "https://primitivehub.ai/context-ci/v0.1/Attestation",
    "predicate": { ... validation[] block + summary ... },
    "backendName": "public",
    "certChainPem": "-----BEGIN CERTIFICATE-----\n...",
    "signatureB64": "<base64 raw signature>",
    "statementB64": "<base64 in-toto Statement bytes>",
    "rekorLogIndex": 18234567,
    "rekorLogId": "<hex SHA-256 of Rekor public key>",
    "rekorInclusionProofJson": "{\"logIndex\":...,\"rootHash\":...}",
    "verifyUrl": "https://search.sigstore.dev/?logIndex=18234567",
    "signedAt": "2026-05-30T12:34:56Z"
  },
  "detailUrl": "/primitive/elite-mobile-design?version=1.2.0"
}
```

### 10.3 Verification procedure

A consumer with the appropriate Sigstore trust root performs these
steps, all OFFLINE:

1. **Re-hash the content.** Decode `content.bytesB64`; compute
   sha256(); confirm it equals `subject.contentDigest`. If not,
   refuse. (T9 defense at the consumer — storage corruption surfaced
   immediately.)
2. **Parse the in-toto Statement.** Decode `attestation.statementB64`;
   confirm the statement's subject digest matches step 1.
3. **Verify the signature.** Use `attestation.certChainPem` +
   `attestation.signatureB64` to verify the signature over the
   Statement, against the Sigstore trust root.
4. **Verify the cert.** Walk the cert chain to a Fulcio root; confirm
   `notBefore`/`notAfter`; confirm OIDC subject claim matches
   expectations (if the consumer has a policy on who can sign).
5. **Verify the Rekor entry.** Parse `attestation.rekorInclusionProofJson`;
   confirm the entry's hash matches the Statement + cert; confirm the
   inclusion proof against the Rekor log's signed checkpoint
   (bundled with the trust root). If `rekorLogIndex` is reachable,
   optionally re-confirm online — but the proof alone is sufficient.
6. **Read the Context CI verdicts.** From
   `attestation.predicate.validation[]`, apply the consumer's policy:
   refuse if any verdict has `severity == "fail"` (default), or apply
   per-detector override rules (advanced consumers).

If all 6 steps pass, the primitive is **cryptographically trusted**.

### 10.4 Endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /api/v1/trust/{slug}/versions/{semver}` | Lookup by human name | Yes (PR 5.5.1); anonymous (PR 5.5.2+) for public registries |
| `GET /api/v1/trust/by-digest/{digest_hex}` | Lookup by SHA-256 hex digest — the canonical content-addressed lookup | Yes (PR 5.5.1); anonymous (PR 5.5.2+) |

The by-digest endpoint is the **verification-overlay shape**: any
consumer holding a primitive sha256 can ask "what does PrimitiveHub
know about this hash?" without needing to know its slug or where it
came from.

### 10.5 Behavior

- `404` if no signed attestation exists for the requested primitive.
  Trust bundles ONLY exist for primitives the signer has cryptographically
  attested.
- `400` on malformed digest input (not 64 lowercase hex chars).
- `500` on a digest mismatch between attestation and stored content
  (T9 — the registry SHOULD never serve a corrupt bundle; explicit
  failure beats silent corruption).

### 10.6 Cache discipline

Bundles for signed primitives are immutable — `digest` ↔ `attestation`
is a content-addressed mapping. Servers SHOULD set
`Cache-Control: public, max-age=31536000, immutable` on by-digest
responses. By-slug responses MAY be cached up to 24h (the slug → digest
mapping can change on a new version release).

See ADR-0013 for the design rationale and version-bump policy.

## 11. Open issues deferred to future versions

The following are acknowledged limitations of v0.1 and are tracked for v0.2
or later:

- **Differential attestations.** A primitive that is an iteration of a prior
  version currently ships a fresh attestation; differential attestations
  that reference the prior digest are not modeled.
- **Bundle attestation composition.** Bundles (composite primitives) carry
  their own attestation but do not formally aggregate constituent
  primitives' attestations. v0.2 will define a composition predicate.
- **Cross-registry primitives.** Primitives published in a non-PrimitiveHub
  registry but verified by PrimitiveHub-controlled scanners are out of scope
  for v0.1.
- **Private-registry signing.** Enterprise Sigstore deployment (private
  Fulcio + Rekor + Trillian) is specified at the architecture level but is
  not part of v0.1's reference implementation. Phase 7 of the build plan.
- **Attestation revocation.** When a previously trusted primitive is found
  to violate the threat model post-release, the attestation must be revoked.
  v0.1 documents this as a registry-level state change but does not define
  a cryptographic revocation mechanism.
- **Tokenizer dependence.** The `tokens` field is currently bound to a single
  declared tokenizer. A future version may carry multi-tokenizer counts.
- **i18n.** All current scanners assume English-language primitive bodies.
  Multi-language support is a v0.3+ concern.

## 12. References

- [in-toto Attestation Spec](https://github.com/in-toto/attestation)
- [SLSA v1.0](https://slsa.dev/spec/v1.0/)
- [Sigstore](https://www.sigstore.dev/)
- [DSSE — Dead Simple Signing Envelope](https://github.com/secure-systems-lab/dsse)
- [PrimitiveHub Threat Model](./threat-model.md)
- [Semantic Versioning 2.0](https://semver.org/)
- [SPDX License List](https://spdx.org/licenses/)
