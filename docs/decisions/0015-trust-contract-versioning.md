# ADR-0015: Trust Contract v0.1 versioning and deprecation policy

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0013 (Trust Bundle format — original decision),
ADR-0020 (reference implementation, planned), ADR-0021 (conformance
suite, planned), `docs/trust-contract-v0.1.md`,
`docs/execution-plan.md` Gate G-A

## Context

The Trust Bundle format shipped in PR 5.5.1 (ADR-0013) as an internal
schema documented in `docs/spec.md` § 10. The execution plan's Standards
Lock work (Weeks 1–2) promotes it to a standalone versioned spec —
**`docs/trust-contract-v0.1.md`** — that is published, conformance-
tested, and intended for third-party adoption.

Promotion only makes sense if we lock the **versioning + deprecation
discipline** that governs future changes. Without that discipline, the
"standard" becomes whatever the latest code happens to do, and
external implementers can't depend on it.

The question this ADR answers: **what are the rules for changing the
Trust Contract once it's published?**

## Decision

### Version-number semantics

The Trust Contract follows **semantic versioning** at the spec level:

- **Major version** (`1.x`, `2.x`, …) — breaking changes. Examples:
  removing or renaming a required field, changing a field's type,
  changing the semantics of an existing field, introducing a new
  required field (because v0.x consumers will reject the bundle as
  unknown-key under strict schema validation).
- **Minor version** (`0.1`, `0.2`, …) — additive, backward-compatible
  changes. Examples: new optional fields, new enum values in fields
  marked extensible, new attestation predicate sub-keys (the predicate
  is `additionalProperties: true` at the predicate level for exactly
  this).
- **Patch version** — reserved for editorial corrections (typos,
  clarifications). Patch bumps MUST NOT change any normative behavior.

The current Trust Contract is **v0.1**. We will reach **v1.0** at the
point we commit to a 5-year stability window post-launch.

### What requires a major version bump

A change is **breaking** (major bump) if ANY of these are true:

1. A field that was required in a prior version is removed or renamed.
2. A field's type changes (string → integer, etc.).
3. A field's semantic meaning changes such that two bundles that
   passed the old verification procedure would now disagree.
4. A new required field is added (because forward-compat-strict
   consumers reject unknown-required configurations).
5. The JSON Schema in §6 of the spec adds a constraint that previously-
   valid bundles would now fail.
6. The verification procedure (§7) gains a step that previously-valid
   bundles would now fail.
7. The media type changes.

A change is **additive** (minor bump) if NONE of the above apply AND:

- New optional fields, or
- New enum values in fields explicitly marked extensible
  (`backendName` is NOT extensible — adding a backend is a major
  bump), or
- Clarifying examples in non-normative text, or
- New optional verification steps that consumers MAY perform.

### RFC requirement for breaking changes

Every major-version bump MUST be preceded by a public RFC:

1. **RFC issue opened** on the public PrimitiveHub repository (post-
   launch; pre-launch the RFC lives in `docs/rfcs/` and is reviewed
   internally), describing the breaking change, the motivation, the
   migration path, and the deprecation timeline.
2. **48-hour minimum review window** for the RFC, even if no
   reviewers respond. Pre-launch: 48h internal; post-launch: 14 days
   for the open community.
3. **An "impact" section** in the RFC enumerating which existing
   surfaces (CLI, verify library, MCP server, GitHub Action, third-
   party implementers we know of) need to update.
4. **Updated conformance suite** committed in the same PR — the new
   major's tests pass, and a `legacy/` subdirectory preserves the
   prior major's tests so consumers verifying older bundles still
   have the suite.

### Deprecation window

When a new major version ships:

- The prior major version stays in `docs/trust-contract-v<prior>.md`
  marked **Status: Deprecated** with an explicit end-of-life date.
- **Minimum deprecation window: 12 months** post-launch, **3 months**
  pre-launch (Q3 2026 launch makes pre-launch policy permissive
  because we have no external adopters yet).
- The PrimitiveHub HTTP Trust API MUST continue producing v<prior>
  bundles via content negotiation (`Accept:
  application/vnd.primitivehub.bundle+json;version=<prior>`) for the
  full window.
- The `@primitivehub/verify` library MUST continue accepting v<prior>
  bundles for the full window.
- After the window: the old version's `.md` file stays (history is
  load-bearing) but is moved to `docs/archived-specs/` and the HTTP
  API drops the negotiation path.

### Forward-compatibility expectation

v0.1 consumers SHOULD accept future v0.x bundles that don't use
features the consumer doesn't recognize (additive evolution). This
means:

- Strict schema validation is REQUIRED at the top-level keys (5
  exactly) and at the field-type level.
- Strict schema validation is OPTIONAL inside `attestation.predicate`
  (the predicate schema is governed by `docs/spec.md` § 5.3, which
  has its own version field).
- New optional top-level keys in a v0.x successor MUST NOT cause
  v0.1 consumers to refuse bundles — but since v0.1's schema is
  `additionalProperties: false`, v0.1 consumers WILL refuse them.
  This is an acknowledged tension and a candidate to relax in v0.2.

### What is "conformance" anyway?

Per ADR-0021 (planned, Week 2), a Trust Contract implementation may
claim **"PrimitiveHub Trust Contract v0.1 conformant"** if and only if
it passes every test in the conformance suite at
`docs/trust-contract/conformance/` for v0.1. We will publicly correct
claims that don't.

The conformance suite is the **executable** definition of the spec.
When the spec text and the tests disagree, the tests win and the spec
text gets a clarifying PR. ADR-0020 designates `@primitivehub/verify`
as the reference implementation; reference-implementation behavior is
what defines the tests.

## Alternatives considered

1. **Keep the Trust Bundle as a schema in `docs/spec.md` § 10 — no
   standalone spec, no formal versioning.** Rejected. This is what
   ADR-0013 shipped; it's adequate for an internal contract but not
   for a standard third parties build against. Standards-first
   positioning requires versioned standalone specs.

2. **CalVer (calendar versioning) instead of SemVer.** Rejected.
   SemVer's "what counts as breaking" definition is much sharper for
   a wire contract. CalVer's "version is the date" is fine for
   release artifacts but doesn't communicate compatibility intent.

3. **No formal RFC process — just commit and bump.** Rejected. The
   moment we have one external implementer (the
   `@primitivehub/verify` library itself, post Phase 5.5.4), changes
   that surprise it break the contract. RFC discipline forces us to
   think before we ship.

4. **Continuous deprecation — no fixed window, just "we'll let you
   know."** Rejected. Enterprise adopters need to know when to plan
   migrations. Twelve months is the smallest window that fits in an
   annual planning cycle.

5. **Allow `additionalProperties: true` at the bundle's top level
   from v0.1 onward, to enable forward-compatible additive evolution
   without v0.1 consumers refusing v0.2+ bundles.** Considered.
   Rejected for v0.1 because pre-launch we don't have external
   consumers to break, and tighter schemas catch bugs earlier. Will
   relax in v0.2 once we have launch-window external implementers
   whose forward-compat matters more than our internal lint strength.

## Consequences

### Positive
- **External implementers can plan.** A v0.1 implementer knows the
  contract is stable for the lifetime of v0.1, and that the prior
  version stays available for ≥12 months after a new major ships.
- **The conformance suite is load-bearing.** It's not optional QA;
  it's the executable contract. This forces the suite to be
  comprehensive.
- **RFC discipline forces us to think before we ship spec changes.**
  Reduces the "ship a typo, declare it a feature" failure mode.
- **The reference-implementation rule (ADR-0020) resolves disputes.**
  When spec text and consumer behavior disagree, we have a clear
  arbiter.

### Negative
- **More overhead per spec change.** The RFC + 48h review window + 
  updated conformance suite adds friction. Acceptable cost — we
  expect << 1 breaking change per year.
- **`additionalProperties: false` at the top level limits v0.x
  forward-compat.** v0.2 will need to either relax this OR commit to
  "all evolution within v0.x is via the predicate, not new top-level
  keys." Pick at v0.2 design time.
- **Pre-launch RFC window is shorter than post-launch.** This is the
  right tradeoff (no external dependencies yet) but creates a
  subtle cliff at launch where the rules tighten.

### Neutral
- **The version string MUST appear in the bundle as `bundleVersion`.**
  This was already the case in ADR-0013; this ADR locks it as
  inviolable.
- **A bundle MAY appear in multiple versions simultaneously.** A
  primitive signed under v0.1 stays a v0.1 bundle forever; if we want
  to upgrade an existing primitive's bundle to v0.2 we re-sign it
  (which is a NEW Rekor entry, by Sigstore design — fresh provenance).

## Implementation

- `docs/trust-contract-v0.1.md` — the promoted standalone spec
  (this PR, 5.5.A)
- `docs/spec.md` § 10 — updated to point at the standalone spec as
  the canonical source; § 10 retained as a brief overview
- `docs/decisions/0013-trust-bundle-format.md` — left as-is for
  history; this ADR (0015) is the live versioning policy
- Conformance suite under `docs/trust-contract/conformance/` — ships
  in Phase 5.5 PR 5.5.B (Week 2)
- ADRs 0020 + 0021 — ship Weeks 4 + 2 per `docs/execution-plan.md`

## References

- `docs/trust-contract-v0.1.md` — the spec this ADR governs
- `docs/execution-plan.md` Gate G-A — Standards Lock acceptance criteria
- ADR-0013 — the original Trust Bundle format decision (Phase 5.5.1)
- [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838) — media type
  registration procedures (relevant when we pursue IANA registration
  in a future revision)
