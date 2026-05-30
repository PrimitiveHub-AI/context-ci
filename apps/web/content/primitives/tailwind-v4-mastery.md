---
spec_version: "0.1"
name: tailwind-v4-mastery
version: 0.2.0
type: design
domain: frontend
author: PrimitiveHub Labs (synthesized from public skills + maintainer knowledge; v0.2.0 enrichment adds @theme inline mechanics, @plugin/@variant, double-wrap gotcha)
license: CC-BY-4.0
tokens: 3900
token_budget: 5000
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
  - v0
  - windsurf
use_when:
  - "Writing or modifying Tailwind v4 styles in this codebase"
  - "Building new components that need theming"
  - "Touching app/globals.css or any @theme block"
  - "Adding new CSS variables, color tokens, or font tokens"
  - "Migrating styles from Tailwind v3 patterns"
do_not_use_when:
  - "Working on Tailwind v3 codebases (this primitive is v4-only)"
  - "Writing CSS-in-JS or styled-components"
  - "Plain CSS modules without Tailwind"
attestation: cci-v0.1
description: "Tailwind v4 mastery — CSS-first config, OKLCH tokens, @theme inline, dark-first defaults. Calibrated to PrimitiveHub's actual app/globals.css and aligned with how shadcn/ui consumes it."
keywords: [tailwind, tailwind-v4, oklch, theming, css-variables, dark-mode]
references:
  - "https://tailwindcss.com/docs/v4-beta"
  - "https://tailwindcss.com/docs/theme"
---

# Tailwind v4 Mastery

## Purpose

This primitive teaches an AI agent how to write Tailwind v4 correctly in
this codebase. Tailwind v4 is **fundamentally different** from v3:
configuration is CSS-first (not `tailwind.config.js`), color tokens use
OKLCH, themes are defined inline in CSS, and many v3 patterns are
obsolete or wrong. The most common AI-output failure is producing
syntactically valid Tailwind that looks correct but uses v3 conventions
v4 doesn't understand.

The PrimitiveHub stack uses Tailwind v4.2+ with shadcn/ui consuming the
theme via CSS variables. This primitive assumes that combination and
should be loaded before any styling work.

## Core Principles

- **CSS is the config.** v4 has no `tailwind.config.js` for theme tokens.
  Tokens are declared in `@theme inline { … }` blocks inside the CSS file
  (typically `apps/web/app/globals.css`). Concrete example: PrimitiveHub's
  `apps/web/app/globals.css` declares `--color-primary`, `--font-sans`,
  etc. inside `@theme inline`. Do not propose a `tailwind.config.{js,ts}`
  file.

- **`@theme inline` ≠ `@theme`.** The `inline` keyword is load-bearing.
  `@theme { --color-primary: oklch(…); }` declares the token AND emits
  the literal value into the generated CSS — every site that uses
  `bg-primary` ships with the OKLCH string baked in. `@theme inline`
  declares the token but keeps it as a CSS variable reference, so a
  later `:root.dark { --color-primary: …; }` actually overrides it at
  runtime. **You almost always want `@theme inline`** because that's
  what makes dark-mode and per-section overrides work. Static-only
  tokens (spacing, radius, font-family names) can use bare `@theme`,
  but mixing both in one file is a footgun — pick one mode per token.

- **`@plugin` is the v3-config import path.** Tailwind plugins
  (`@tailwindcss/typography`, custom plugins) load via
  `@plugin "@tailwindcss/typography";` at the top of the CSS file —
  there is no `plugins: []` array anywhere. If you need a plugin's
  utility (e.g., `prose`), `@plugin` is the only way to register it.

- **`@custom-variant` and `@variant` for selector variants.**
  `@custom-variant <name> (<selector>)` defines a new variant prefix
  (we use `@custom-variant dark (&:is(.dark *))`). `@variant <name>
  { … }` applies a previously-defined variant inside arbitrary CSS —
  useful for global rules in `@layer base` that need to behave
  differently under `dark:`.

- **OKLCH for color tokens, not HSL or hex.** v4's defaults and our brand
  palette use OKLCH (`oklch(L C H)` — perceptual lightness, chroma, hue).
  OKLCH transitions correctly through hue rotations and produces dark
  themes that don't muddy. Example from our codebase:
  `--primary: oklch(0.78 0.14 195);` (cyan-leaning). Convert legacy hex
  via tools; never hand-pick by eye.

- **CSS variables, not utility tokens.** v4 consumes `--color-foo` and
  emits `bg-foo` / `text-foo` / `border-foo` utilities automatically. Add
  a new CSS variable inside `@theme inline` and the utility appears.
  Example: adding `--color-success: oklch(0.70 0.17 150);` automatically
  produces `bg-success`, `text-success`, `border-success`, etc.

- **`@custom-variant dark` is the dark-mode trigger.** Our codebase
  uses `@custom-variant dark (&:is(.dark *));` so `dark:` utilities apply
  when an ancestor has `class="dark"`. The default theme block declares
  base colors; a `:root.dark` (or future `[data-theme="dark"]`) block can
  override them. PrimitiveHub ships dark-first, so the root is already
  dark; a future light-mode toggle would add the override block.

- **Use opacity modifiers, not separate alpha tokens.** v4 supports
  `bg-primary/40` (= 40% alpha of the primary token). Do not produce
  separate `--color-primary-40` tokens; use the `/<alpha>` syntax.

- **Spacing scale is consistent; don't invent.** Spacing is `space-*` /
  `p-*` / `m-*` / `gap-*` / `size-*` using the same 4px-step scale.
  Compose with arbitrary values (`p-[18px]`) only when no step fits and
  document why in a comment.

## Decision Rules

- **IF the user wants a new color token THEN** add it to `@theme inline`
  in `apps/web/app/globals.css` as `--color-<name>: oklch(...)`. Do NOT
  add to a config file (there isn't one).
- **IF the token must be runtime-overridable (dark/light/per-section)
  THEN** it must live in `@theme inline`. If it's a static atom that
  never changes (radius constants, fixed spacing), bare `@theme` is
  fine — but never mix the two for the same token across files.
- **IF a Tailwind plugin is needed (`@tailwindcss/typography`,
  `@tailwindcss/forms`) THEN** register it with `@plugin "<name>";` at
  the top of `apps/web/app/globals.css`. There is no `plugins: []`
  array.
- **IF a custom variant is needed (e.g., a `data-loading:` prefix) THEN**
  declare it with `@custom-variant data-loading
  (&[data-loading="true"]);` once, then use `data-loading:opacity-50`
  in markup.
- **IF the user wants to use a Next.js font (Geist, etc.) THEN** wire
  CSS variable in `app/layout.tsx`
  (`variable: "--font-geist-sans"`), reference it in `@theme inline`
  (`--font-sans: var(--font-geist-sans), …fallbacks`), and apply the
  variable to `<html>` className. Three steps, all required.
- **IF a v3-style `tailwind.config.{js,ts}` is suggested THEN** reject —
  v4 ignores it for theme tokens. The file may still exist for content
  globs in some legacy setups, but theme work goes in CSS.
- **IF the proposed change adds an arbitrary value (`text-[12.5px]`)
  THEN** check if a token expresses the same intent. Arbitrary values
  are escape hatches, not defaults.
- **IF using `color-mix(in oklch, …)` for transparency or blending
  THEN** keep all inputs in OKLCH; mixing across color spaces produces
  artifacts.
- **IF generating a hex color THEN** convert to OKLCH and use that
  instead. Mixed hex + OKLCH in the same theme produces drift.

## Anti-Patterns

- **Generating `tailwind.config.js` with a `theme.extend` block.** v4
  doesn't read it for theme. The file is obsolete for our setup.
- **Using `hsl()` or hex in theme tokens.** Breaks perceptual color
  consistency. Use OKLCH everywhere.
- **`bg-opacity-40` as a separate utility.** Deprecated in v4; use
  `bg-primary/40`.
- **`@apply` overuse in component CSS.** v4 still supports `@apply` but
  prefer Tailwind utilities in markup. Reserve `@apply` for true global
  rules (e.g., body defaults) inside `@layer base`.
- **Inventing a token because "Tailwind doesn't have it."** v4 produces
  the utility automatically when the CSS variable exists. Add the
  variable, the utility appears.
- **Inline hardcoded font families.** All font tokens flow through
  `@theme inline` → CSS variable → Tailwind class. No raw font-family
  strings in components.
- **Double-wrapping a CSS variable inside `@theme inline`.** Writing
  `--color-primary: oklch(var(--brand-primary));` while
  `--brand-primary` is itself `oklch(0.78 0.14 195)` produces
  `oklch(oklch(…))` at runtime — invalid CSS that silently falls back
  to black. Either store the OKLCH literal directly, or store the
  triplet (`--brand-primary-lch: 0.78 0.14 195;`) and wrap once
  (`--color-primary: oklch(var(--brand-primary-lch));`).
- **Putting `:root { … }` overrides inside `@layer base` together with
  `@theme inline`.** The two have different cascade behavior — `@theme`
  declarations end up at the root with token priority, while `@layer
  base :root` declarations land in the base layer. If both define the
  same variable, the resolved value depends on declaration order in
  weird ways. Pick one place per variable.

## Review Checklist

- [ ] Any new color, font, or radius token landed in `@theme inline`
      inside `app/globals.css`, not in a config file.
- [ ] New color tokens are in OKLCH; no hex in theme blocks.
- [ ] Transparency uses `/<alpha>` modifier syntax, not separate tokens.
- [ ] Dark-mode awareness: changes don't break the dark-first baseline.
- [ ] Arbitrary values are commented with a reason or replaced with a
      token.
- [ ] No `tailwind.config.{js,ts}` introduced for theme work.
- [ ] If new fonts: CSS variable wired in `app/layout.tsx`, referenced
      in `@theme inline`, applied to `<html>` className.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before proposing a styling change, locate `apps/web/app/globals.css` and read
   the existing `@theme inline` block to learn the current token
   inventory.
2. Match new tokens to the existing OKLCH palette (similar lightness +
   chroma ranges).
3. Surface every new token in `@theme inline`, never inline in a
   component.
4. Reference tokens via the produced Tailwind utility (`text-primary`,
   `bg-secondary/40`) rather than `var(--color-primary)` in className.
5. If the design calls for a color that doesn't exist as a token, ADD
   the token first, then use the utility. Don't backdoor with
   `text-[oklch(…)]`.
6. Confirm dark-mode behavior; the codebase is dark-first.

## Expected Output Format

Diffs to `apps/web/app/globals.css` should add tokens at the bottom of the
relevant `@theme inline` block, grouped logically (colors → fonts →
radii → spacing extensions). Each new token gets a one-line comment if
its purpose isn't obvious from the name. Component diffs reference the
new utility class (e.g., `bg-success/10 text-success`) rather than
inline CSS.

## Examples

**Adding a new amber-warning shade tuned to our palette:**

```css
/* apps/web/app/globals.css — inside @theme inline */
--color-amber-soft: oklch(0.78 0.11 85 / 0.55);
```

→ usable as `bg-amber-soft`, `text-amber-soft`, `border-amber-soft`.

**Correct transparency:**
```tsx
<div className="bg-primary/[0.08] border-primary/20" />
```

**Incorrect (v3 holdover):**
```tsx
<div className="bg-primary bg-opacity-8 border-primary border-opacity-20" />
```

## References

- Tailwind v4 documentation: https://tailwindcss.com/docs/v4-beta
- OKLCH color picker: https://oklch.com/
- PrimitiveHub's live theme: `apps/web/app/globals.css` in this repo
