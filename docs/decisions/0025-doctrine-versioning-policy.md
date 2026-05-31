# ADR-0025: Doctrine versioning policy

**Status:** Accepted
**Date:** 2026-05-31
**Supersedes:** none
**Related:** ADR-0013 (Trust Bundle format), planned ADR-0015 (Trust Contract v0.1 versioning), planned ADR-0017 (Forge rename)

## Context

`docs/doctrine.md` (introduced alongside this ADR) codifies the
project's mission, named category, named enemy, ICP, Operating Laws,
decision algorithm, anti-positioning, and the "Layers of the Trust
Runtime" vocabulary. `docs/brand-voice.md` codifies killer phrases and
banned vocabulary. `docs/okrs/*.md` codifies per-quarter objectives.

Without versioning discipline these statements drift. Three different
contributors (human or AI) will rewrite them subtly differently within
a quarter, and the operational law evaporates.

The Trust Contract (ADR-0013) is treated as a versioned spec with
breaking-change rules. Doctrine deserves the same discipline. It is
more important than the wire format, not less — the wire format defines
what we ship; doctrine defines why we exist and what we refuse to do.

Constraints:
- Pre-launch posture is absolute. Doctrine is internal until launch,
  but the discipline must be in place to be promoted to public RFC at
  launch without restructuring.
- Process must be light enough that small clarifying edits don't
  require ceremony.
- AI contributors auto-load CLAUDE.md and must inherit the rules from
  there without rederiving them.

## Decision

Apply Trust-Contract-style versioning to three documents:
`docs/doctrine.md`, `docs/brand-voice.md`, `docs/okrs/<quarter>.md`.

### Header front-matter (required)

Each file carries:

```
Version: vX.Y
Last reviewed: YYYY-MM-DD
Owner: mhm
Change policy: See ADR-0025.
```

### Breaking vs non-breaking changes

A change is **breaking** (requires `doctrine-rfc` issue with ≥48h
review window + at least one named human reviewer ack) if it:

- Adds, removes, or rewords an Operating Law
- Changes the named category statement
- Changes the named enemy
- Changes the ICP
- Changes the mission lines (operational or philosophical)
- Changes the decision algorithm
- Removes a "We are not …" entry
- Renames any "Layer of the Trust Runtime"
- Removes a banned-vocabulary entry from `brand-voice.md`
- Mid-quarter KR changes after a quarter has started

A change is **non-breaking** (lands in a normal PR, no RFC required)
if it:

- Tightens wording without changing meaning
- Adds examples or case studies
- Adds cross-references to other docs
- Adds new "We are not …" entries (additions are not removals)
- Adds killer-phrase entries to `brand-voice.md`
- Adds banned-vocabulary entries to `brand-voice.md`
- Fixes typos or broken links

### Version bumps

- **v0.X → v0.(X+1)**: non-breaking accumulation passed a useful
  threshold (every ~quarter).
- **v0.X → vY.0** (where Y ≥ 1): breaking change. RFC required.
- **last-reviewed** date moves on every merge that touches the file.

### Pre-launch vs post-launch

- Pre-launch: RFC issues stay private. Doctrine evolves quietly.
- Post-launch: RFC issues are public. Breaking doctrine changes are
  socialized externally. Versions become citable from the paper and
  from third-party integrations.

## Consequences

**Positive:**
- Doctrine stops drifting. The team has stable operational language to
  reference in PRs, design docs, and ADRs.
- Future AI contributors cannot silently rewrite the mission to match
  their own training defaults.
- External cite-ability post-launch — researchers can cite "PrimitiveHub
  Doctrine v0.1" the way they cite specs.
- Forces the question "is this actually a breaking change?" — useful
  even when the answer is no.

**Negative:**
- Marginally more process around language changes. Acceptable cost.
- One more place to keep in sync. Mitigated by CLAUDE.md auto-loading
  these files into every session.

**Migration:**
- `docs/doctrine.md` is born at v0.1 on the date of this ADR.
- `docs/brand-voice.md` is born at v0.1 on the same date.
- `docs/okrs/2026-Q3.md` is born without a `v` version (OKRs are
  per-quarter; the file itself is the contract for that quarter).

## Alternatives considered

**A. Treat doctrine as informal — wiki-style edits.** Rejected: this
is exactly how operational language drifts in growing teams. The point
of the doctrine is its stability.

**B. Treat doctrine as a public RFC from day one (semver, public
review).** Rejected for v0.1: the project is pre-launch under noindex.
Public RFC process is appropriate post-launch, and this ADR explicitly
allows promotion to public RFC at launch without restructuring.

**C. Fold doctrine into `principles.md`.** Rejected: `principles.md`
is the philosophical layer ("what we believe"); doctrine is the
operational layer ("what we enforce"). Different surfaces, different
audiences, different update cadences. They complement each other.
