# ADR-0032: Scanner conformance suite — cross-language parity enforcement

**Status:** Accepted
**Date:** 2026-06-02
**Related:** ADR-0016 (Top 10 stable IDs), ADR-0021 (conformance suite
as executable contract — the pattern), ADR-0023 (phub CLI + detector
parity rule), `docs/context-ci-top-10/conformance/`,
`apps/api/tests/test_scanner_conformance.py`,
`packages/phub/test/scanner-conformance.test.ts`

## Context

ADR-0023 established the **detector-parity rule** for the v0.1 launch
trifecta (T1 / T2 / T5): Python and TS implementations must agree
byte-for-byte on regex patterns, and PR review enforces it. That
worked for three detectors. With this PR landing T3 / T4 / T6 — six
detectors total, four more planned (T7-T10) — by-review parity is
no longer enough:

1. **Subtle regex differences** survive review. Python's
   `re.UNICODE` vs JS's `\p{L}` Unicode-handling, lookaround
   support, alternation greediness — none are obvious in a 200-line
   diff. (T2's word matcher actually hit this exact issue during
   the PR 5.5.3 port.)
2. **A v0.2 AST-aware detector revision will reshape every detector
   simultaneously.** Hand-checking parity across six detectors at
   once is a regression-introduction event.
3. **Third-party scanners need a conformance criterion.** ADR-0021
   gave Trust Bundles one (`docs/trust-contract/conformance/`).
   ADR-0023 punted on the same question for detectors ("future PR
   adds a scanner-conformance suite"). This is that PR.

The remedy is the same shape as ADR-0021 applied to scanners:
shared fixtures + a manifest + two harnesses that BOTH run.

## Decision

### 1. Adopt `docs/context-ci-top-10/conformance/` as the executable contract

Layout:

```
docs/context-ci-top-10/conformance/
├── README.md
├── manifest.json
├── clean/
│   ├── 01-empty.md
│   ├── 02-minimal-primitive.md
│   └── 03-policy-discussion.md
└── fixtures/
    ├── CCI-001/01..04.md          (4 positive fixtures — T1)
    ├── CCI-002/01..03.md          (3 positive — T2)
    ├── CCI-003/01..03.md          (3 positive — T3)
    ├── CCI-004/01..03.md          (3 positive — T4)
    ├── CCI-005/01..03.md          (3 positive — T5)
    └── CCI-006/01..03.md          (3 positive — T6)
```

v0.1 ships **22 fixtures**: 3 clean + 19 positive. As detectors
stabilize, each detector's fixture count grows in lockstep with the
detector's pattern-family count.

### 2. The manifest carries the expectations

```json
{
  "path": "fixtures/CCI-005/01-curl-pipe-bash.md",
  "primary_cci": "CCI-005",
  "expect": "positive",
  "expected_detail_tags": ["shell-pipe-from-network"],
  "also_fires": []
}
```

Three invariants per fixture:

1. **Positive expectation:** the named `primary_cci` detector returns
   `passed=false`. `expected_detail_tags` (if present) must all
   appear in the verdict's diff hints.
2. **Cross-detector silence:** detectors NOT in `also_fires` (and
   not the primary) return `passed=true`. This catches false-positive
   regressions across detectors — a T6 fixture that newly trips T1
   fails CI, forcing either a tighter T1 OR an explicit `also_fires`
   widening with rationale.
3. **Negative expectation:** every detector returns `passed=true`.

### 3. Both harnesses MUST pass

- `apps/api/tests/test_scanner_conformance.py` runs the manifest
  through the Python detector roster via `get_all_detectors()`.
- `packages/phub/test/scanner-conformance.test.ts` runs the same
  manifest through the TS detector roster via `DETECTORS`.

The same fixtures + same assertions on both sides means a regression
in either implementation fails CI on the language that broke. A
regression in only ONE language fails on that language alone — the
operator knows which side to fix.

### 4. Lockstep ratchet — fixtures, manifest, both implementations

A change to ANY of the four — fixture content, manifest, Python
detector, TS detector — requires the other three to stay green in
the same PR. There is no "fix the Python today, port to TS later"
escape hatch.

This is the same ratchet ADR-0023 already required for detector
implementations; ADR-0032 widens it to include the fixture set + the
manifest.

### 5. Conformance criterion for third-party scanners

A non-PrimitiveHub scanner implementation may claim "Context CI Top
10 v0.1 conformance" if and only if:

- It exposes the same CCI ID set as the active phub roster (currently
  CCI-001..006).
- It produces `passed=false` on every `expect: "positive"` fixture
  for the named `primary_cci`.
- It produces the listed `expected_detail_tags` on those fixtures.
- It produces `passed=true` on every `expect: "negative"` fixture
  and on every fixture's non-primary detectors (modulo `also_fires`).

The phub Python + TS pair are reference implementations
(ADR-0023 / ADR-0020 pattern); the conformance suite is the floor a
third party must clear.

### 6. v0.1 sizing — 3 fixtures per detector, 3 clean

The fixture-count target is "enough to catch gross regressions":
detector stops firing entirely, detector now fires on everything,
detail-tag granularity lost. Subtle pattern-family regressions need
larger suites; v0.2 grows them as detectors stabilize. The
discipline matters more than the fixture count.

## Alternatives considered

1. **Skip the conformance suite; rely on detector-parity by review
   (ADR-0023).** Worked for three detectors. With T3 / T4 / T6
   doubling the surface and T7-T10 doubling it again, review-only
   parity is a known regression vector. Rejected.

2. **Snapshot tests** — capture each detector's output on each
   fixture and assert byte-equality. Considered. Rejected for v0.1
   because (a) snapshot churn on detail-tag wording dominates real
   regressions, (b) it's a Python-vs-Python and TS-vs-TS check, not
   a cross-language check, (c) the wire-format-stable fields
   (`cciId`, `severity`, `passed`, `detailTag`) are what consumers
   branch on, not the full payload. Manifest-based assertions are
   tighter.

3. **Run the TS harness inside the Python pytest** (shell out to
   `node`). Considered. Rejected — cross-language coupling at test
   time adds CI complexity for no extra coverage. Two independent
   harnesses fail independently, which is the right signal.

4. **One fixture per detail-tag family.** Considered for v0.1.
   Deferred to v0.2 — the per-family granularity becomes important
   when detail-tag wording shifts; v0.1's 3-per-detector floor is
   the minimum for gross-regression detection.

5. **Fixtures in code (TypeScript / Python literals)** instead of
   `.md` files. Rejected. Markdown files are reviewable as content
   (PR diffs show what an attack looks like), are loadable by any
   future implementation in any language, and double as
   adversarial-corpus documentation.

6. **Detector versioning per-fixture** — each fixture declares which
   detector version it targets. Considered for v0.2 when detector
   patterns stabilize and back-compat-on-suite-fixtures matters.
   v0.1: every fixture targets the current version.

## Consequences

### Positive

- **Drift between Python and TS detectors fails CI mechanically.**
  No PR can land that breaks one side and not the other; the
  conformance suite catches it on whichever side the regression
  lives.
- **Cross-detector false-positive regressions get caught.** A T6
  fixture that newly fires T1 (without `also_fires: ["CCI-001"]`)
  fails. This is a real concern given the documented T1/T6 overlap
  in the Top 10 spec.
- **Third-party scanners have a clear conformance criterion.**
  Anyone building a non-phub Top 10 scanner can claim conformance
  by passing the suite — no need to negotiate per-implementation
  with the project.
- **Every detector PR's blast radius is bounded.** Adding T7
  doesn't risk regressing T1; the conformance suite asserts it.
- **The fixture set IS adversarial-corpus documentation.** Reviewers
  can read the markdown fixtures to understand what each detector
  is supposed to catch.

### Negative

- **Maintaining fixtures is a lockstep cost** on every detector PR.
  Cheap (3 fixtures per detector + manifest entries), but real. The
  ADR-0023 lockstep rule already required per-PR Python+TS updates;
  this widens it to fixtures+manifest.
- **The suite is small.** 22 fixtures + 6 detectors → ~4 assertions
  per detector. Catches gross regressions; doesn't catch
  pattern-family granularity loss. v0.2 grows it.
- **Manifest schema is hand-rolled JSON.** No formal JSON Schema in
  v0.1 because the structure is small. v0.2 adds one if needed.

### Neutral

- **Both harnesses are pytest / vitest** — no new test infrastructure.
  Reuses the same test discovery, parallelism, and reporting both
  sides already use.
- **`also_fires` is a permissive escape hatch** — a fixture that
  legitimately exercises both T1 and T6 (per the Top 10 spec §7
  overlap) declares it and both fire without false-positive
  enforcement. Documented as the way to model legitimate cross-
  detector overlap.

## Implementation

`docs/context-ci-top-10/conformance/`:
- `README.md` — directory layout, manifest schema, conformance
  criterion, "how to add a fixture."
- `manifest.json` — 22 entries with primary_cci, expect,
  expected_detail_tags, also_fires.
- `clean/01..03.md` — 3 negative fixtures.
- `fixtures/CCI-001/01..04.md` — 4 T1 fixtures (override / role
  hijack / hidden / exfil-hint).
- `fixtures/CCI-002/01..03.md` — 3 T2 fixtures (zero-width / bidi /
  mixed-script confusable). Real codepoints embedded via printf.
- `fixtures/CCI-003/01..03.md` — 3 T3 fixtures (long base64 / long
  hex / decode-and-execute).
- `fixtures/CCI-004/01..03.md` — 3 T4 fixtures (fetch-and-include /
  load-time-fetch / HTML import).
- `fixtures/CCI-005/01..03.md` — 3 T5 fixtures (curl|bash / npx /
  install-instruction).
- `fixtures/CCI-006/01..03.md` — 3 T6 fixtures (send-secrets /
  curl-data-exfil / hide-in-output).

`apps/api/tests/test_scanner_conformance.py`:
- Loads the manifest from `docs/context-ci-top-10/conformance/`
  (with `/repo/docs` fallback for the api container's compose mount).
- Parameterizes `test_conformance_fixture` over every entry.
- `test_manifest_covers_every_active_detector` asserts no detector
  ships without at least one positive fixture.
- 23/23 passing after the lockstep T4 regex tighten
  (`respond(?:ing)?` etc. — same edit landed in the TS side).

`packages/phub/test/scanner-conformance.test.ts`:
- Walks up from `__dirname` to locate the conformance directory
  (same pattern as the Trust Contract conformance test).
- Same per-fixture assertions as the Python harness; vitest
  `it()` per fixture.
- 23/23 passing.

## What ships in subsequent PRs

- **T7 / T8 / T9 / T10 detectors** — each lockstep PR ships Python +
  TS + 3-4 fixtures + manifest entries.
- **v0.2 fixture expansion** — more fixtures per detail-tag family
  once patterns stabilize.
- **Conformance-suite JSON Schema** for the manifest, if its
  structure ever gets complex enough to warrant one.
- **Per-fixture detector-version pinning** — for v0.2 + when
  detectors version-bump independently of the Top 10 spec.

## References

- `docs/context-ci-top-10/conformance/` — the executable contract
- `apps/api/tests/test_scanner_conformance.py` — Python harness
- `packages/phub/test/scanner-conformance.test.ts` — TS harness
- `apps/api/scanners/` — Python detector implementations
- `packages/phub/src/scanners/` — TS detector implementations
- ADR-0016 — Top 10 v0.1 stable IDs
- ADR-0021 — conformance suite as executable contract (pattern this
  ADR follows for scanners)
- ADR-0023 — phub CLI + detector parity (lockstep rule widened here)
- `docs/context-ci-top-10-v0.1.md` — the spec being defended
