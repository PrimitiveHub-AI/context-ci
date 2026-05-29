---
spec_version: "0.1"
name: security-engineering-supplychain
version: 0.1.0
type: security
domain: cybersecurity
author: PrimitiveHub Labs (synthesized 2026-05-29 from Ross Anderson's "Security Engineering" 3rd Ed.)
license: CC-BY-4.0
tokens: 4400
token_budget: 6000
risk_level: low
content_digest: sha256:5ecabc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a3
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
attestation: cci-v0.1
description: "Ross Anderson's security-engineering doctrine, calibrated to PrimitiveHub's supply-chain trust mission. Threat modeling, key lifecycle, AEAD, IDOR, side-channel metadata, trusted path, and the principle that security is a socio-technical system, not crypto."
use_when:
  - "Writing code that touches attestation, signing, or verification"
  - "Designing or reviewing tenant-isolation, RBAC, or access control"
  - "Designing the Context CI pipeline scanners or threat model"
  - "Reviewing any code path that handles credentials, tokens, or signing material"
  - "Touching the cryptographic vocabulary in the spec or paper"
  - "Designing admin/operator surfaces (admin tooling is part of the attack surface)"
do_not_use_when:
  - "Pure visual design without security implication"
  - "Documentation writing without code"
keywords: [security-engineering, threat-model, attestation, sigstore, key-lifecycle, idor, supply-chain, anderson]
references:
  - "Ross Anderson — Security Engineering (3rd Edition)"
  - "docs/threat-model.md — PrimitiveHub's 10 attack categories"
---

# Security Engineering for Supply-Chain Trust

## Purpose

Anderson's *Security Engineering* (3rd Ed.) is the standard reference
for building dependable distributed systems. This primitive distills the
principles that PrimitiveHub's threat model + attestation infrastructure
+ multi-tenant API depends on. The core insight: **security is not
crypto. Security is a socio-technical system.** Threat models must
include people, incentives, abuse, economics, and operational failure —
not just cipher choice.

PrimitiveHub's trust narrative — "agent context as supply-chain
material" — only holds if the underlying system actually implements the
controls. This primitive is the bar. The paper's claims rest here.

## Core Principles

- **Security goal triplet — every feature.** Name (a) what the feature
  protects, (b) from whom, (c) under what failure assumptions. No
  feature ships with unnamed assets, unnamed opponents, or vague
  "secure by design" claims.

- **Asset–threat–control map.** Map assets to realistic opponents and
  controls. No control exists without a named threat. Reverse: every
  named threat has a control (or an explicit accepted-risk
  documentation).

- **Opponent-class matrix.** Separate the classes that target
  PrimitiveHub:
  - **Curious researcher** (low resources, public exposure)
  - **Typosquat author** (T7 — npm-class supply-chain attacker)
  - **Compromised trusted author** (token theft, OAuth phish)
  - **Compromised dependency upstream** (T7)
  - **Insider with reviewer privileges** (insider threat)
  - **Nation-state interested in agent-supply-chain compromise** (low
    likelihood but high impact; primitive-via-compromise to plant
    backdoor in agent fleet)

- **Abuse-case first design.** Design against malicious use, not only
  normal. For every endpoint that accepts user input, the threat
  model question is "what's the worst thing the input could do?" not
  "what's the happy path?"

- **No invented crypto.** Use reviewed primitives and safe modes. For
  PrimitiveHub: SHA-256 for digests (NIST-approved), Ed25519 for
  signing (via Sigstore Fulcio), DSSE for envelopes, in-toto for
  attestation statements. **Never invent a new attestation format,
  signing scheme, or password hash.**

- **AEAD-by-default for confidential transport.** Authenticated
  encryption (AES-GCM, ChaCha20-Poly1305) for any encryption case.
  Encrypt-then-MAC patterns from scratch are reliably wrong.

- **Nonce uniqueness is a hard requirement.** For any AEAD mode,
  duplicate nonce + key reuse is catastrophic. Use counter or strong
  random; never roll your own.

- **Key lifecycle = generation, storage, rotation, revocation,
  backup, destruction.** Every key class in PrimitiveHub has a
  documented lifecycle. For Sigstore keyless: certs are ephemeral
  (10-min), no long-lived signing key, lifecycle is trivial. For any
  long-lived secret (database master key, JWT signing key, R2
  credentials): document each phase.

- **TLS protects transport, not authorization.** TLS verified
  endpoints does NOT mean the request is allowed. Authorize after
  authenticating; authorize on the authoritative path, not the UI
  path.

- **IDOR prevention is non-optional.** Every read or write of a
  user-controllable ID checks the owner. Owner-scoped queries are the
  default; admin endpoints have explicit elevation checks.
  PrimitiveHub's multi-tenant RLS policy enforces this at the DB
  layer, but application code must not rely solely on RLS — defense
  in depth.

- **Least-privilege access control.** Every actor/service gets the
  minimum needed. Service account for the API has Postgres rights
  scoped to `primitivehub` DB only — not the `authentik` DB. R2
  credentials scoped to the `primitives` bucket only.

- **Trusted path for sensitive actions.** Users need an unmistakable
  interface for irreversible / sensitive actions: publishing a
  primitive, revoking an attestation, deleting an organization. The
  UI must communicate "this is permanent" + require explicit
  re-authentication or 2nd-factor for high-risk ops.

- **Admin/support tooling is part of the attack surface.** A
  compromised admin token compromises the whole registry. Admin
  endpoints get higher friction (re-auth + audit log + alert).

- **Side-channel metadata budget.** Timing, size, frequency, error
  codes leak information even when payloads are encrypted. Constant-time
  comparisons for token validation. Same error message for
  "wrong-credentials" and "no-such-user" (or accept controlled risk
  with a documented decision).

- **Phishing-resistant ritual links.** Email and deep-link flows
  (password reset, OIDC redirect) must resist spoofing. Validate
  redirect URIs against allow-list. Never echo user-controlled
  redirects.

- **No security claim without evidence.** "Trusted release" requires
  the actual 10-stage Context CI run, not a marketing badge. The
  attestation record IS the evidence. If the evidence is missing or
  failing, the badge is wrong.

## Decision Rules

### Cryptographic decisions

- **IF a new cryptographic primitive is needed THEN** check what's
  already in use (SHA-256 for digests, Ed25519 via Sigstore for
  signing) and use that. Do not introduce a parallel.
- **IF a developer proposes "we'll write our own attestation format"
  THEN** reject — use in-toto. The threat model + spec depend on this.
- **IF a "performance optimization" suggests skipping signature
  verification THEN** reject. Verification is the product.

### Authentication + authorization

- **IF an endpoint reads or writes a record THEN** verify the actor
  has org-level permission AND record-level ownership. Two checks. RLS
  is one of them, not the only.
- **IF an admin endpoint exists THEN** it requires a second factor or
  re-authentication. Logged with actor + target + action.
- **IF a token is validated THEN** constant-time compare; never
  short-circuit on first-byte mismatch.
- **IF OIDC redirect URIs are configured THEN** allow-list them.
  Never echo arbitrary `redirect_uri` query param.

### Key + secret handling

- **IF a long-lived secret is being added THEN** document lifecycle
  (gen / store / rotate / revoke / backup / destroy). Default rotation
  cadence: 90 days for credentials, 1 year for JWT signing keys.
- **IF a secret is in code or env files committed to git THEN**
  reject. Use a secret manager (Phase 7+) or env vars with
  `.env.local` (gitignored).
- **IF logging code touches a secret-bearing object THEN** allowlist
  the fields logged. Never `log.info(user)` where `user` may carry
  tokens.

### Threat modeling

- **IF a new feature is proposed THEN** ask: what asset, what
  opponent, what control? Document. If any of the three are vague,
  the feature is premature.
- **IF a new attack surface is added (new endpoint, new file upload,
  new auth path) THEN** update `docs/threat-model.md` with the
  category match. If no category matches, that's a signal a new
  category is needed.

### Supply-chain specifics

- **IF a new npm or PyPI dependency is added THEN** justify in the
  PR description: what does it do, why this one, what's the
  alternative, what's the security posture (last release, maintainer
  reputation, audit status)?
- **IF a `postinstall` script appears in a dependency tree THEN**
  flag for review. Postinstall is a known supply-chain vector.
- **IF a primitive is published with `curl … | bash` instructions in
  its body THEN** the scanner flags T5; the review process gates.

## Anti-Patterns

- **"We'll add security later."** Security is foundational. Bolted on
  it becomes a stack of mitigations that don't compose.
- **Custom crypto.** Always wrong without exception.
- **MD5, SHA-1, plain SHA-256 for password hashing.** Use argon2id
  / bcrypt / scrypt. (PrimitiveHub doesn't store passwords —
  Authentik does — but reviewers should still know.)
- **Rolling-your-own JWT validation.** Use library, validate
  signature, audience, issuer, expiration.
- **Returning stack traces in error responses.** Leaks internal
  paths, library versions, schema names.
- **Hidden URLs as access control.** Security through obscurity is
  not security.
- **Negative-list input filtering.** "Strip these dangerous
  chars" — always incomplete.
- **Disabling TLS verification in dev that ships to prod.** Forgotten
  flag = compromised prod.
- **Hardcoded admin credentials in seed data.** Even in dev seed
  files. Generate per-environment.
- **Single point of compromise.** If one credential, one library, or
  one upstream package compromise compromises the whole product,
  reduce blast radius.

## Review Checklist

- [ ] Security goal triplet stated: asset, opponent, failure
      assumption.
- [ ] Threat model entry exists or is added in `docs/threat-model.md`.
- [ ] No invented crypto; only NIST / IETF / RFC primitives.
- [ ] AEAD for any new encryption case.
- [ ] No long-lived secrets in code or env-committed files.
- [ ] Authentication and authorization checked independently on every
      protected endpoint.
- [ ] Owner-scoped queries include explicit owner check (don't rely on
      RLS alone).
- [ ] Constant-time comparison for token validation.
- [ ] Error messages don't leak internal paths, schemas, or library
      versions.
- [ ] New dependencies justified in PR; postinstall scripts flagged.
- [ ] Logging excludes secret-bearing fields.
- [ ] Admin endpoints have re-auth + audit logging.
- [ ] Trusted-path UI for irreversible actions.
- [ ] Phishing-resistant: redirect URIs allow-listed; deep-link
      destinations clear.
- [ ] Documentation updated if a new attack surface is introduced.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before proposing a new endpoint, write the security goal triplet
   in the PR description.
2. Check whether the change introduces a new attack surface; if so,
   surface it as a finding in the PR description AND update
   `docs/threat-model.md`.
3. Reject any pull request that adds invented crypto, hidden URL
   access control, or negative-list input filtering.
4. Treat admin and support endpoints as higher-risk than user
   endpoints. Suggest re-auth + audit log for them.
5. When reviewing dependencies, surface the maintainer/version/
   last-update for any addition that introduces postinstall scripts
   or native bindings.
6. Cite Anderson chapters when relevant — engineers respect the
   source.

## Expected Output Format

A security review of a change should produce:

```
SECURITY GOAL TRIPLET
  Asset:        <what does this protect>
  Opponent:     <from whom>
  Assumption:   <under what failure mode>

THREAT MODEL DELTA
  Existing categories touched: <T1, T6, …>
  New categories introduced:   <or "none">

CONTROLS
  - <control 1> (defends against <threat>)
  - …

FINDINGS
  [severity] <file:line> — <issue>

VERDICT: [APPROVE | APPROVE-WITH-COMMENT | BLOCK]
```

## Examples

PrimitiveHub's `apps/api/registry/migrations/0002_rls_policies.py`
applies PostgreSQL RLS on every tenant-scoped table. This is one
control. Application-level owner checks in service code are the
defense-in-depth second control.

`apps/api/accounts/middleware.py` validates JWTs against Authentik's
JWKS with audience + issuer checks, uses a 1-hour JWKS cache to absorb
provider outages without locking everyone out, and refuses to start
with `DEV_AUTH_BYPASS=True` when `DEBUG=False`. All three are explicit
controls against specific failure modes.

The Phase 4 Sigstore integration deliberately uses public Sigstore for
public primitives (transparency log is the feature) and reserves
self-hosted Sigstore for Phase 7 enterprise/private (where transparency
log would publicly expose private-registry author identities).

## References

- Ross Anderson — *Security Engineering: A Guide to Building Dependable
  Distributed Systems* (3rd Ed.)
- PrimitiveHub threat model: `docs/threat-model.md`
- Cryptographic vocabulary: `CLAUDE.md` § Cryptographic vocabulary
- Spec attestation format: `docs/spec.md` §5
- Companion: `ddia-multi-tenant` (data-layer security)
