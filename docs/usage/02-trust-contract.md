# Trust Contract

The Trust Contract is the wire format every PrimitiveHub surface
speaks. It is what a Trust Bundle commits to, what the verifier
kernel checks, what the policy gate enforces, what the registry
publishes, and what the paper cites. This page is the user-facing
introduction; the normative reference is at
[`/specs/trust-contract-v0.1`](/specs/trust-contract-v0.1).

> **Why a separate user-doc:** the spec page is paper-grade. Read
> it when you need to know the exact field semantics or the
> conformance rules. Read this page when you need to know how the
> contract affects your day.

## TL;DR

A **Trust Bundle** is the unit of distribution for an agent-context
primitive. It binds four things together:

| Element            | What it commits to                                       |
|--------------------|----------------------------------------------------------|
| **Content Digest** | The exact bytes of the primitive (SHA-256).              |
| **Signature**      | The signer's identity at sign time (Sigstore keyless OIDC). |
| **Attestation**    | What Context CI thinks of those bytes (in-toto Statement). |
| **Provenance Chain** | Who validated, reviewed, and released this version.    |

A consumer (an agent runtime, the `phub` CLI, the GitHub Action,
the MCP server, `/check`) treats a Trust Bundle that does not verify
as untrusted. The contract is the same on every surface: one wire
format, one verifier.

> **v0.1 capability — what the installable release actually enforces.**
> The contract defines all four elements, but v0.1 ships only the
> **inspection** half. **Authentication** — the Sigstore signature,
> Fulcio cert chain, and Rekor inclusion proof — is **stubbed and lands
> in v0.2**. Until then the verifier's `authenticated` result is `false`
> for every bundle and the trust gate **fails closed**: it never reports
> a bundle as cryptographically authenticated.
>
> | Check | v0.1 status | Where |
> |---|---|---|
> | Schema / structure | ✅ implemented · enforced | CLI · CI · MCP |
> | Content digest (T9 tamper) | ✅ implemented · enforced | CLI · CI · MCP |
> | Context CI Top 10 policy | ✅ implemented · enforced (10 detectors) | CLI · CI · MCP |
> | Lock drift / seal | ✅ implemented · enforced | CLI · CI · MCP |
> | Sigstore signature | ⏳ planned (v0.2) — stubbed | — |
> | Fulcio cert chain / signer identity | ⏳ planned (v0.2) — stubbed | — |
> | Rekor inclusion proof | ⏳ planned (v0.2) — stubbed | — |
> | Host-enforced read gate | ⏳ planned — the MCP tool is advisory today | — |
>
> A `policy`-level pass proves **inspection**, not an **authenticated
> signer**. Gate trust on authentication, never on `result.valid` — see
> [verify-library](/docs/verify-library). This matrix reflects the tested
> v0.1 release; regenerate it from the release, do not hand-edit.

## The four primitives, in plain language

### Content Digest

Take the canonicalised bytes of the primitive. Hash them with
SHA-256. That hex string is the digest. Pin it.

If anything in the primitive changes — a single byte, a Unicode
codepoint, an extra newline at end-of-file — the digest changes.
The verifier hashes the bytes you have and compares them to the
digest in the bundle. A mismatch is a refusal.

The digest is the address. Wherever bytes live (registry, mirror,
local cache, `/tmp`, an HTTP download), the digest names them. We
use `sha256:<64 hex chars>` consistently. Other digest algorithms
are reserved for a future major version of the contract.

### Signature

The signer's identity at the moment they signed, expressed via
Sigstore keyless OIDC: a Fulcio short-lived certificate binding
their OIDC identity (`mhm@cyberorca.sa`, an Anthropic OIDC token,
a service account, etc.), plus a Rekor transparency-log entry
proving the signature was published.

**Sigstore keyless** means no long-lived private keys. Each
signature is a short-lived certificate plus a transparency-log
inclusion proof. Compromise an identity provider for an hour
and you sign whatever you can sign in that hour; you do not get
to silently impersonate the signer six months later. The Rekor
log makes the act of signing public — anyone watching the log
can see a signature was issued, by whom, against what digest.

The verifier checks the certificate's signature, its OIDC subject,
its validity window, and Rekor inclusion. A bundle whose Rekor
entry cannot be located is rejected: a signature that nobody can
see is not a signature.

### Attestation

A signed claim from Context CI saying "I scanned these bytes
against the Top 10 detector roster and here is what I found."

The attestation is an [in-toto](https://in-toto.io/) Statement
with `predicateType =
https://primitivehub.ai/context-ci/v0.1/Attestation`. The
predicate body carries:

- the corpus version Context CI ran against,
- the per-detector verdicts (`pass` / `warn` / `fail`) with their
  CCI ID and detector version,
- the macro verdict band (`clean` / `warn` / `risky`),
- the `trust_score` (deterministic; see
  [ADR-0041](https://github.com/DevXYZx/primitivehub/blob/main/docs/decisions/0041-verdict-and-scoring-engine.md)),
- the timestamp.

A consumer using `phub verify` or the MCP runtime gate reads the
attestation and applies the consumer's policy. A primitive can
carry an attestation that says `fail`; nothing forces a publisher
to lie about findings. The contract says *the attestation must be
true and signed*, not *the attestation must say pass*.

### Provenance Chain

A four-step record of who touched this version: **author →
validation → review → release**. Each step is timestamped and
attributable.

- **Author** is the OIDC identity that signed the source bundle.
- **Validation** is the Context CI run identifier — the
  attestation predicate above.
- **Review** is the human-reviewer identity that approved the
  release (when reviewer-approved releases apply; some
  publication paths skip this step and the chain records that).
- **Release** is the timestamp at which the registry made the
  bundle resolvable by digest.

The chain is not a marketing badge. It is an inspectable record:
a future incident response that needs to roll back a primitive
can follow the chain back through the registry to the OIDC
identity that signed it and revoke at any step.

## What the contract guarantees you

For a primitive that verifies:

- **The bytes are what the signer signed.** The signature binds
  the digest; the digest binds the bytes.
- **The signature is recent and visible.** Sigstore keyless
  short-lived certs + Rekor inclusion close the
  long-lived-private-key compromise window.
- **Context CI has scanned these bytes.** The attestation is a
  cryptographic claim; if it says the primitive passed the
  Top 10, an attacker would have had to compromise a Context CI
  signing identity to forge it.
- **There is a chain of accountability.** Who did what is
  recorded; nothing is "anonymous trusted."

For a primitive that does **not** verify, the consumer refuses to
load it and emits a stable refusal code naming which check failed.
There is no fallback. There is no "load anyway." The discipline
is what makes the contract worth the bytes it occupies.

## The lifecycle

```
draft -> attest -> publish -> resolve -> verify -> load
  |        |          |         |          |         |
  |        |          |         |          |         '- agent uses it
  |        |          |         |          '- phub / MCP / Action runs verifier
  |        |          |         '- consumer fetches by slug or digest
  |        |          '- bundle becomes addressable in the registry
  |        '- Context CI runs Top 10 + signs attestation
  '- author writes primitive in Markdown / Forge
```

Every step is on-record. The bundle a consumer verifies at the
end is the same bytes the author signed at the beginning, with
Context CI's verdict attached cryptographically in between.

## How to verify

Three ways, depending on where you are:

```bash
# 1. Local CLI verification (the developer-facing path):
phub verify <slug>@<semver>
# or
phub verify --bundle path/to/bundle.json

# Output (truncated) — v0.1:
#   digest match                           sha256:b7e4f1a9c…  OK
#   Context CI attestation predicate       cci-v0.1 · pass   OK
#   Sigstore (Fulcio cert + Rekor entry)   deferred — v0.2   —
# inspected · NOT cryptographically authenticated (fail-closed) · 0.31s
```

```yaml
# 2. CI verification (the team-facing path):
# .github/workflows/context-ci.yml
- uses: primitivehub/phub-scan@v0.1
  with:
    files: |
      AGENTS.md
      CLAUDE.md
      .cursor/rules/**
      .claude/skills/**
    fail-on: fail   # fail the PR if any verdict is FAIL
```

```jsonc
// 3. Runtime gate (the agent-facing path):
// Via the MCP runtime gate (ADR-0029):
{
  "tool": "verify_before_load",
  "args": {
    "subject": "skill:foo@0.3.0",
    "mode": "lock+scan"
  }
}
// advisory: the caller should refuse to load unless ok = true.
// The MCP tool is agent-invoked, not a host-enforced read gate (see /docs/mcp-server).
```

All three paths run **the same verifier kernel** —
[`@primitivehub/verify`](/docs/verify-library) — and apply the
same Trust Contract. What passes locally passes in CI; what
passes in CI passes at runtime. No surface gets a softer rule.

## Reading a Trust Bundle

A bundle is a small JSON document. The minimal shape:

```jsonc
{
  "spec_version": "0.1",
  "subject": {
    "slug": "strict-code-review",
    "semver": "2.1.0",
    "media_type": "application/vnd.primitivehub.primitive+md"
  },
  "content": {
    "digest": "sha256:b7e4f1a9c3d28e5b…",
    "size_bytes": 3840,
    "license": "CC-BY-4.0"
  },
  "signature": {
    "scheme": "sigstore-cosign",
    "certificate_chain": "<PEM>",
    "transparency_log": {
      "kind": "rekor",
      "index": 24296,
      "uuid": "24296fb24b8ad77a…"
    }
  },
  "attestation": {
    "predicate_type":
      "https://primitivehub.ai/context-ci/v0.1/Attestation",
    "predicate": {
      "corpus_version": "0.2",
      "verdict_band": "clean",
      "trust_score": 96,
      "per_detector": [
        { "cci_id": "CCI-001", "detector": "t1.prompt_injection",
          "version": "v0.2.1", "verdict": "pass" }
        /* …all ten CCIs… */
      ]
    },
    "envelope": "<DSSE envelope>"
  },
  "provenance": [
    { "step": "author",     "subject": "mhm@cyberorca.sa",
      "timestamp": "2026-05-16T10:00:00Z" },
    { "step": "validation", "subject": "context-ci-runner",
      "timestamp": "2026-05-16T10:00:21Z" },
    { "step": "review",     "subject": "marcus.webb@cyberorca.sa",
      "timestamp": "2026-05-18T14:00:00Z" },
    { "step": "release",    "subject": "primitivehub-registry",
      "timestamp": "2026-05-18T14:32:00Z" }
  ]
}
```

You can fetch a bundle for any published primitive with `phub
fetch <slug>@<semver>` and pretty-print the JSON. The
`/specs/trust-contract-v0.1` page documents every field; this
example is meant to fit on one screen.

## When verification fails

The verifier emits one of a small set of stable refusal codes.
You will see these in CI output, in your terminal, and in MCP
gate responses:

| Code               | Meaning                                                |
|--------------------|--------------------------------------------------------|
| `DIGEST_MISMATCH`  | The bytes on disk do not hash to the claimed digest.   |
| `SIGNATURE_INVALID`| The Sigstore certificate, chain, or signature failed.  |
| `REKOR_MISSING`    | The transparency-log inclusion could not be verified.  |
| `ATTESTATION_FAIL` | Context CI's attestation predicate says `fail`.        |
| `LOCK_DRIFT`       | The bytes are not what `.primitivehub/phub.lock` pins. |
| `BUNDLE_MALFORMED` | The bundle does not match the schema.                  |
| `POLICY_BLOCK`     | The org policy (`.primitivehub/policy.yaml`) blocked it. |

A refusal is a contract. The consumer does not "warn and proceed."
The default is `refuse and report`. If you need to override a
specific refusal in a specific environment (e.g. accept a
documented FP for one repo), you add a narrow `allow:` entry to
your project's `.primitivehub/policy.yaml` and a matching
`FP-NNN` ledger row in `docs/false-positive-resolution.md`. The
discipline is documented in
[Context Policy Language](/docs/context-policy).

## Versioning the contract

The contract is versioned: today's spec is
[**Trust Contract v0.1**](/specs/trust-contract-v0.1). Compatible
extensions (new optional fields, new detector versions inside an
attestation) ride a minor bump. Anything that would invalidate a
v0.1 verifier — a hash algorithm change, a Sigstore replacement,
a new required field — is a major version (v1.0) and ships
alongside its predecessor for the deprecation window documented
in
[ADR-0015](https://github.com/DevXYZx/primitivehub/blob/main/docs/decisions/0015-trust-contract-versioning.md).

A bundle declares which contract version it speaks via
`spec_version`. A verifier rejects bundles speaking a contract
version newer than itself; it does not silently downgrade.

## Where the contract sits in the project

The Trust Contract is the spine. Around it ride the other surfaces:

- The [Context CI Top 10](/top-10) taxonomy is what the
  attestation predicate scans against — one of the contract's
  required references.
- The [`phub` CLI](/docs/phub-cli) is the developer-facing
  verifier (`phub verify`, `phub audit`, `phub install`).
- The [`phub.lock`](/docs/phub-lock) file pins specific bundles
  to a project so drift is a CI failure, not a silent edit.
- The [Context Policy Language](/docs/context-policy) decides
  what the consumer does about a verdict (refuse / warn / allow).
- The [GitHub Action](/docs/github-action) runs the verifier as
  a PR gate and produces SARIF.
- The [MCP Server](/docs/mcp-server) exposes the verifier as a
  `verify_before_load` tool to agent runtimes.
- The [`verify` Library](/docs/verify-library) is the embeddable
  kernel — the same code every surface above runs.
- The [CBOM](https://github.com/DevXYZx/primitivehub/blob/main/docs/cbom-v0.1.md)
  format is the inventory artifact: a CBOM lists every Trust
  Bundle a project consumes.

Every claim PrimitiveHub makes — "verified," "attested,"
"refused at the gate," "policy-gated install" — is a statement
about the Trust Contract. Nothing in the project bypasses it.
That is the design: the contract is the small piece that has
to be correct so the rest can compose.

## Next

- Walk an end-to-end verify with the [`phub` CLI](/docs/phub-cli).
- Read how the Trust Contract is enforced in CI with the
  [GitHub Action](/docs/github-action).
- Read the normative spec at
  [`/specs/trust-contract-v0.1`](/specs/trust-contract-v0.1) when
  you need exact field semantics or conformance rules.
