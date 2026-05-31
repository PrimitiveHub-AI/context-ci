# ADR-0020: `@primitivehub/verify` as the reference implementation

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0015 (Trust Contract versioning), ADR-0021
(conformance suite as executable contract),
`docs/trust-contract-v0.1.md`, `packages/verify/`,
`docs/execution-plan.md` Gate G-B

## Context

ADR-0015 locked the Trust Contract v0.1 versioning + deprecation
policy. ADR-0021 designated the conformance suite as the executable
contract — when spec text and suite disagree, the suite wins. But
**three implementations may all pass the same suite yet differ on
ambiguous corners.** The conformance suite is a floor, not a ceiling.

We need a single designated reference implementation that resolves
spec ambiguities for the TypeScript/JavaScript side of the ecosystem.
That implementation's behavior IS the v0.1 contract in disputed
cases; the suite encodes what we've already noticed; the reference
implementation defines what we'll do about cases we haven't yet
written a suite test for.

## Decision

**`@primitivehub/verify`** (`packages/verify/` in this monorepo,
published to npm at `@primitivehub/verify`) is the reference
implementation for Trust Contract v0.1 verification in
TypeScript/JavaScript. Its behavior on the v0.1-implemented steps
(1, 2, 7) is what the spec means in disputed cases.

### Reference-implementation rules

1. **The suite is the floor.** Both the reference implementation and
   any third-party implementation MUST pass every test in
   `docs/trust-contract/conformance/` for the version they claim
   conformance with.

2. **The reference is the ceiling.** When a behavior question arises
   that the suite doesn't cover, the reference implementation's
   behavior is the answer. A clarifying suite test SHOULD be added
   in the same PR that resolves the question.

3. **Reference-implementation behavior is committed before the suite
   covers it.** New corner cases observed in the wild are first
   resolved in the reference implementation; the suite catches up.
   This is the opposite ordering from "spec change requires suite
   first" — the reference fills the gap, the suite codifies it.

4. **Three-way ratchet.** Spec text + reference implementation + suite
   ratchet together. A change to any of them requires the other two
   to be aligned in the same PR (or a follow-up PR within the same
   week per `docs/execution-plan.md`'s gate criteria).

### Scope of the v0.1 reference

The v0.1 release of `@primitivehub/verify` implements verification
procedure steps 1, 2, 7 (schema validation, content digest, Context
CI policy). Steps 3-6 (in-toto Statement parse, signature
verification, cert chain walk, Rekor inclusion proof) are
**explicitly stubbed** and return `*_DEFERRED` failures when
`level: "full"` is requested.

The reference-implementation rule applies only to the steps
actually implemented. For deferred steps:
- The library is NOT the reference (because it doesn't do them).
- The Python reference signer (`apps/api/signing/`) produces real
  cryptographic artifacts; the v0.2 release of this library will
  verify them.
- Third-party implementations may implement steps 3-6 ahead of v0.2
  and claim "Trust Contract v0.1 conformance (full level)" only
  after their behavior is reconciled against this library's v0.2
  behavior.

### What being the reference does NOT mean

- It does not mean other implementations can't ship. Anyone can
  build a verifier; conformance to the suite is what makes them
  conformant, not whether they're THE reference.
- It does not mean the reference is feature-complete. v0.1
  deliberately stubs 4 of 7 steps; the reference accurately reflects
  the v0.1 contract's capability.
- It does not mean the reference is the only thing that matters.
  The Python signer + verifier paths in `apps/api/signing/` are also
  authoritative for their language; this ADR is specifically about
  resolving TS/JS-side ambiguities.

## Alternatives considered

1. **No reference implementation — the suite is the only authority.**
   Rejected. The suite is a finite set of fixtures; the spec covers
   infinite inputs. When two suite-passing implementations diverge
   on an input not in the suite, there's no arbiter. ADR-0021's
   "tests win on disagreement" rule needs a tiebreaker rule for
   "tests are silent."

2. **Multiple reference implementations** (one per language). Considered.
   Already true in practice — Python reference signer +
   Python reference verifier (the conformance harness in
   `apps/api/tests/test_trust_contract_conformance.py`); TypeScript
   reference verifier (this library). Each is the reference for its
   language ecosystem. This ADR formalizes the TS reference;
   the Python reference is implicit + load-bearing (the producer
   side).

3. **Designate a third-party implementation as reference.** Rejected.
   Nobody has built one yet, and the spec author should hold the
   reference at v0.1 to keep iteration velocity high. Post-launch,
   if a third party builds a higher-quality verifier, the reference
   designation can move with an ADR + spec note. Rare but possible.

4. **Treat the spec text as authoritative; implementations are all
   tied for second.** Rejected for the same reason ADR-0021 chose
   the suite over text: text drifts, code doesn't lie. The reference
   implementation IS code; spec text is documentation around it.

## Consequences

### Positive

- **Ambiguities resolve in one direction.** No "well, my reading of
  step 2 says…" arguments — run the reference, see what it does.
- **Suite growth has a forcing function.** When the reference does
  something the suite doesn't cover, the gap is visible — the next
  PR adds the missing fixture.
- **Third-party implementers know what to do.** Pass the suite +
  match the reference on the v0.1-implemented steps + claim
  conformance. Clean criterion.
- **The Python and TS sides stay aligned.** Both reference
  implementations must pass the same suite. Divergence shows up
  immediately at CI time on whichever side regressed.

### Negative

- **Reference-implementation bugs become spec quirks.** If
  `@primitivehub/verify` v0.1 has a quiet bug in (say) the
  pattern-matching for `subject.slug`, that bug is the v0.1
  contract until v0.2 fixes both the implementation and the suite.
  Mitigation: aggressive code review on every reference-impl change
  + the "spec text + reference + suite ratchet together" rule.
- **Reference-implementation upgrades are coupled to spec
  upgrades.** A patch-level v0.1.1 of the library that changes
  observable behavior triggers a spec-text clarification PR. This
  is the right pressure to keep changes deliberate.
- **The "reference is the ceiling" rule risks bloat over time.**
  We may accumulate "the way the reference does it" semantics that
  weren't intended as spec. Mitigation: v0.2 is a chance to prune
  by spec-bumping anything load-bearing into the text + suite.

### Neutral

- **The v0.1 reference is permissive on deferred steps.** A bundle
  whose Sigstore signature is gibberish still passes the
  `structural` and `policy` levels — those levels don't check
  signatures. Consumers needing cryptographic guarantees today MUST
  use the producing PrimitiveHub instance's HTTP Trust API as the
  trust boundary (which DOES check signatures end-to-end via the
  Python-side code path).

## Implementation

- `packages/verify/` — the npm package source
  - `src/index.ts` — public API surface
  - `src/verify.ts` — orchestrator implementing steps 1, 2, 7;
    stubs 3-6 with `*_DEFERRED` failures when `level: "full"`
  - `src/schema.ts` — hand-rolled JSON Schema validator covering
    only the keywords the v0.1 schema uses (`<50KB minified, zero
    deps` target)
  - `src/digest.ts` — Web Crypto `subtle.digest` wrapper
  - `src/policy.ts` — Context CI policy evaluation
  - `src/types.ts` — TS types mirroring the spec
  - `src/errors.ts` — stable `VerificationErrorCode` enum
  - `schema/v0.1.json` — vendored copy of the canonical schema
- `packages/verify/test/conformance.test.ts` — vitest port of the
  Python pytest conformance harness. Reads the same canonical
  fixtures from `docs/trust-contract/conformance/`. 23/23 passing.
- `packages/verify/README.md` — 30-line embedding example +
  versioning + known-limitations + conformance commitments
- `packages/verify/LICENSE` — MIT
- `packages/verify/package.json` — `engines.node: ">=20"`,
  ESM-only output, `dist` + `schema` + `README.md` + `LICENSE` in
  `files`

## What ships in subsequent PRs

- **PR 5.5.4.publish (Gate G-B follow-up)** — npm org + publish
  automation. Requires:
  - `npm` org `@primitivehub` claimed
  - `NPM_TOKEN` secret in GitHub Actions
  - publish workflow on tag push
  Out of scope for the build-it PR (this one); shipped as
  ops follow-up before Gate G-B is fully closed.
- **PR 5.5.5 (Weeks 8-9)** — `@primitivehub/mcp-server` builds on
  this library; thin shim per `docs/execution-plan.md` Gate G-D.
- **PR 5.5.3 (Weeks 5-7)** — `phub` CLI consumes this library for
  the `phub verify` command per Gate G-C.
- **v0.2 of `@primitivehub/verify`** — unstubs steps 3-6. Needs
  in-toto Statement protobuf decoder + Sigstore trust-root bundle +
  ECDSA-P256 verification path. Separate PR; separate ADR
  candidate (ADR-0022+ depending on what's load-bearing).

## References

- `packages/verify/` — the implementation
- `packages/verify/README.md` — embedding + API + limitations
- `docs/trust-contract-v0.1.md` — the spec this library implements
- ADR-0015 — versioning + deprecation policy
- ADR-0021 — conformance suite as the executable contract
- `docs/execution-plan.md` Gate G-B — Verifier Kernel acceptance
- `docs/trust-contract/conformance/` — the suite both reference
  implementations pass
