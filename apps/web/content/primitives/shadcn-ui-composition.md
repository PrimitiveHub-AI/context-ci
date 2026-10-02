---
spec_version: "0.1"
name: shadcn-ui-composition
version: 0.2.0
type: design
domain: frontend
author: PrimitiveHub AI (synthesized from shadcn/ui upstream + google-labs-code/stitch-skills shadcn-ui + maintainer knowledge; v0.2.0 enrichment adds Radix compound pattern, asChild composition, forceMount with AnimatePresence, data-[state=*] styling, portal gotchas)
license: CC-BY-4.0
tokens: 4200
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
  - "Adding a new UI component to the project"
  - "Customizing an existing components/ui/* file"
  - "Designing component variants via CVA"
  - "Implementing accessibility patterns (focus, keyboard nav, ARIA)"
  - "Composing Radix primitives"
  - "Deciding what belongs in components/ui/ vs components/<feature>/"
do_not_use_when:
  - "Projects not using shadcn/ui"
  - "Pure HTML/CSS prototypes"
  - "Working with a different design-system library (MUI, Mantine, etc.)"
attestation: cci-v0.1
description: "shadcn/ui composition — you own the code; CVA for variants, Radix for primitives, cn() for class merging, CSS-variable theming, accessibility by default."
keywords: [shadcn, shadcn-ui, cva, radix, composition, accessibility]
references:
  - "https://ui.shadcn.com/docs"
  - "https://github.com/shadcn/ui"
  - "https://www.radix-ui.com/primitives"
---

# shadcn/ui Composition

## Purpose

shadcn/ui is not a component library — it's a collection of components
you copy into your repo and own. This primitive teaches an AI agent
how to work within that model: customize without forking, compose Radix
primitives, design variants with class-variance-authority, theme via
CSS variables (consumed from Tailwind v4), and inherit accessibility
from Radix rather than reinventing it.

PrimitiveHub's `components/ui/` is a standard shadcn install. The rest
of the app composes those primitives into feature components in
`components/<feature>/`.

## Core Principles

- **Components are yours.** Files in `components/ui/` are not from
  `node_modules`. They're committed source. Modify them freely — but
  treat changes as schema changes for the rest of the app.

- **Composition, not inheritance.** Build feature components by
  importing primitives (`Button`, `Card`, `Badge`, `Dialog`) and
  composing. Do not extend Button via `extends`. Wrap it.

- **`cn()` is the merge primitive.** `lib/utils.ts` exports
  `cn(...inputs)` = `twMerge(clsx(inputs))`. Always use it when
  composing className strings; never string-concatenate with `+`.
  Without `cn()`, conflicting Tailwind classes (e.g., `p-4` and `p-2`)
  produce unpredictable output.

- **CVA for variants.** `class-variance-authority` defines a
  `cva(base, { variants: { … }, defaultVariants: { … }, compoundVariants: […] })`.
  Components accept a `variant` and/or `size` prop typed against the
  CVA output. See `components/ui/button.tsx` for the canonical pattern.

- **Radix primitives provide accessibility for free.** Tabs, Dialog,
  Popover, DropdownMenu — Radix already implements focus management,
  keyboard navigation, ARIA roles, and screen-reader behavior. Use
  them; don't roll your own modal.

- **Theme via CSS variables, not props.** Color comes from
  `--color-foreground`, `--color-primary`, etc. (set in
  `app/globals.css` via Tailwind v4). Component code references
  `text-foreground`, `bg-primary` — Tailwind utilities pulling from
  the variables. Switching themes never requires component changes.

- **Folder convention:** primitives in `components/ui/`, feature
  components in `components/<feature>/`, page-scope components in
  `app/<route>/_components/` if a route owns them. PrimitiveHub uses
  the first two; we haven't needed route-scope yet.

- **Radix compound components: `Root → Trigger → Portal → Content`
  is the shape.** Every overlay primitive (Dialog, DropdownMenu,
  Popover, Tooltip, HoverCard) decomposes into the same parts:
  `Root` (state owner, controlled/uncontrolled), `Trigger` (button
  that toggles `data-state`), `Portal` (renders into `document.body`,
  escaping containing blocks), `Content` (the visible surface), plus
  primitive-specific subparts (`Title`, `Description`, `Item`, etc.).
  Compose all of them at the call site — the parts are kept separate
  so you can swap in custom triggers, portal containers, and content
  shells without forking.

- **`asChild` is the composition primitive.** Setting `<Dialog.Trigger
  asChild><Button>Open</Button></Dialog.Trigger>` merges the trigger's
  behavior (ref, event handlers, ARIA, `data-state`) onto the
  immediate child instead of rendering a wrapper element. Always use
  `asChild` when you'd otherwise want to control the rendered tag.
  But the child must be a single React element that accepts a ref —
  passing a fragment or multiple children silently breaks.

- **State drives styling via `data-state` attributes.** Radix writes
  `data-state="open" | "closed" | "checked" | "indeterminate"` onto
  triggers/content/items. Style with Tailwind v4's data-attribute
  variants: `data-[state=open]:bg-accent`,
  `data-[state=open]:animate-in`,
  `data-[state=closed]:animate-out`. This is how shadcn's
  ship-it animations work — no JS animation library required for the
  default open/close.

- **Animating with `AnimatePresence` requires `forceMount`.** Radix
  unmounts `Portal`/`Content` when state goes closed, which removes
  the node before AnimatePresence can run its exit animation. Pass
  `forceMount` to both `Portal` and `Content` and gate visibility
  with the controlled `open` state in the React tree — AnimatePresence
  then sees the unmount on its own terms.

## Decision Rules

- **IF adding a new primitive (Button, Card variants, etc.) THEN** use
  `npx shadcn@latest add <component>` to bring in the canonical
  version, then edit in-place. Don't author primitives from scratch
  unless none exists upstream.
- **IF the component is feature-specific (PrimitiveCard, BundleCard)
  THEN** create it in `components/<feature>/` and compose primitives
  from `components/ui/`. Do not put feature components in
  `components/ui/`.
- **IF composing multiple Tailwind classes via props THEN** wrap with
  `cn()`. Always.
- **IF the component needs variants (size, intent, density) THEN**
  define them with CVA and type the props against
  `VariantProps<typeof componentVariants>`.
- **IF the component needs a modal, popover, dropdown, tooltip, or
  any interactive overlay THEN** use the Radix primitive (already
  installed in `components/ui/`). Never build from scratch.
- **IF the component renders user-controlled text THEN** ensure focus
  ring is visible via `focus-visible:` utilities, keyboard nav works,
  and ARIA roles are correct (Radix handles this for primitives; you
  handle it for your custom components).
- **IF customizing a primitive's behavior would benefit the whole app
  THEN** edit `components/ui/<primitive>.tsx` directly. Document the
  change in a comment.
- **IF a Radix Trigger needs to render as your own Button (or any
  custom element) THEN** use `asChild` and ensure the child is a
  single React element that forwards refs.
- **IF styling open/closed/checked states THEN** use Tailwind v4
  data-attribute variants (`data-[state=open]:…`) against the
  Radix-written `data-state`. Do not branch on a separate `isOpen`
  prop you computed yourself.
- **IF you need to animate the enter/exit of a Radix overlay with
  Framer Motion's AnimatePresence THEN** pass `forceMount` to BOTH
  `Portal` and `Content`, control visibility via the `open` prop on
  `Root`, and conditionally render the `Content`'s motion child inside
  AnimatePresence.
- **IF a Radix `Content` element must stay inside a specific layout
  region (not the body) THEN** pass `container={ref.current}` to
  `Portal`. This is rare — most overlays should portal to body.

## Anti-Patterns

- **Rolling your own Dialog/Tooltip/Combobox.** Radix already shipped
  it accessibly. Building from scratch loses keyboard nav and focus
  trap implementation. T8-adjacent (fake expertise) — you'll claim
  accessibility you don't actually have.
- **String-concatenating classNames.** Conflicting Tailwind classes
  cascade unpredictably. Use `cn()`.
- **Variant-by-conditional-prop.** Resist `<Button isLarge={true}
  isPrimary={true} />`. Use CVA's `variant` and `size` props.
- **Hardcoded colors in components.** No `text-[#fff]`. Use
  `text-foreground`. The theme system flows from CSS variables.
- **Importing from `node_modules/shadcn-ui`.** There is no such
  package. shadcn isn't an npm dep; it's a code generator.
- **Wrapping primitives just to rename props.** If your wrapper only
  renames `variant` to `kind`, drop the wrapper.
- **Double-wrapping with `asChild` and an extra `<div>` /
  `motion.div`.** `asChild` is meant to merge onto a single child. If
  you wrap that child in `<motion.div asChild>`, ref forwarding breaks
  and ARIA attributes land on the wrong element. Use the Framer
  Motion component as the direct child of the Radix part, no
  intermediate `<div>`.
- **Manually focusing the trigger on close.** Radix already returns
  focus to the trigger when a Dialog/Popover closes. Re-focusing
  manually in an `onOpenChange` handler creates double-focus and
  steals focus from the user's actual next action (often a Tab key
  follow-up).
- **Forgetting CSS containing-block effects when portaling.** Radix
  `Portal` renders to `document.body` precisely to escape
  `transform`/`filter`/`contain` containing blocks on ancestors —
  those break `position: fixed`. If you override `container={...}` to
  a div inside a transformed ancestor, fixed-positioned floating
  elements (toasts, tooltips) misalign. Default to the body portal.
- **z-index races between portaled surfaces.** Multiple portaled
  layers (Dialog + Toaster + DropdownMenu) collide if each picks its
  own z-index ad-hoc. Establish a small z-scale in the theme
  (`--z-overlay: 50`, `--z-toast: 100`) and reference it across
  primitives.
- **Animating without `forceMount` and wondering why exit transitions
  don't play.** Radix unmounted the node before the animation could
  run. `forceMount` is the fix.

## Review Checklist

- [ ] Component uses `cn()` for any composed className.
- [ ] Variants use CVA, not boolean prop combinations.
- [ ] Feature components live in `components/<feature>/`, primitives
      in `components/ui/`.
- [ ] Color, radius, spacing, font all come from theme variables; no
      hardcoded colors or pixel values without a comment explaining
      why.
- [ ] Interactive components compose Radix primitives where one
      exists (Dialog, DropdownMenu, Popover, Tabs, Tooltip, etc.).
- [ ] Accessibility: focus-visible styling present, ARIA roles
      correct, keyboard nav functional.
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
      pass.
- [ ] If a `components/ui/*` primitive was modified, the change is
      documented (comment + commit message rationale).

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Read `components/ui/button.tsx` to learn the project's canonical
   CVA pattern before defining variants for new components.
2. Inspect `lib/utils.ts` to confirm `cn()` is the merge utility.
3. Default to composing existing primitives rather than installing
   new ones. The `components/ui/` directory has most of what's needed
   already.
4. When proposing accessibility behavior, name the Radix primitive
   that already provides it.
5. For each new component, declare which Tailwind v4 theme variables
   it consumes (see the tailwind-v4-mastery primitive). Never invent
   ad-hoc colors.
6. When in doubt, look at `components/primitives/primitive-card.tsx`
   or `components/primitives/bundle-card.tsx` as reference for
   composing primitives into feature components in this codebase.

## Expected Output Format

A new variant component looks like:

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const trustBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border font-mono text-[10px]",
  {
    variants: {
      status: {
        trusted: "border-success/30 bg-success/[0.06] text-success",
        review: "border-amber/30 bg-amber/[0.06] text-amber",
        experimental: "border-violet/30 bg-violet/[0.06] text-violet",
        deprecated: "border-muted-foreground/30 bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-1.5 py-0.5",
        md: "px-2 py-1",
      },
    },
    defaultVariants: { status: "trusted", size: "sm" },
  },
)

interface TrustBadgeProps extends VariantProps<typeof trustBadgeVariants> {
  className?: string
  children: React.ReactNode
}

export function TrustBadge({ status, size, className, children }: TrustBadgeProps) {
  return <span className={cn(trustBadgeVariants({ status, size }), className)}>{children}</span>
}
```

## Examples

PrimitiveHub's `components/primitives/trust-badge.tsx` is a real
example of this pattern (slightly different shape, same principles).
`components/primitives/primitive-card.tsx` is a feature component
composing Card + Badge + CompatibilityTags + Button primitives.

## References

- shadcn/ui docs: https://ui.shadcn.com/docs
- Radix UI primitives: https://www.radix-ui.com/primitives
- CVA: https://cva.style/docs
- PrimitiveHub's own primitives: `components/ui/`, `components/primitives/`
