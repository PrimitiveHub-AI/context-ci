# DESIGN.md — PrimitiveHub

> **The unified design doctrine for PrimitiveHub.** Single source of truth.
> When you add a feature, consult this file first. When taste decisions
> compete, this file is authoritative — supersedes anything scattered in
> components, stylesheets, or memory.
>
> Format follows the `design-md-spec` primitive (see
> [`content/primitives/design-md-spec.md`](content/primitives/design-md-spec.md)):
> five canonical sections, descriptive language, exact values, current
> state only.
>
> This document is **descriptive of the shipped product**, not aspirational.
> Aspirational directions are noted explicitly with "**(planned)**".

---

## 0. Product names (canonical)

These are the **canonical** names for every load-bearing PrimitiveHub
surface. Use them verbatim in code, docs, UI strings, commit messages,
external copy. Per ADR-0017, brand discipline is enforced at PR review
time — drift is a defect, not a quirk.

| Surface | Canonical name | Short form | Path / where |
|---|---|---|---|
| The product | **PrimitiveHub** | — | — |
| Authoring surface (markdown editor) | **Primitive Forge** | Forge | `/forge`; navbar label "Forge" |
| Permanent inspection surface (planned, Phase 5.6) | **Primitive Explorer** | Explorer | `/explorer/...` |
| Validation pipeline / category framework | **Context CI** | — | `/validation`; the noun the category creates |
| Threat taxonomy v0.1 | **Context CI Top 10** | Top 10 | `/top-10`; IDs `CCI-001..CCI-010` |
| Wire format spec | **Trust Contract v0.1** | — | `docs/trust-contract-v0.1.md` |
| Self-verifying artifact | **Trust Bundle** | bundle | media type `application/vnd.primitivehub.bundle+json` |
| Manifest format (planned, Phase 5.6) | **CBOM** (Context Bill of Materials) | CBOM | media type `application/vnd.primitivehub.cbom+json` |
| Verifier library (planned, Phase 5.5.4) | **`@primitivehub/verify`** | verify | npm package |
| CLI (planned, Phase 5.5.3) | **`phub`** | phub | `npx phub` |
| MCP server (planned, Phase 5.5.5) | **`@primitivehub/mcp-server`** | mcp | npm package |
| GitHub Action (planned, Phase 5.5.6) | **`primitivehub/context-ci-action`** | action | Marketplace |
| The whole runtime trust layer | **Context Firewall** | — | headline product framing |

**Deprecated names — do not use:**

- ~~Workbench~~ / ~~Workbench v2~~ → use **Primitive Forge** / **Forge**
  (renamed 2026-05-31, ADR-0017)

If you find a deprecated name in code or docs, fix it in the PR you're
already touching the file in. Don't open a one-line "fix naming" PR
unless the deprecation note explicitly authorizes it.

---

## 1. Visual Theme & Atmosphere

PrimitiveHub reads as **trust infrastructure**. The register sits at the
intersection of three reference products:

- **Sigstore Foundation site** — for cryptographic precision and academic
  credibility
- **Linear and Vercel dashboards** — for information density without
  stress, and for visual restraint that lets typography do the work
- **Stripe Docs** — for microcopy that respects the reader and product
  surface that signals professionalism in every label

The atmosphere is **deep-night-cyan**: a near-black neutral background
with a single calm cyan accent emerging where trust is being signaled
(verification states, primary CTAs, attestation pillars). The product
shows no gradient soup, no rounded-2xl cards stacked on shadows, no
illustrations, no robot mascots, no emoji — every visual element carries
information.

**Density is signal, not stress.** The product packs identifiers, scores,
status badges, and metadata into compact rows; the reader's eye learns
to scan tabular regions naturally because the typography scale is tight
and consistent (10px–15px range dominates). When something is small and
quiet, it is intentional: the digest hash, the verdict word, the
attestation timestamp. Visual hierarchy bows to **emotional hierarchy** —
what the reader cares about is what we placed where their eye comes to
rest, not what we made bigger.

The product is **dark-first**. A light theme is not currently shipped and
not currently planned for v1; if added, it would override CSS variables
at `:root.dark` or `[data-theme="light"]` without component changes.

The brand sentence — the load-bearing claim — is:

> **PrimitiveHub treats agent context as supply-chain material, not
> disposable prompt text.**

This sentence appears as a styled callout in
[`apps/web/components/landing/why-section.tsx`](apps/web/components/landing/why-section.tsx)
and is what every other visual decision must support.

---

## 2. Color Palette & Roles

All values are OKLCH (`oklch(L C H)` — perceptual lightness, chroma,
hue) and live in [`apps/web/app/globals.css`](apps/web/app/globals.css) as CSS variables
inside `:root { … }` and exposed to Tailwind via `@theme inline`. New
colors are added there; component code references the produced Tailwind
utility (e.g., `text-primary`, `bg-success/[0.06]`) and never inlines a
raw color.

### 2.1 Neutrals (the canvas)

| Token | Value | Role |
|---|---|---|
| `--background` (`bg-background`) | `oklch(0.11 0.005 260)` | Page canvas. Deep blue-neutral. The product's default reading surface. |
| `--foreground` (`text-foreground`) | `oklch(0.95 0.01 250)` | Primary text. Near-white with a faint cool cast that pairs with the background. |
| `--card` (`bg-card`) | `oklch(0.15 0.005 260)` | Single-step elevation above background for cards, panels, popovers. No shadow accompanies; elevation comes from value contrast only. |
| `--secondary` (`bg-secondary`) | `oklch(0.19 0.005 260)` | Quiet surface for input fields, status pill backgrounds, terminal/code blocks. |
| `--muted` (`bg-muted`) | `oklch(0.17 0.005 260)` | Slightly de-emphasized surface; used for badges representing inactive states. |
| `--muted-foreground` (`text-muted-foreground`) | `oklch(0.60 0.01 250)` | De-emphasized text. The product's secondary reading register. Held at 0.60 (not lower) so full-strength muted text clears WCAG AA (~4.8:1 on canvas); the pre-launch audit found 0.55 read as dim/under-AA. Do **not** dim it further with `/50`–`/70` alpha on content that carries information — that lands at ~2:1. |
| `--border` (`border-border`) | `oklch(0.22 0.005 260)` | Subtle divider; almost always used at 40–60% alpha (`border-border/40`) to keep the canvas calm. |

### 2.2 Brand and trust signals

| Token | Value | Role |
|---|---|---|
| `--primary` / `--color-cyan` (`text-primary`, `bg-primary`) | `oklch(0.78 0.14 195)` | The trust accent. Used for: CTA hover/focus, attestation success in cryptographic contexts, the headline glow, the "Attested" pillar, focus rings, active tab underline. **Single accent — do not introduce a parallel "brand color."** |
| `--color-success` (`text-success`, `bg-success/…`) | `oklch(0.70 0.17 150)` | Verification green. Used for: "Trusted" badge, validation stage `passed`, lifecycle stage completed, reviewer "Approved" status. |
| `--accent` / `--color-amber` (`text-amber`, `bg-amber/…`) | `oklch(0.78 0.11 85)` | Warning + **the demo-data label**. Used for: lint warnings, "In Review" trust status, token-budget over 90%, the `<DemoDataBadge>` component, the public-uploads-not-auto-trusted governance disclosure banner. |
| `--destructive` (`text-destructive`, `bg-destructive/…`) | `oklch(0.55 0.2 25)` | Error and rejection. Used for: lint errors, "Rejected" review status, "Without Primitives" in before/after comparisons, security-reviewer role tag, high risk level. |
| `--color-violet` (`text-violet`) | `oklch(0.65 0.15 300)` | Experimental state — used only for the `Experimental` trust status badge. Distinct from primary so experimental never reads as trusted. |

### 2.3 Alpha discipline

Tints of these colors carry weight: `bg-success/[0.08]` reads as
*surface that means success*; `bg-success/30` reads as *aggressive
success*. The convention:

- **`/[0.04]` – `/[0.08]`** for subtle backgrounds behind status content
- **`/15` – `/30`** for borders against neutral surfaces
- **`/40` – `/60`** for foregrounded subtitle text on the same hue
- **`/70` – full** for icon-level signals at small sizes

Always use the `/<alpha>` modifier syntax (Tailwind v4) — never separate
alpha tokens.

---

## 3. Typography Rules

Two font families, sourced via Next.js Google Fonts and exposed as CSS
variables ([`apps/web/app/layout.tsx`](apps/web/app/layout.tsx)):

- **Geist Sans** (`var(--font-geist-sans)` → Tailwind `font-sans`) — body,
  headings, microcopy, button labels, descriptive prose
- **Geist Mono** (`var(--font-geist-mono)` → Tailwind `font-mono`) —
  identifiers, file names, slugs, digests, version strings, install
  commands, terminal output, eyebrow labels, score numerals

### 3.1 Scale

The product lives between 9px and 32px. Display sizes (40px+) appear
only in the Hero. Outside of headlines, the dominant size range is
10px–14px. Don't introduce a 21px or 13.5px outside the scale.

| Size class | Use |
|---|---|
| `text-[9px]` (mono) | Smallest informational label; metadata on cards, "joined" dates, the lifecycle ordinal numbers (`01`–`06`). |
| `text-[10px]` (mono, uppercase, tracking-[0.2em]) | **The eyebrow.** Every section starts with one. Color: `text-primary` for product surfaces, `text-primary/80` for variants. Marks register before any prose lands. |
| `text-[11px]` | Compact body, list items in side panels, primitive frontmatter rows. |
| `text-xs` (12px) | Default informational text — descriptions, captions, status messages. |
| `text-[13px]` | Nav links, tab labels. |
| `text-sm` (14px) | Body paragraphs in marketing sections; review comments. |
| `text-[15px]` | The hero subhead; one register up from body without crossing into display. |
| `text-base` / `text-lg` / `text-xl` (16/18/20) | Used sparingly for medium-prominence headings (the `## Section` H2s in tabbed content). |
| `text-2xl` (24px) | Page titles. |
| `text-3xl` (30px) | Hero-adjacent: Concept section h2, Why section h2, CLI Roadmap h2. |
| `text-4xl` / `text-5xl` / `text-[3.5rem]` (36/48/56) | Hero headline only. |

### 3.2 Weight and line-height

- **Default body weight:** 400 (`font-normal`). Bumps to 500 for emphasis
  and 600 (`font-semibold`) for short heading-like elements (card
  titles, eyebrow-adjacent labels, tab text when active).
- **`font-bold` (700) is reserved for page titles** (h1, h2 at 24px+)
  and the metric callouts in benchmark grids.
- **Body line-height:** 1.7 for reading prose (`leading-[1.7]` or
  `leading-relaxed`). 1.4 for tight tabular UI and code.
- **Eyebrow line-height:** default (1.5) is fine; the uppercase + 0.2em
  tracking does the visual work.
- **`tabular-nums`** is applied to *every numeric region* where columns
  align — score badges, token counts, install counts, version strings.
  Non-tabular numerals reading next to each other read as broken.

### 3.3 Microcopy register

- Sentence case for buttons and labels. **Never title case for actions.**
- No exclamation marks. Ever. Including in empty states.
- No buzzwords: "empower," "unleash," "supercharge," "revolutionize,"
  "10x," "unlock the power of …"
- Verbs match the product surface: "Run validation," "Submit to
  registry," "Attest & publish," "Verify provenance" — not "Get
  started," "Begin your journey," "Launch your future."
- Numbers presented as fact must be reproducible OR labeled with
  `<DemoDataBadge>`. No exceptions.

---

## 4. Component Stylings

The product is composed almost entirely from primitives in
[`apps/web/components/ui/`](apps/web/components/ui/) (a standard shadcn/ui install) and
feature components in `apps/web/components/<feature>/`. The descriptions below
are functional, not implementation — they capture what the component is
*for* and what tone it carries.

### 4.1 Cards ([`apps/web/components/ui/card.tsx`](apps/web/components/ui/card.tsx))

A card is a content vessel with one-step elevation over background
(`bg-card`) and a subtle outline (`border-border/40`). **No shadow by
default.** The PrimitiveCard ([`apps/web/components/primitives/primitive-card.tsx`](apps/web/components/primitives/primitive-card.tsx))
adds a thin colored top accent (`h-px w-full bg-success/40`) to mark
trust status without occupying additional visual weight. Cards are dense
inside: a primitive card packs filename, status, description, six
metadata fields, four score badges, a token-budget bar, risk + category
chips, six agent compatibility tags, an install command, and two
actions — all in a single ~340px-wide card. The density is the point.

### 4.2 Badges ([`apps/web/components/ui/badge.tsx`](apps/web/components/ui/badge.tsx))

Badges are status carriers. Three families:

- **Trust badges** ([`apps/web/components/primitives/trust-badge.tsx`](apps/web/components/primitives/trust-badge.tsx))
  — status word + lucide icon, hue-coded against background and border
  (success / amber / violet / muted). Always mono, always small.
- **Demo data badges** ([`apps/web/components/primitives/demo-data-badge.tsx`](apps/web/components/primitives/demo-data-badge.tsx))
  — amber pill with info icon. Used wherever synthetic numbers appear
  in UI. Carries a `title` attribute with explanatory text.
- **Generic chips** — filter selection, agent compatibility, category
  labels. Mono, 9–10px, low-saturation border.

### 4.3 Buttons ([`apps/web/components/ui/button.tsx`](apps/web/components/ui/button.tsx))

Three variants in active use: `default` (primary fill), `outline`
(transparent + border), `ghost` (no background, hover-revealed). The
default size in the product is `sm` (28px height) or h-10 for hero CTAs.
**Never more than three actions in a single decision area.** Primary
gets the cyan, outline gets the border, ghost gets the muted text.

### 4.4 Tabs ([`apps/web/components/ui/tabs.tsx`](apps/web/components/ui/tabs.tsx); custom inline pattern on primitive detail)

The product's tab pattern is a row of mono 13px buttons with a
**1px-wide 24px-long underline marker** (`absolute bottom-0 left-1/2
h-px w-6 -translate-x-1/2 bg-primary`) under the active tab. There is no
filled background, no rounded pill. This is a deliberate choice: tabs in
trust products read as "channels of the same content," not as separate
modes. The Workbench overrides this for its three modes (Author /
Validate / Test, planned) where pill-style tabs would be appropriate.

### 4.5 Editor ([`apps/web/components/forge/markdown-editor.tsx`](apps/web/components/forge/markdown-editor.tsx))

The Forge uses **CodeMirror 6** with a custom theme matching this
palette (cyan caret + selection, amber lint-warning underline,
destructive lint-error underline). Background is transparent to inherit
the surrounding card. Font: `var(--font-geist-mono)`, 13px, 1.7
line-height. Gutters use `text-muted-foreground` at full strength. The
editor is *calm* — no rainbow syntax, no chromatic noise; markdown
highlights are weight + subtle hue, not saturated palette.

**Calm ≠ dim (non-obvious).** Calm governs the *syntax* register, not
the base legibility. The editor body is full `--foreground`; the
open-file label in the card header is `text-foreground/90` (never
`text-muted-foreground` — that reads as a disabled tab); line numbers
are full `--muted-foreground` (60%-alpha computed to ~2:1 and read as
broken). The editor was 12px + a 60%-alpha gutter until the pre-launch
audit flagged it as looking dim/unfinished — the lesson is that a quiet
surface still has to read as *present*, not *disabled*.

### 4.6 Status and metric strips

The horizontal bars below page headers (Workbench metadata bar,
validation page status row) follow a consistent pattern:
- `border-b border-border/40` separating row from above
- `text-[9px] font-mono uppercase tracking-widest` for labels
- `text-[10px] font-mono` for values
- Items separated by `text-border |` vertical bars
- `ml-auto` pushes the rightmost-item (count, status, time) to the right

### 4.7 Terminal-styled code blocks

Install commands, CLI roadmap examples, full validation CI logs, and
the `phub verify` provenance output all share a single visual pattern:
`rounded-md bg-secondary/40 border border-border/50` with a `$` prompt
in `text-primary/60` followed by mono code at 10.5–11px. The CLI
Roadmap component ([`apps/web/components/landing/cli-roadmap.tsx`](apps/web/components/landing/cli-roadmap.tsx))
is the canonical example.

### 4.8 Eyebrow labels

The single most-repeated UI element. The recipe:

```tsx
<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
  Eyebrow text
</p>
```

Variants: `text-primary/60` for muted eyebrows above secondary content,
`text-primary/80` for a softer-than-default register. Tracking
(`tracking-[0.2em]` or `tracking-widest`) is non-negotiable; without it
the uppercase reads as shouting.

### 4.9 Demo-data discipline

Every region in the product that displays seeded or synthetic numbers
has either:

1. A `<DemoDataBadge>` near the values, with explanatory tooltip, OR
2. An explicit "demo run" / "demo benchmark" / "template content" pill
   above the values with a one-sentence disclosure

This is enforced by the `feedback-no-fake-numbers` memory rule. No
exceptions.

---

## 5. Layout Principles

### 5.1 Container and gutters

- **`max-w-7xl mx-auto`** for primary content regions. Defines the
  product's horizontal rhythm.
- **`px-4 lg:px-6`** for outer padding. The product is designed for
  desktop and large laptop screens primarily.
- **`py-24` for landing sections** (Hero, Why, Concept, Features, CLI
  Roadmap, CTA). **`py-8` to `py-10` for in-app data pages** (registry,
  bundles, contributors, validation, workbench, paper).
- **Section dividers** are always `border-b border-border/40` or
  `border-y border-border/40` for full bracketing. Calm, low-saturation,
  consistent.

### 5.2 Grid and density patterns

Three recurring grid patterns:

**Faceted compact grid** — used for category lists, feature grids,
threat-vs-response, role grids. Pattern:
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-N gap-px
  rounded-xl border border-border/40 overflow-hidden bg-border/40
```
The `gap-px` + `bg-border/40` parent creates the divider lines without
nested borders. Cells are `bg-card p-6`.

**Score / metric grid** — equal-weight tiles for benchmark numerals.
Pattern: `grid grid-cols-2 sm:grid-cols-4 gap-3` with each tile
`text-center` and the value in `text-xl font-bold font-mono
tabular-nums`.

**Card grid** — for registry primitive cards and bundles. Pattern:
`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

### 5.3 Vertical rhythm

- **Page-level** rhythm: 96px between landing sections, 24–32px between
  in-app sections.
- **Component-level** rhythm: 12–16px between paragraphs in a card,
  8–10px between bullet items, 4–6px between metadata items in a row.
- The Hero's mt-* / mb-* sequence (mb-8 → mb-14 → mt-14 → mt-20 → mt-10)
  is the canonical example of intentional rhythm; copy that pattern when
  building new landing sections.

### 5.4 Responsive behavior

The product is **desktop-first**. Mobile renders correctly but is not
the design target — PrimitiveHub readers are developers and enterprise
security buyers at desks. Tailwind breakpoints in use:

- Default (mobile) → single column, full-width cards, stacked navbars
- `sm` (640px) → 2-column grids, inline buttons
- `md` (768px) → row layouts in cards, navbar inline
- `lg` (1024px) → 3-column grids, 7-column primitive-detail header,
  desktop-final
- `xl` and above → no additional changes; the `max-w-7xl` container
  caps the design

### 5.5 Backgrounds and surface accents

- **Hero** carries two stacked backgrounds: a subtle dot grid
  (`bg-grid` class in [`apps/web/app/globals.css`](apps/web/app/globals.css)) at 30%
  opacity, and a `radial-gradient` cyan glow at the top
  (`oklch(0.78 0.14 195 / 0.06)`). These are the only landing-background
  treatments in the product. Don't introduce another.
- **In-app pages** use bare `bg-background` with `border-b border-border/40`
  section dividers. No gradients, no patterns.

### 5.6 Non-obvious decisions (with rationale)

- **Section eyebrows use mono uppercase tracked, not sans uppercase.**
  Mono reads as engineering register; sans uppercase reads as marketing.
  Trust products lean engineering.
- **No box-shadow on cards by default.** Shadow reads as
  consumer-product polish. Elevation by value contrast reads as
  infrastructure.
- **Borders default to `/40` opacity.** Full-opacity borders create
  visual cells that compete with content; soft borders read as
  hierarchy without dominance.
- **Buttons height defaults to 28px (`h-8`) in dense contexts and 40px
  (`h-10`) in primary CTA contexts.** No 32px buttons — they read as
  default-shadcn and we want product-tuned.
- **Tabular numerals everywhere numbers appear in columns.** Without
  `tabular-nums`, adjacent rows of metrics shift horizontally as digits
  change. This is the visual equivalent of jitter.

---

## Cross-references

- **Color tokens**: [`apps/web/app/globals.css`](apps/web/app/globals.css) (`:root` + `@theme inline`)
- **Font wiring**: [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx)
- **Tailwind v4 conventions**: [`content/primitives/tailwind-v4-mastery.md`](content/primitives/tailwind-v4-mastery.md)
- **shadcn composition patterns**: [`content/primitives/shadcn-ui-composition.md`](content/primitives/shadcn-ui-composition.md)
- **Elite taste calibration**: [`content/primitives/frontend-design-elite.md`](content/primitives/frontend-design-elite.md)
- **Producing per-feature DESIGN.md files**: [`content/primitives/design-md-spec.md`](content/primitives/design-md-spec.md)
- **Brand sentence + launch posture**: [`CLAUDE.md`](CLAUDE.md)

## Updating this document

Add a section under "Non-obvious decisions" whenever you make a
design choice that future you (or future Claude) would otherwise have
to re-derive. Update the palette section when a new token lands in
`apps/web/app/globals.css`. Update the typography scale when a new size enters
the product. **Don't let this file fall behind the code — it is the
authority.**
