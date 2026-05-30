# ADR-0011: Sigstore backend abstraction — public / staging / self-hosted swap

**Status:** Accepted
**Date:** 2026-05-30
**Supersedes:** none
**Superseded by:** none

## Context

Phase 4 wires Sigstore keyless signing into PrimitiveHub's upload
pipeline. We have three deployment realities to satisfy:

1. **Production public registry (v1, Q3 2026).** Must sign against
   **public Sigstore** (Fulcio + Rekor at `sigstore.dev`). Anything
   else and consumers can't verify our attestations with off-the-shelf
   `cosign verify`.

2. **Local development (right now).** Cannot reasonably use public
   Sigstore: (a) Fulcio's allowlist requires the OIDC issuer to be
   HTTPS-public, and we run Authentik on `localhost`; (b) every test
   would burn a real Rekor entry — the public transparency log is
   append-only and indexable. Need a backend that accepts our local
   Authentik AND doesn't pollute the public log.

3. **Phase 7 enterprise self-host.** Some PrimitiveHub customers will
   run private registries whose author identities must not appear in
   the public Rekor transparency log (legal compliance, internal
   project naming). They'll run their own Sigstore stack (Fulcio +
   Rekor + CTLog + Trillian) and need us to sign against THAT.

If we pick one backend now, the others become "rip-and-replace" months
later. The cost of building the abstraction once is much smaller than
paying it during a Phase 7 customer escalation.

## Decision

Introduce a `SigstoreBackend` Protocol in `apps/api/signing/backends.py`
with **four** implementations:

| Backend       | When                                       | Trust source                              |
|---------------|--------------------------------------------|-------------------------------------------|
| `public`      | Production public registry                 | `ClientTrustConfig.production()`          |
| `staging`     | Dev default; CI; staging environment       | `ClientTrustConfig.staging()` (sigstage)  |
| `self-hosted` | Phase 7 enterprise private registries      | Operator-supplied JSON trust config file  |
| `noop`        | Unit tests                                 | None (deterministic synthetic output)     |

Selection: one env var, `SIGSTORE_BACKEND`. The factory
`get_backend()` reads it and instantiates. Misconfigured deploys raise
`UnknownBackendError` / `BackendConfigurationError` — never silently
fall back.

The Protocol surface is intentionally small:

```python
class SigstoreBackend(Protocol):
    name: str
    rekor_url: str
    def sign(self, statement_bytes: bytes, *, identity_token: str) -> SigningResult: ...
    def verify_url_for_rekor_entry(self, log_index: int) -> str: ...
```

Two methods, two attributes. Everything else (Statement construction,
predicate schema, retries, error mapping) lives outside the backend so
the surface stays stable.

## Alternatives considered

1. **Single backend, swap later.** Rejected. Every line of signing
   code would have to branch on backend type when Phase 7 arrives, or
   we'd need an emergency abstraction-and-migration project under
   customer-deadline pressure. The cost of building the abstraction
   now (one PR, ~half a day) is much lower than paying that bill.

2. **Operator picks via Django settings dict (no Protocol).** Considered.
   Skipped because we want compile-time-checkable contracts on the
   sign() signature, and Protocol+mypy gives that for free. Settings-
   based dispatch encourages drift between backends.

3. **Wrap `cosign` CLI instead of `sigstore-python`.** Rejected.
   Subprocess overhead, harder to mock in tests, version skew between
   our CI image and the Sigstore deployment, no idiomatic Python types
   for results. We picked `sigstore-python` because it gives us types
   for `Bundle`, `SigningCertificate`, and Rekor entries that flow
   naturally into our `SigningResult` dataclass.

4. **Self-host Sigstore from day one.** Rejected. Sigstore is 4
   services (Fulcio, Rekor, CTLog, Trillian); operating it well is a
   multi-week project. We have zero Phase 7 customers today. Building
   it now means slowing Phase 4 by weeks for theoretical value. The
   abstraction lets us defer the deployment without deferring the
   architectural commitment.

5. **Skip the staging backend; use public Sigstore in dev.** Rejected
   for the reasons above: (a) Fulcio allowlist requires public OIDC
   issuer, blocking dev signing entirely; (b) every dev test would
   write to the public transparency log forever.

## Consequences

### Positive
- **One env var swaps backends.** Production → `public`; dev → `staging`;
  CI → `noop`; Phase 7 customer → `self-hosted`. No code paths change.
- **Phase 7 isn't a migration.** Customers get the self-host story by
  pointing at their trust root. We don't have to re-architect under
  pressure.
- **The paper has a clean architectural story.** "PrimitiveHub abstracts
  the Sigstore backend; the same signing code targets public Sigstore
  for the public registry, sigstage for development, and self-hosted
  Sigstore for enterprise private registries." Hard for GitHub /
  HuggingFace / npm to copy without re-architecting their own pipelines.
- **Tests don't depend on network.** `noop` backend produces
  deterministic SigningResults; unit tests run in <1s without touching
  sigstage.

### Negative
- **More files than a single backend.** ~6 files in `signing/`
  vs ~2 if we'd inlined. Reviewability is the offset: each backend
  is ~30 lines and the boundary is obvious.
- **Self-hosted backend ships UNTESTED in PR #2.** PR #2 only verifies
  the construct-and-config path. The `sign()` path requires a real
  self-hosted Sigstore, which we don't have. Phase 7 will need
  integration tests against a real or compose-up self-hosted stack.
- **`sigstore-python` version skew risk.** If they break the
  `SigningContext.from_trust_config()` API between releases (they
  shifted it once already between v3 and v4), the abstraction
  insulates us — only `_signing_context()` in each backend changes,
  not the rest of the pipeline.

### Neutral
- **The `name: str` attribute** on every backend gets stored on
  `Attestation.backend_name` (added in PR #3). A later verifier knows
  which trust root to use when checking the cert chain.

## Implementation

- `apps/api/signing/backends.py` — Protocol + 4 implementations + factory
- `apps/api/signing/statement.py` — in-toto Statement builder (uses
  `in-toto-attestation` reference library, predicate type locked to
  `https://primitivehub.ai/context-ci/v0.1/Attestation` per `docs/spec.md`)
- `apps/api/signing/types.py` — `SigningResult` dataclass
- `apps/api/signing/exceptions.py` — domain exceptions
- `apps/api/.env.example` — documents all four backends + self-hosted
  required vars
- `apps/api/tests/test_signing_abstraction.py` — 28 tests covering
  factory, noop, statement builder, real-backend construction

## Operator-visible constraint: sigstage Fulcio allowlist

sigstage's Fulcio maintains an allowlist of OIDC issuers it will mint
certs for. Our local Authentik (`http://authentik-server:9000`) is
NOT on it, and Fulcio requires HTTPS-public issuers anyway. Three
follow-up paths (none blocking this ADR):

1. Submit our public-facing Authentik (post-launch HTTPS) to
   sigstage's allowlist via PR.
2. For dev/CI integration tests, use an ambient OIDC credential from
   an allowlisted issuer (GitHub Actions, GCP, AWS).
3. Phase 7 self-hosted Sigstore controls its own allowlist —
   enterprise customers don't hit this.

Tracked in `docs/bugs.md` #24. PR #3's integration test refuses to
run without `SIGSTAGE_OIDC_TOKEN` from an allowlisted issuer.

## What ships in subsequent PRs

- **Phase 4 PR #3** ✓ (`feat/api-sigstore-keyless-signing`) — fills in
  `sign()` on public/staging/self-hosted using `sigstore-python`'s
  `SigningContext`. Bundle extraction → `SigningResult` fields. Live
  integration test gated by sigstage allowlist constraint above.
- **Phase 4 PR #4** (`feat/api-sign-on-upload`) — wire `get_backend()`
  into the upload endpoint via a Procrastinate task. Attestation state
  machine.
- **Phase 4 PR #5** (`feat/web-attestation-badge-and-rekor-link`) — UI
  for `verify_url_for_rekor_entry()`.
- **Phase 7** — self-hosted Sigstore in compose under `--profile
  sigstore-local`; integration tests against it.

## References

- `apps/api/signing/` — implementation
- `docs/spec.md` § Attestation — locked predicate type
- `docs/threat-model.md` — what signing defends against
- `apps/web/content/primitives/security-engineering-supplychain.md`
  § Sigstore keyless signing
- Sigstore Python client: https://github.com/sigstore/sigstore-python
- sigstage docs: https://docs.sigstore.dev/system_config/public_deployment/
