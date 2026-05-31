# ADR-0021: Conformance suite as the executable contract definition

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0015 (Trust Contract versioning), ADR-0020 (reference
implementation, planned), `docs/trust-contract-v0.1.md`,
`docs/trust-contract/conformance/`,
`docs/execution-plan.md` Gate G-A

## Context

The Trust Contract v0.1 spec (ADR-0015) is text. Texts drift:
implementers read it differently, edge cases stay ambiguous, and a
year from now nobody remembers what "MUST" really meant in the §7
verification procedure. A spec that exists only as prose becomes
whatever the latest code happens to do — and that's exactly what we
told ourselves we wouldn't allow.

We need an artifact that is:
- **Unambiguous** — a verifier either accepts a fixture or it doesn't
- **Portable** — checked into the repo, no proprietary tooling required
- **Reproducible** — running the suite twice gives identical results
- **Authoritative** — when the spec text and the artifact disagree,
  there's a clear winner

## Decision

The conformance suite at
**`docs/trust-contract/conformance/`** is the **executable definition**
of the Trust Contract v0.1 wire format. When the spec text and the
suite disagree, **the suite wins** and the spec gets a clarifying PR.

The suite has three parts:

1. **`schema/v0.1.json`** — the JSON Schema (Draft 2020-12) that
   defines the bundle structure. Authoritative for structural
   validation.
2. **`valid/`** — golden bundles every conformant implementation
   MUST accept. Schema-valid AND pass the semantic steps of the
   verification procedure that don't require live cryptography.
3. **`invalid/`** — adversarial bundles every conformant
   implementation MUST reject. Each is paired with a `.md` that
   documents which verification step is expected to reject it and
   why the case matters.

A pytest harness at
`apps/api/tests/test_trust_contract_conformance.py` runs the suite
against the PrimitiveHub reference implementation. The harness is
the reference; ports to other languages MUST mirror its structure
(per ADR-0020, planned).

### What "conformant" means

An implementation may claim **"PrimitiveHub Trust Contract v0.1
conformant"** in its documentation and marketing if and only if it
passes every test in the v0.1 suite. The phrase is reserved. We
will publicly correct claims that don't.

### What happens when the suite + spec disagree

The suite is the source of truth. The text is documentation around it.
If a reviewer notices the spec says one thing and the suite enforces
another, the fix is to clarify the spec text — NOT to weaken the suite.

This rule prevents the failure mode where well-meaning maintainers
"clarify" the spec text in a way that subtly changes behavior, while
existing implementations continue to do the old thing and silently
become non-conformant.

### When the suite must grow

Per ADR-0015, every breaking spec change requires a major-version
bump. Every major-version bump requires an updated conformance suite
committed in the same PR. The new major's tests pass; a `legacy/`
subdirectory preserves the prior major's tests so consumers verifying
older bundles still have the suite.

For non-breaking changes (minor or patch bumps), the suite SHOULD
grow to cover the new surface — but doesn't strictly need to. The
rule of thumb: if the change adds a field that a producer could
populate or omit in interesting ways, add a golden bundle for the
populated case and one for the omitted case.

## Alternatives considered

1. **Spec text alone — no executable suite.** Rejected. This is what
   ADR-0013 originally shipped (schema embedded in `docs/spec.md`
   § 10). The moment we have one external implementer, prose-only
   disagreements become unresolvable.

2. **Suite as part of a separate `primitivehub-spec` OSS repo,
   pulled into the main repo as a git submodule.** Considered.
   Cleaner long-term but premature. Until launch, the suite lives
   alongside the implementation it's the canonical interpretation of.
   Spinning it out becomes a Phase 12 standards-body submission task.

3. **Pact-style contract tests — provider and consumer publish
   pacts, get matched.** Rejected. Useful for service-to-service
   API testing; overkill for a wire format. JSON fixtures + schema
   are simpler and language-agnostic.

4. **Property-based testing (hypothesis / fast-check) instead of
   golden fixtures.** Considered. Useful complement, not replacement.
   Property tests prove invariants ("re-hashing always works"); golden
   fixtures prove specific cases ("THIS exact bundle is accepted").
   Both have value; v0.1 ships only the goldens; property tests are
   a candidate for Phase 6.

5. **Make the spec text + JSON Schema the only artifacts; no
   "golden bundles."** Rejected. The JSON Schema alone doesn't
   exercise the semantic verification procedure (digest match,
   subject match, etc.). Golden bundles let the suite verify ALL
   layers, not just structural conformance.

## Consequences

### Positive
- **Disputes have a clear arbiter.** When implementers disagree, the
  suite's outcome decides.
- **External implementers can self-certify.** Run the suite; if it
  passes, claim conformance.
- **Drift between reference implementation and spec is caught at
  CI time.** The suite IS part of the pytest run.
- **The suite is the migration safety net** when we bump major
  versions — the legacy/ tests stay green throughout.
- **The "conformant" trademark is enforceable.** We reserve the
  phrase, and the standard for it is public.

### Negative
- **Authoring fixtures takes work.** Hand-authored adversarial
  fixtures + companion .md files for each. 12 valid + 3 invalid
  shipped in PR 5.5.B; suite needs to grow to ≥30 + ≥10 by end of
  Week 2.
- **Generator coupling.** The valid/ fixtures are produced by a
  deterministic generator that depends on the current noop backend
  output shape. If we change the noop backend, fixtures must be
  regenerated AND committed. Documented in the conformance README.
- **Fixture path is bind-mounted into the api container** (read-
  only at `/repo/docs/`). This is a small operational quirk
  (added to `compose.override.yaml`) but means the test discovery
  works in both container + host pytest runs.

### Neutral
- **The suite lives at `docs/trust-contract/conformance/`** — under
  docs/, not under tests/ — because it's a strategic artifact other
  language implementations consume, not just code-local Python tests.

## Implementation

- `docs/trust-contract/conformance/schema/v0.1.json` — JSON Schema
- `docs/trust-contract/conformance/valid/` — 12 golden bundles +
  generator script
- `docs/trust-contract/conformance/invalid/` — 3 adversarial bundles
  with companion `.md` files
- `docs/trust-contract/conformance/README.md` — porting guide,
  growth schedule, regeneration recipe
- `apps/api/tests/test_trust_contract_conformance.py` — pytest
  harness (33 tests passing)
- `apps/api/signing/backends.py` — `NoopSigstoreBackend` updated to
  produce schema-conformant `rekorLogId` (64 hex chars) +
  `rekorInclusionProofJson` (canonical key set). Was required to
  make the reference-implementation conformance test pass.
- `compose.override.yaml` — `- ./docs:/repo/docs:ro` mount on api
  service
- `apps/api/pyproject.toml` — `jsonschema` dependency added

## What ships in subsequent PRs

- **PR 5.5.A.bis or 5.5.B-tail (still Week 2)** — grow the suite
  toward Gate G-A's ≥30 + ≥10 floor. Specific missing fixtures:
  malformed-PEM, tampered-signature, expired-cert, mismatched-statement,
  additional-property, wrong-media-type, negative-log-index, and ~18
  more goldens spanning corner cases (max-size content, all-fail
  predicate, predicates with diff_hints exercising the snippet cap, etc.)
- **PR 5.5.C / Week 2 close** — Gate G-A check: all G-A boxes pass.
- **PR 5.5.4 (Week 3–4)** — `@primitivehub/verify` ports this suite
  to TypeScript and proves all tests green.

## References

- `docs/trust-contract-v0.1.md` — the spec this ADR makes executable
- `docs/trust-contract/conformance/README.md` — operational guide
- ADR-0015 — Trust Contract versioning + deprecation policy
- ADR-0020 (planned, Week 4) — `@primitivehub/verify` as the
  reference implementation
- `docs/execution-plan.md` Gate G-A — Standards Lock acceptance criteria
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/release-notes.html)
