# ADR-0017: Workbench v2 → Primitive Forge rename

**Status:** Accepted
**Date:** 2026-05-31
**Related:** `DESIGN.md` § 0 (product-name table),
`docs/execution-plan.md` Gate G-A

## Context

The authoring surface has been called "Workbench" since the v0 of the
UI shipped in Phase 1. The execution plan's Standards Lock work
(Week 1–2, Gate G-A) elevates this surface from a placeholder
markdown editor to **the** demo-defining artifact — the place
developers write a primitive, watch the Context CI detectors run live,
watch the attestation get signed, publish to the registry.

Names matter at this scale. "Workbench" is correct but generic — it
could describe any IDE-adjacent surface in any product. The brand
needs a noun that pattern-matches to **forge** (the act of making
something through deliberate craft) and binds specifically to AI
primitives.

The choice between "Workbench" and a Forge-flavored rebrand is a one-
way door once we ship public surfaces. Better to lock the name in
Week 1 — before code accrues around the old one, before the launch
copy is written, before users build muscle memory for the wrong
identifier.

## Decision

The authoring surface is renamed:

- **Workbench v2** → **Primitive Forge**
- Short form: **Forge** (navbar, conversational copy, CLI prompts)
- Full form: **Primitive Forge** (metadata, first-mention copy,
  page titles)

Effective immediately across code, docs, UI, content primitives, and
commit messages. Old paths redirect via `next.config.mjs` (`/workbench`
→ `/forge`, 302/permanent). The deprecated name list is in
`DESIGN.md` § 0.

### Why "Forge"

- **Pattern-matches to deliberate craft.** Forging is purposeful,
  skilled, irreversible. That's what we want users to feel about
  authoring a primitive — not casual notes, not draft prose, but
  something they're putting their name on.
- **Pairs with the rest of the brand.** Trust Contract. Top 10.
  Explorer. CBOM. Context Firewall. Forge fits the same register:
  industrial, infrastructural, serious.
- **Owns a noun.** Searching "primitive forge" returns no significant
  collisions. The compound is brandable.
- **Implies the output, not just the tool.** A Forge produces a
  forged thing — a Primitive. The name carries the workflow.

### Why short form is "Forge" not "Primitive Forge"

Same pattern as "Snyk" vs "Snyk Code." Users will say *"open it in
Forge"* — three syllables, fast. The full product name lives in
metadata + first-mention copy where the disambiguation matters.

### Brand discipline rules

1. **Forge is the only name** for the authoring surface in code, docs,
   UI strings, commit messages, external copy from 2026-05-31 onward.
2. **Workbench appears only** in: (a) the redirect rule in
   `next.config.mjs`, (b) the deprecation note in DESIGN.md § 0,
   (c) historical commit messages and ADRs (immutable record).
3. **Drift is a defect.** Reviewers reject PRs that reintroduce
   "Workbench" in non-historical contexts.
4. **Drive-by fixes are encouraged.** If you touch a file that still
   says "Workbench," fix it in the same PR. Don't open a one-line
   "fix naming" PR unless DESIGN.md § 0 explicitly authorizes it.

## Alternatives considered

1. **Keep "Workbench v2".** Rejected. Generic. Doesn't compound with
   the rest of the brand vocabulary. The execution plan's elevation
   of this surface to the demo-defining artifact made the rename
   load-bearing.

2. **"Atelier" / "Forge House" / "Studio" / "Lab".** Rejected:
   - Atelier — wrong register; reads as French luxury.
   - Forge House — two-word; not as snappy.
   - Studio — overloaded (every cloud vendor has one).
   - Lab — wrong implication (experimental, not production).

3. **"Composer" / "Authoring Console".** Rejected:
   - Composer — heavy collision with PHP Composer.
   - Authoring Console — generic; same problem as "Workbench."

4. **No short form — always "Primitive Forge".** Rejected. Three
   words for a navbar label is too long; users will abbreviate
   anyway. Better to bless the short form than have it drift to
   "PF" or "the Forge thing."

5. **Defer the rename until post-launch.** Rejected. The execution
   plan's Gate G-A specifically calls for the rename in Week 1
   (before code accrues, before launch copy is written). Once
   public, the rename costs are an order of magnitude higher
   (cache, SEO, muscle memory).

## Consequences

### Positive
- **Forge ships as the launch name.** Public copy + paper + demo
  video all consistent from day one.
- **One word in the navbar.** "Forge" reads cleaner than "Workbench"
  and pairs with the other one-word tabs (Registry, Bundles, Forge,
  Context CI, Paper, Contributors).
- **Compound brand.** Forge + Explorer + Trust Bundle + Top 10
  reads as a coherent suite.
- **Drift-prevention rules are explicit.** Reviewers have a clear
  rejection criterion in PRs that reintroduce the old name.

### Negative
- **One-time rename cost in this PR** (~20 file touches, 5 directory
  moves). Manageable; the wide-touching nature is exactly why
  doing it in Week 1 is right.
- **`/workbench` URLs lose freshness** in the brief window before
  the redirect activates. Pre-launch, no external bookmarks exist
  yet, so the cost is hypothetical.
- **Some content primitives needed copy updates** (lifecycle-timeline,
  cli-roadmap, frontend-design-elite, dashboard-information-design,
  tufte-data-visualization, primitive-cross-reference-index). All
  done in this PR.

### Neutral
- **The lint module's exported type renamed** from `WorkbenchFinding`
  to `ForgeFinding`. The function `lintWorkbenchContent` →
  `lintForgeContent`. No external consumers, so the rename is local.

## Implementation

- `apps/web/app/workbench/` → `apps/web/app/forge/` (git mv preserves
  history)
- `apps/web/components/workbench/` → `apps/web/components/forge/`
- `apps/web/lib/workbench/` → `apps/web/lib/forge/`
- `apps/web/lib/forge/lint.ts` — `WorkbenchFinding` →
  `ForgeFinding`, `lintWorkbenchContent` → `lintForgeContent`,
  docstring + message text refresh
- `apps/web/lib/forge/codemirror-linter.ts` — import + comment update
- `apps/web/app/forge/page.tsx` — imports updated
- `apps/web/app/forge/layout.tsx` — new; carries route-level metadata
  ("Primitive Forge — PrimitiveHub")
- `apps/web/components/navbar.tsx` — link label "Workbench" → "Forge",
  href `/workbench` → `/forge`
- `apps/web/components/landing/cli-roadmap.tsx` — copy refresh
- `apps/web/components/primitives/lifecycle-timeline.tsx` — copy refresh
- `apps/web/content/primitives/{tufte-data-visualization,
  frontend-design-elite, dashboard-information-design,
  primitive-cross-reference-index}.md` — copy refresh
- `apps/web/lib/data/primitives.ts` — copy refresh in a
  `doNotUseWhen` entry
- `apps/web/next.config.mjs` — added `redirects()` for
  `/workbench` + `/workbench/:path*` → `/forge` + `/forge/:path*`
  (permanent)
- `DESIGN.md` § 0 — new "Product names (canonical)" section with
  the full canonical+deprecated table
- `docs/decisions/README.md` — ADR-0017 in the index

## What ships in subsequent PRs

ADR-0017 closes Gate G-A's fourth and final box. Next:

- **Gate G-B starts immediately** — Verifier Kernel
  (`@primitivehub/verify` on npm, Phase 5.5.4 / Weeks 3–4 per
  `docs/execution-plan.md`).
- **Conformance suite growth** to the G-A target of ≥30 + ≥10
  fixtures (currently 12 + 3; rolling work that doesn't block
  Gate G-B start).
- **Forge v2 work** — live Context CI scan, one-click publish via
  Trust Contract — is Phase 5.6 (Weeks 10–13 per execution plan).
  This ADR locks the name; the v2 capability work lands later.

## References

- `DESIGN.md` § 0 — canonical product-name table
- `docs/execution-plan.md` — Gate G-A criteria; this ADR satisfies
  the "Forge rename committed; 'Workbench v2' no longer in code"
  box
- `apps/web/next.config.mjs` — redirect implementation
- ADR-0015 / ADR-0016 / ADR-0021 — the other three Gate G-A
  deliverables; together they close Standards Lock
