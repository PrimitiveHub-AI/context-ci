# ADR-0016: Context CI Top 10 v0.1 — taxonomy as versioned public spec

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0012 (Detector Protocol), ADR-0015 (Trust Contract
versioning), `docs/context-ci-top-10-v0.1.md`,
`docs/execution-plan.md` Gate G-A

## Context

The ten supply-chain attack categories Context CI detects were
documented in `docs/threat-model.md` as prose. The execution plan's
Standards Lock work (Weeks 1–2) promotes them to a standalone
versioned public spec — **`docs/context-ci-top-10-v0.1.md`** — with
stable identifiers (`CCI-001` through `CCI-010`) the rest of the
ecosystem can reference.

The taxonomy is meant to play, for AI context, the role OWASP Top 10
plays for web security: a stable, widely-cited, third-party-
referenceable taxonomy with prevention guidance per category.

This ADR locks the rules that govern future changes to the taxonomy.

## Decision

### Identifier semantics

- A CCI ID once assigned is **NEVER** reused, renumbered, or
  repurposed.
- Deprecated categories stay in the taxonomy marked `Status:
  Deprecated <YYYY>`.
- New categories get the next sequential CCI-NNN. CCI-011 is the
  next available.
- The mapping `CCI-NNN ↔ Verdict.threat_category` (legacy `T<n>`
  codes the implementation uses) is locked by the table in
  `context-ci-top-10-v0.1.md` § 5.

### Versioning rules

The Top 10 spec follows the same SemVer + RFC + deprecation
discipline as the Trust Contract (ADR-0015):

- **Major version** (`1.x`, `2.x`, …) — changes that alter a
  category's meaning or its severity-range envelope. Removing or
  renumbering an existing CCI ID would also be a major bump, but
  per the identifier rule above this can never happen.
- **Minor version** (`0.1`, `0.2`, …) — adding a new CCI-NNN
  category, refining detection guidance, adding examples, promoting
  sub-categories (CCI-001.a, CCI-001.b, …).
- **Patch version** — editorial corrections only.

The RFC process from ADR-0015 applies identically: major bumps
require a public RFC, 48h pre-launch / 14-day post-launch review
window, an "impact" section, and updated companion artifacts.

### Additive migration path for the codebase

The reference implementation uses legacy `T<n>` codes in
`Verdict.threat_category` and `Detector.threat_category`. The
additive migration (chosen over rename in PR 5.5.C per the user's
direction) is:

1. Add a `cci_id` field to `Verdict` (Optional, str format
   `CCI-NNN`).
2. Add a `cci_id` class attribute on each detector class.
3. Existing attestations in the database keep `threat_category=T1`;
   new attestations populate BOTH fields.
4. `Verdict.as_predicate_dict()` emits both keys when present.
5. Consumers SHOULD prefer `cci_id`; the legacy field stays for
   v0.1.

The rename to a CCI-only world is deferred indefinitely. The
deprecation window starts only when a Phase 12 standards-body
submission requires it.

### Trust Contract integration

The Trust Contract v0.1's attestation predicate's `validation[]`
block consumes these IDs (per `trust-contract-v0.1.md` § 5.4 +
`context-ci-top-10-v0.1.md` § 6). A conformant consumer SHOULD
prefer `cci_id` when both are present.

## Alternatives considered

1. **Skip the public spec — keep the taxonomy in
   `docs/threat-model.md` prose form only.** Rejected. ADR-0015
   established the standards-first discipline: load-bearing
   third-party-referenceable things become versioned public specs.
   The threat model is the prose source; the Top 10 v0.1 is its
   normative form.

2. **Use the legacy `T<n>` codes as the public identifiers.**
   Rejected. `T1` looks like a placeholder; `CCI-001` looks like a
   standard. The OWASP-style naming convention is what makes
   third-party-cited taxonomies durable. Bonus: namespaced IDs
   prevent collision with other "Top 10" frameworks that might use
   `T<n>` codes for unrelated things.

3. **Combine the Top 10 spec with the Trust Contract spec into one
   document.** Rejected. Different cadences — the wire contract
   changes rarely; the taxonomy will grow as new threat categories
   are added (CCI-011, CCI-012, …). Separate specs let each evolve
   independently.

4. **Replace `T<n>` codes in the codebase with `CCI-NNN`** (the
   alternative to the additive path above). Rejected for v0.1
   because: existing attestations in the database carry `T1`; a
   rename requires a backfill migration AND breaks the
   conformance suite's golden bundles. Additive is the lower-risk
   choice. The conformance suite's bundles in PR 5.5.B use
   `threat_category=T1`; v0.2 of the suite will add bundles that
   exercise `cci_id` once detector classes carry it.

5. **Promote sub-categories to first-class IDs in v0.1.** Rejected.
   The pattern families inside CCI-001 (override, role-hijack,
   etc.) are detector-internal taxonomy today. Promoting them to
   `CCI-001.a` / `CCI-001.b` / etc. is a v0.2 candidate — useful
   for per-family policy but premature before we have one external
   consumer asking.

## Consequences

### Positive
- **External implementers can cite a stable ID.** Third-party tools,
  papers, blog posts can reference `CCI-001` and link to the spec.
- **The OWASP-style taxonomy is positioned to be cited in the arXiv
  paper.** Standards-first positioning.
- **Detector classes get a stable identifier independent of internal
  naming.** Renaming `T1PromptInjectionDetector` is allowed; the
  `cci_id="CCI-001"` claim survives.
- **Adds a category = one PR.** New `cci_id` reservation in the
  spec; new detector implementing it; updated mapping table; minor
  spec bump.

### Negative
- **Two parallel identifier schemes for the foreseeable future.**
  `T<n>` (legacy, in DB) and `CCI-NNN` (canonical, in spec).
  Documentation has to explain the relationship every time. The
  mapping table in the spec is the source of truth — keeps it from
  drifting.
- **Predicate payload grows by ~12 bytes per verdict** (the
  `"cci_id": "CCI-001"` key + value). Negligible at primitive scale;
  noted for completeness.
- **Detector classes carry a class attribute that duplicates
  information.** `name="t1.prompt_injection"`,
  `threat_category="T1"`, `cci_id="CCI-001"` — three pieces of
  identity. Each serves a different consumer (logging, attestation
  predicate legacy field, spec reference).

### Neutral
- **`/top-10` web route lands in this PR** (still behind noindex;
  flipped to indexable at launch per execution plan Gate G-G).
- **The threat model document stays** — § 1–§ 2 (scope, adversary
  model) and § 4–§ 8 (trust assumptions, references) remain
  load-bearing. § 3 (the categories themselves) is now a brief
  overview pointing at the standalone spec.

## Implementation

- `docs/context-ci-top-10-v0.1.md` — the promoted standalone spec
- `docs/threat-model.md` § 3 — updated to point at the standalone
  spec as canonical; § 3 retained as brief overview
- `apps/api/scanners/types.py` — `Verdict.cci_id` field added
  (optional, defaults to empty string for back-compat)
- `apps/api/scanners/protocol.py` — `Detector` Protocol gains
  `cci_id: str` attribute
- `apps/api/scanners/t1_prompt_injection.py` — `cci_id = "CCI-001"`
- `apps/api/scanners/t2_unicode_steganography.py` — `cci_id = "CCI-002"`
- `apps/api/scanners/t5_unsafe_shell_install.py` — `cci_id = "CCI-005"`
- `apps/api/tests/test_scanners_t1.py` /`test_scanners_t2.py` /
  `test_scanners_t5.py` — test the new `cci_id` field on the
  detector + on the produced Verdict
- `apps/web/app/top-10/page.tsx` — placeholder page rendering the
  spec content. Behind the existing project-wide noindex defenses
  (robots.txt + meta + X-Robots-Tag); flipped to indexable at
  launch per execution-plan Gate G-G.

## What ships in subsequent PRs

- **PR 5.5.D (still Week 1–2)** — Forge rename (Workbench v2 →
  Primitive Forge) + ADR-0017. Closes the last Gate G-A box.
- **Phase 5 PR 5.6** — implement detectors for CCI-003, CCI-004,
  CCI-006, CCI-007, CCI-008, CCI-009, CCI-010 (the 7 currently
  reserved IDs).

## References

- `docs/context-ci-top-10-v0.1.md` — the spec this ADR governs
- `docs/threat-model.md` — prose source
- ADR-0015 — Trust Contract v0.1 versioning (same SemVer + RFC
  discipline)
- ADR-0012 — Detector Protocol
- `docs/execution-plan.md` Gate G-A — Standards Lock acceptance
- [OWASP Top 10](https://owasp.org/Top10/) — taxonomy methodology
  reference
