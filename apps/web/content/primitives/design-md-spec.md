---
spec_version: "0.1"
name: design-md-spec
version: 0.1.0
type: design
domain: frontend
author: PrimitiveHub AI (synthesized from google-labs-code/stitch-skills design-md)
license: CC-BY-4.0
tokens: 2600
token_budget: 4000
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
  - windsurf
use_when:
  - "Generating a DESIGN.md for a page, screen, or feature"
  - "Documenting an existing design's tokens, hierarchy, and patterns"
  - "Synthesizing implementation details into design vocabulary"
  - "Onboarding a future contributor to a feature's visual logic"
do_not_use_when:
  - "API documentation (use OpenAPI / docs/spec.md instead)"
  - "User-facing marketing copy (not a design document)"
  - "Architecture documents (use docs/architecture.md)"
attestation: cci-v0.1
description: "Write semantic DESIGN.md files that describe a design's visual theme, palette with roles, typography, component stylings, and layout principles. Source of truth for future regeneration."
keywords: [design-doc, design-md, design-system, visual-spec]
references:
  - "https://github.com/google-labs-code/stitch-skills"
---

# DESIGN.md Specification

## Purpose

A DESIGN.md is a single-file source-of-truth document describing the
visual logic of a feature, screen, page, or full product. It uses
*descriptive design language* — not CSS, not implementation — so that a
future agent (human or AI) reading the doc can recreate the design
intent without needing to read the source.

This primitive teaches how to write a DESIGN.md that holds up:
specific without being implementation-coupled, opinionated without
being arbitrary, complete without being exhausting.

The Stitch project (Google Labs) defines this format. We adopt it here
because PrimitiveHub will accumulate per-feature DESIGN.md files as
it grows. Standard structure means future contributors find what they
need in the same place.

## Core Principles

- **Descriptive language, not CSS.** "Calm cyan glow framing the
  attestation status" is design language. `box-shadow: 0 0 30px
  oklch(0.78 0.14 195 / 0.5)` is implementation. The DESIGN.md uses
  the former and references the latter only when a specific hex is
  load-bearing.

- **Include exact hex/OKLCH values for colors.** Description without
  values produces drift. "A muted amber" is ambiguous; "muted amber
  oklch(0.78 0.11 85)" is unambiguous. Always pair the descriptive
  name with the precise value.

- **Roles, not just hues.** Don't write "cyan." Write "cyan as primary
  accent — used for trust signals, attestation success states, and
  CTA hover/focus." Function before color.

- **Five sections, in order.** Visual Theme & Atmosphere → Color
  Palette & Roles → Typography Rules → Component Stylings → Layout
  Principles. Established convention; future readers know where to
  look.

- **The DESIGN.md describes what is, not what could be.** Don't
  speculate about future variants or alternative palettes. If a
  variant doesn't exist in the implementation, it doesn't belong in
  DESIGN.md.

## Decision Rules

- **IF the doc would exceed ~2000 words THEN** split per-feature.
  A whole-product DESIGN.md becomes unmaintainable; per-page or
  per-feature stays accurate.
- **IF a color appears in the doc THEN** include its exact value
  (OKLCH preferred, hex acceptable as comment) AND its functional
  role.
- **IF describing typography THEN** name the font, weight, size,
  line-height, and use. Skip if the same as the default body type.
- **IF describing a component THEN** describe its emotional tone,
  density, color role, interactive states — NOT its CSS.
- **IF the design references a Tailwind token THEN** mention the
  token name (so the implementation can be located).
- **IF a layout decision is non-obvious THEN** explain *why* in a
  single sentence. Not "12-column grid"; "12-column grid because
  the registry needs four cards per row at desktop and we want even
  spacing at all breakpoints."

## Anti-Patterns

- **Implementation dump.** Pasting Tailwind classes or component
  source. Defeats the point.
- **Generic descriptions.** "Modern, clean, premium" applies to
  every design ever shipped. Be specific or omit.
- **Speculation.** "We could also do X, Y, or Z." DESIGN.md is the
  current state.
- **Decorative writing.** No "soaring," "stunning," "best-in-class."
  This is a spec, not marketing.
- **Mixing audiences.** DESIGN.md is for design and engineering
  consumers. If the intended reader is the customer, you're writing
  marketing.

## Review Checklist

- [ ] The five canonical sections (Visual Theme / Palette / Typography
      / Components / Layout) are present and in order.
- [ ] Every named color has an exact value AND a functional role.
- [ ] Typography section names font, weight, size, line-height, and
      use for each style.
- [ ] Component section describes emotional/functional tone, not CSS.
- [ ] Layout decisions have a one-sentence rationale when non-obvious.
- [ ] No speculation about hypothetical variants.
- [ ] Length under ~2000 words; split if not.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. When asked to produce a DESIGN.md, default to the five-section
   structure even if not requested.
2. Read existing tokens from `app/globals.css` and reference them by
   name in the Palette section.
3. Read existing typography from the same file and from
   `components/landing/*` for the emerging conventions
   (`text-[10px] font-mono uppercase tracking-[0.2em]` for eyebrows,
   etc.).
4. For each component section, link to the implementation file path
   so a reader can jump.
5. Explicitly mark which areas of the design are *prescriptive*
   versus *descriptive of current state* if both exist.

## Expected Output Format

The five canonical sections of a DESIGN.md:

```markdown
# DESIGN.md — <feature/screen name>

## 1. Visual Theme & Atmosphere
<3–5 sentences describing the emotional register, density, hierarchy strategy>

## 2. Color Palette & Roles
- **<name>** `oklch(L C H)` (token `--color-<name>`): role description
- …

## 3. Typography Rules
- **Headings**: <font, weight, size scale, use>
- **Body**: <font, weight, size scale, use>
- **Mono / labels**: <font, weight, size scale, use>
- …

## 4. Component Stylings
- **<Component>** (`components/<path>`): tone, density, color roles,
  interactive states
- …

## 5. Layout Principles
- Grid + container behavior
- Spacing scale convention
- Vertical rhythm
- Breakpoint behavior
- Non-obvious decisions with rationale
```

## Examples

A DESIGN.md for PrimitiveHub's homepage Hero might describe the
"Calm cyan glow framing trust-cognition headline" theme, name the
primary as `oklch(0.78 0.14 195)` with role "trust accent + CTA
focus," describe the headline as Geist Sans bold 56px line-height
1.1, list the install-command pill as a "secondary-bg pill with
mono code at 12px and a copy affordance", and note layout as
"centered column max-w-3xl, vertical rhythm 24–32px between
sections."

## References

- Source skill: google-labs-code/stitch-skills `design-md`
- PrimitiveHub theme: `app/globals.css`
- PrimitiveHub Hero implementation: `components/landing/hero.tsx`
