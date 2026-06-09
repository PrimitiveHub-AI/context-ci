# Homepage elite bar — the anti-regression contract

> The homepage was simplified 2026-06-09 (8 sections → 5) under the
> "perfect the dark-technical register, subtract aggressively" direction.
> This file is the ruler that keeps it from re-bloating — the same
> discipline ADR-0040 applies to surfaces and we just applied to
> `CLAUDE.md`. Load [`frontend-design-elite`](../apps/web/content/primitives/frontend-design-elite.md)
> before touching `apps/web/components/landing/` or `apps/web/app/page.tsx`.

## The one message

Everything on the homepage serves a single claim:

> **PrimitiveHub verifies agent context *before* your agent reads it. The
> Context Firewall.** (doctrine § Category statement.)

If a section does not *prove* that claim or let the visitor *act* on it,
it does not belong on the homepage.

## Hard limits

- **≤ 5 sections** (excluding nav + footer). Adding a sixth means merging
  or cutting one first.
- **Every measured number appears exactly once.** The canonical home of
  the macro-F1 metric is the **Hero status pill**. Do not restate it in
  another section — deep-link to the scoreboard instead.
- **One idea per viewport.** A section that explains two things is two
  sections fighting; split the idea or cut one.
- **No parallel grid-of-cards sections.** Two sections that are both
  "icon + bold title + grey body, ×N" is the templated-AI tell. Prove
  capability by *showing* the product (the CLI), not listing it.
- **Decoration is one intentional move per viewport, max.** The hero
  carries the brand texture (grid + glow); other sections stay flat.
- **The page target is ≈ one-half its pre-cut length** (~3,800px, not
  ~7,000px). Length is a budget, not a default.

## Current section ledger (post-cut)

1. **Hero** — category + named artifacts + one CTA + the canonical metric pill. One viewport.
2. **Threat → Verified** — the single threat-story moment (4 attack shapes vs 4 controls + the thesis callout). Merged from the old Hero before/after + WhySection.
3. **Trust Runtime** — the 3 pillars (Trust Contract / Top 10 / CBOM). Architecture proof.
4. **The CLI** — the product surface (`phub` commands). Replaces the old FeaturesSection.
5. **CTA + Footer**.

**Cut (do not restore without re-merging):** WhySection (→ §2),
FeaturesSection (the CLI proves capability), ConceptSection (domain
breadth is `/registry`'s job; its stats duplicated the hero metric).

## Before adding anything to the homepage

Run the brainstorming gate ([`discovery-and-design-discipline`](../apps/web/content/primitives/discovery-and-design-discipline.md)):
does this prove the one message, and which *existing* section does it
replace? New homepage sections are a merge decision, not an append.
