---
spec_version: "0.1"
name: frontend-design-elite
version: 0.2.0
type: design
domain: frontend
author: PrimitiveHub Labs (synthesized from anthropics/claude-code frontend-design skill + maintainer taste calibration; v0.2.0 adds Companion primitives section linking to Tufte + Few)
license: CC-BY-4.0
tokens: 3800
token_budget: 5000
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
  - windsurf
use_when:
  - "Making any visual design decision in the PrimitiveHub frontend"
  - "Writing microcopy (labels, empty states, error messages, button text)"
  - "Designing a new section, page, panel, or component"
  - "Reviewing UI changes for the 'elite' bar before merging"
  - "Resolving 'this looks fine but feels off' situations"
do_not_use_when:
  - "Backend work without UI implication"
  - "Marketing landing pages for unrelated products"
  - "Consumer-grade casual apps (PrimitiveHub is infrastructure, not lifestyle)"
attestation: cci-v0.1
description: "Premium product UI restraint for trust-infrastructure brands. Information density without clutter. Microcopy with weight. The 'elite' delta you can't get from generic prompting."
keywords: [ui-design, premium-restraint, microcopy, information-density, trust-ui]
references:
  - "https://linear.app/method/principles"
  - "https://vercel.com/design"
  - "https://stripe.com/blog/design-systems"
---

# Frontend Design Elite

## Purpose

PrimitiveHub is positioned as trust infrastructure — comparable in
register to Sigstore, Linear's roadmap, Vercel's dashboard, Stripe's
payment surfaces. None of those products use casual emoji-heavy or
gradient-soaked design. They earn credibility through *restraint*:
high information density, clear hierarchy, exact typography, deliberate
spacing, and microcopy that respects the reader.

This primitive captures the taste calibration. It is not optional
polish; it is the difference between PrimitiveHub reading as elite
infrastructure versus reading as another AI prompt site. The user's
own original specification used the phrase "elite, technical, premium"
six times.

The most common AI-output failure: producing UI that is technically
correct but emotionally generic. This primitive eliminates that.

## Core Principles

- **Restraint beats expression.** Three deliberate elements feel
  considered; ten elements feel busy. Default to less. Hide the
  scaffolding (no visible borders on every component, no card-shadow
  on everything), let typography and spacing do the work.

- **Density is signal, not stress.** Bloomberg Terminal, Linear's
  command palette, GitHub's PR review screen, Cloudflare's dashboard
  all pack high information into small areas — and feel calm.
  Mechanism: tight type scale (10px–15px range), tabular numbers,
  monospace for identifiers, no decorative weight changes, no
  rounded-2xl giant cards. Look at any of those four products and
  notice how rarely they use display-size text.

- **Emotional hierarchy ≠ visual hierarchy.** Visual hierarchy says
  "this is bigger so it matters more." Emotional hierarchy is what
  the reader *cares about*. Often the most-cared-about item is small
  and quiet (the digest hash, the verdict word). Don't punch up
  importance by adding shadow; punch it up by placing it where the
  eye lands at rest.

- **Microcopy is product.** "Validate" is fine. "Run Context CI"
  signals product surface. "Submit to Registry" is correct; "Submit
  now!" is not. Microcopy in trust infrastructure earns belief one
  short sentence at a time. Bad microcopy is the cheapest credibility
  drain a brand can do to itself.

- **Empty states are the second product.** What does the workbench
  show when there are zero lint findings? What does the registry show
  when filters return nothing? Empty states are the moment the user
  doubts the product. Design them as deliberately as the populated
  states. They should communicate *why* it's empty and *what to do
  next*.

- **Premium = unhurried.** Animations 200–300ms with `ease-out`.
  Hover states subtle. Loading states pleasant, not chaotic. No
  bouncing icons.

- **No fake productivity claims.** "1000x faster," "10x your output,"
  "unlock the future of …" — these are marketing-AI tells. Stripe
  doesn't talk like that. Linear doesn't. Sigstore doesn't.
  PrimitiveHub doesn't.

## Decision Rules

- **IF you want to make something feel premium THEN** remove rather
  than add. Remove a border, remove a shadow, remove a color, remove
  a word. Then check: does the meaning survive? If yes, ship the
  reduced version.

- **IF microcopy describes the product surface THEN** match the
  register of the most-credible adjacent product. "Run validation"
  not "Check it out." "Attest & publish" not "Make it official."
  "Public uploads enter review" not "Submit your awesome content."

- **IF a number is presented THEN** it must be either reproducible
  (real measurement) or visibly labeled as demo (`<DemoDataBadge>`).
  Never present synthetic numbers as fact. (See
  [[feedback-no-fake-numbers]] in memory.)

- **IF a section uses an eyebrow label THEN** make it monospace,
  10px, uppercase, letter-spaced (`text-[10px] font-mono uppercase
  tracking-[0.2em]`). This is the codebase convention. Consistency
  reinforces register.

- **IF designing an empty state THEN** include three elements: an
  icon (size-5, muted), a one-line title, a one-line action or
  reason. Skip illustrations. (Bloomberg Terminal has no
  illustrations.)

- **IF designing a loading state THEN** prefer skeleton over spinner
  for content area. Spinners are fine for buttons and small actions.
  Never block the entire screen.

- **IF a CTA is needed THEN** primary action gets the primary color,
  secondary action gets outline, tertiary gets ghost. Three is the
  max action count in a single decision area.

- **IF visual rhythm feels off THEN** the spacing is wrong. Run
  through the 4px scale and align everything to it. Vertical rhythm
  in particular benefits from a consistent line-height ratio
  (1.5–1.75 for prose, 1.4 for compact tabular UI).

## Anti-Patterns

- **Gradient-everywhere syndrome.** A single accent gradient (we have
  one on `glow-text-cyan`) is fine. Gradients on every card, every
  button, every CTA = casual SaaS.
- **Cartoon icons or robot mascots.** Trust infrastructure never has
  these. Lucide icons at small sizes (size-3 to size-5) are correct.
- **Sentence-case button labels with exclamation marks.** "Get
  Started!" is wrong. "Get started" is correct.
- **Marketing buzzwords.** "Empower," "unleash," "revolutionize,"
  "supercharge," "unlock the power of …" all read as low-credibility.
- **Mocking up benchmarks as fact.** See
  [[feedback-no-fake-numbers]]. Every percent claim needs either a
  measurement or a DemoDataBadge.
- **Inconsistent type scale.** If headings use 24/20/16, don't drop
  to 21 mid-page. Stick to the scale.
- **Decorative scrollbars, ornamental icons.** Anything ornamental
  reads as filler. If the icon doesn't help comprehension, remove it.

## Review Checklist

- [ ] Could I remove a border, color, shadow, or word without losing
      meaning? If yes, remove it.
- [ ] Every number on screen is either real or labeled as demo.
- [ ] Microcopy matches the register (Stripe/Linear/Sigstore tier),
      not marketing copy.
- [ ] All section eyebrows follow the 10px-mono-uppercase-tracked
      convention.
- [ ] Empty states have icon + title + action/reason. No
      illustrations.
- [ ] Loading state choice: skeleton for content, spinner for
      action.
- [ ] No more than three actions in a single decision area.
- [ ] Animations are 200–300ms ease-out. No bounce. No spring.
- [ ] No emoji in product UI unless requested explicitly.
- [ ] No marketing buzzwords.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Treat the visual aesthetic of the existing PrimitiveHub frontend
   as authoritative. New work must feel native — same tightness,
   same restraint.
2. Before adding a visual element, ask whether it carries
   information. If not, omit.
3. Default to existing tokens and spacing scale; never introduce a
   new gradient, color, or radius without confirming a need.
4. Write microcopy that reads as professional infrastructure. Read
   it back aloud. If it sounds like an ad, rewrite.
5. Surface a question to the user before adding anything decorative
   (illustrations, stickers, mascots, custom icon sets).
6. For every percent claim, verify the source. If synthetic, wrap
   in `<DemoDataBadge>`.

## Expected Output Format

When proposing a UI change, format the proposal as:

```
WHAT: <one-sentence description>
WHY: <one-sentence rationale tied to a Core Principle above>
WHERE: <file + section>
COPY: <exact text being added/changed, if any>
TOKENS: <theme variables consumed; if any new, name them>
```

This format keeps the conversation grounded in the principles rather
than producing untraceable changes.

## Examples

PrimitiveHub's existing **`components/primitives/demo-data-badge.tsx`**
is an example of restraint applied: information element (the badge),
single tone (amber), no shadow, no extra weight, monospace 9px,
explanatory tooltip. The same component could have been a popup with
illustration and a "Learn more" button. The restrained version reads
as serious.

The **`components/landing/why-section.tsx`** added in PR #6 uses two
muted accent colors (destructive/success), tight 2-column comparison,
and a single quote callout. That's the elite shape.

The **`components/landing/cli-roadmap.tsx`** mimics terminal output
with no decoration — and reads as believable product surface.

## Companion primitives

This primitive governs taste. Two sibling primitives govern the
**quantitative truth** the taste sits on top of — load them together
whenever the surface contains data, charts, or scores.

| When you're touching… | Load alongside this primitive |
|---|---|
| A chart, sparkline, score badge, threat-model grid, attestation timeline | [`tufte-data-visualization`](./tufte-data-visualization.md) — data-ink ratio, small multiples, eliminate chartjunk |
| A multi-panel dashboard surface (registry, validation, org overview) | [`dashboard-information-design`](./dashboard-information-design.md) — Stephen Few's dashboard doctrine: dense, scannable, comparison-first |
| Any interactive control, focus order, ARIA semantics | [`accessibility-wcag22`](./accessibility-wcag22.md) — WCAG 2.2 AA + ARIA APG patterns; bakes in what restraint alone won't catch |

**Precedence when they disagree:** quantitative truth (Tufte / Few)
wins over visual restraint when there's a real conflict — a more
data-dense chart that's correctly labeled beats a prettier chart
that misleads. Accessibility wins over both whenever a tradeoff
exists. See [`feedback-bloat-control`](/home/primitive/.claude/projects/-srv-primitivehub-app/memory/feedback_bloat_control.md)
for the full priority stack.

## References

- Linear's design principles:
  https://linear.app/method/principles
- Vercel design system: https://vercel.com/design
- Stripe Docs design language: https://docs.stripe.com/
- Sigstore Foundation site: https://www.sigstore.dev/
- This codebase's own existing components as taste anchors.
