---
spec_version: "0.1"
name: framer-motion-discipline
version: 0.1.0
type: design
domain: frontend
author: PrimitiveHub Labs (synthesized 2026-05-30 from production motion patterns + Framer Motion 12 docs)
license: CC-BY-4.0
tokens: 2400
token_budget: 3500
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
use_when:
  - "Adding or editing any Framer Motion / `motion/react` component"
  - "Animating UI on enter/exit (modals, dropdowns, sheets)"
  - "Building scroll-linked or drag-driven animations"
  - "Wiring Radix portals + AnimatePresence (requires forceMount)"
do_not_use_when:
  - "Plain CSS transitions sufficing for the case (prefer CSS for hover/focus/state styling)"
  - "Server components (motion requires `'use client'`)"
attestation: cci-v0.1
description: "Framer Motion (motion/react) discipline for PrimitiveHub: GPU-only properties, spring physics defaults, AnimatePresence + Radix forceMount ordering, useMotionValue (no-rerender), prefers-reduced-motion compliance, bundle minimization via LazyMotion."
keywords: [framer-motion, motion, animation, animate-presence, spring, gpu, accessibility]
references:
  - "https://motion.dev/docs/react"
  - "https://motion.dev/docs/react-animate-presence"
---

# Framer Motion (motion/react) Discipline

## Purpose

PrimitiveHub uses motion sparingly — restraint-first per
`frontend-design-elite`. Where motion appears (Radix overlays, page
transitions, validation pipeline timeline, registry card hover lifts),
this primitive captures the rules that keep animations smooth, accessible,
and small enough not to bloat the bundle.

The common AI-output failures: (a) animating `width`/`height`/`top`
(layout properties — janky), (b) `useState` inside drag handlers (60+
re-renders per second), (c) Radix `Portal` + `AnimatePresence` without
`forceMount` (exit animation never plays — see
`shadcn-ui-composition` primitive), (d) shipping `motion` instead of
`LazyMotion` + `m` (loads 34 KB instead of ~5 KB).

## Core Principles

- **Animate only GPU-composited properties.** `x`, `y`, `scale`,
  `rotate`, `opacity`, `filter`. Never `width`, `height`, `top`,
  `left`, `padding`, `margin`, `font-size` — those trigger layout on
  every frame and drop to 15-30 fps. When you NEED to animate layout,
  use the `layout` prop — it uses FLIP under the hood.

- **Springs over duration.** `transition={{ type: "spring", stiffness:
  300, damping: 25 }}`. Springs handle interruption gracefully
  (velocity preserved on reverse); duration-based transitions reset
  abruptly. Save duration transitions for `opacity`-only fades.

- **`useMotionValue` for any value updated faster than React renders.**
  Drag, scroll-linked, pointer-tracking. `useMotionValue` writes to
  the DOM directly, zero re-renders. Pair with `useTransform` for
  derived values (opacity from drag distance, color from scroll).

- **`AnimatePresence` requires `key` on direct children + `forceMount`
  on Radix portals.** Without `key`, React can't track identity →
  exit never plays. Without `forceMount` on the Radix `Portal` +
  `Content`, the portal unmounts before AnimatePresence can run its
  exit. (Cross-reference `shadcn-ui-composition`.)

- **`LazyMotion` at the root.** Wrap once in `app/layout.tsx` (or a
  client provider mounted at root). Use `m` instead of `motion` in
  components. Cuts bundle from ~34 KB to ~5 KB for the common case.

- **`prefers-reduced-motion` compliance is non-negotiable.** Use
  `useReducedMotion()`. Replace springs with instant transitions, but
  DON'T disable the state change — the UI must still update; only
  the physical motion goes away.

## Decision Rules

- **IF tempted to animate `width`/`height`/`top`/`left` THEN** use
  `scale`, `scaleX`, `scaleY`, `x`, `y` instead. If layout MUST animate,
  use the `layout` prop.
- **IF building a drag or scroll-linked interaction THEN** use
  `useMotionValue` + `useTransform`. Never `useState` in `onDrag`.
- **IF wrapping a Radix overlay with motion THEN** the Radix `Portal`
  AND `Content` both need `forceMount`; the visible-mount is gated
  by the `open` prop on `Root`; AnimatePresence wraps `Content`'s
  motion child. (See `shadcn-ui-composition` for the canonical shape.)
- **IF the spring has `damping < 15` THEN** justify it. Bouncy springs
  are for celebratory moments only; functional UI uses `damping: 20-30`.
- **IF the animation is longer than 250ms THEN** check whether it adds
  value or just adds latency. Most UI feels best at 150-200ms.
- **IF the user has `prefers-reduced-motion: reduce` THEN** swap the
  spring for `{ duration: 0 }` — the state change still happens, the
  motion doesn't.

## Anti-Patterns

- **Animating layout properties without the `layout` prop.** 15 fps
  jank. Use transforms or the `layout` prop.
- **`useState` for drag-tracked values.** Re-renders every frame; the
  whole tree pays the cost. Use `useMotionValue`.
- **`AnimatePresence` without `key`s on its children.** React can't
  track identity; exit animations never play.
- **Radix `Portal` without `forceMount` when animating with
  AnimatePresence.** Same outcome — Radix unmounts before the exit
  can run.
- **Defining motion components inside the render body.** Re-creates
  the component on every render; defeats internal optimizations.
  Define at module scope or with `useMemo`.
- **Bundling all of `motion`.** Use `LazyMotion` + `m` to load only the
  features you need.
- **Animating without checking `prefers-reduced-motion`.** Hostile to
  users with vestibular disorders.

## Review Checklist

- [ ] Animated property is `x`, `y`, `scale`, `rotate`, `opacity`, or
      `filter` — OR the `layout` prop is used for layout animation.
- [ ] Spring config has `damping ≥ 15` for functional UI.
- [ ] `useMotionValue` used for drag / scroll / pointer tracking;
      `useState` for animated values is absent.
- [ ] `AnimatePresence` children have stable `key` props.
- [ ] Radix overlays use `forceMount` on `Portal` + `Content` when
      AnimatePresence is involved.
- [ ] `prefers-reduced-motion` honored (either globally via
      `useReducedMotion()` or per-animation).
- [ ] Component file declares `"use client"` (motion is client-only).
- [ ] Bundle: `LazyMotion` + `m` used; raw `motion` only where a
      feature isn't in `domAnimation`/`domMax`.

## Agent Behavior Instructions

1. Before adding motion to a component, ask: is a CSS transition or
   `data-[state=*]` Tailwind utility sufficient? (See
   `shadcn-ui-composition`.) If yes, skip motion entirely.
2. When animating a Radix overlay, cross-reference the
   `shadcn-ui-composition` primitive for the `forceMount` +
   AnimatePresence ordering — do not re-derive it.
3. If the design calls for an animation > 250ms, surface a question:
   is the duration adding value or latency?
4. Always check `prefers-reduced-motion` for any animation that's not
   a pure opacity fade.
5. If shipping a new motion-heavy surface, recommend `LazyMotion`
   wiring if it's not already at the root.

## Expected Output Format

For a new animated component:

```tsx
"use client"

import { m, useReducedMotion } from "motion/react"

const SPRING = { type: "spring", stiffness: 300, damping: 25 }

export function ExampleCard() {
  const reduce = useReducedMotion()
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={reduce ? { duration: 0 } : SPRING}
    />
  )
}
```

For a Radix overlay with exit animation, see the canonical shape in
`shadcn-ui-composition` § Animating with AnimatePresence.

## References

- motion docs: https://motion.dev/docs/react
- Companion: `shadcn-ui-composition` § forceMount + AnimatePresence
- Companion: `frontend-design-elite` § Restraint (less motion is more)
- Companion: `accessibility-wcag22` § prefers-reduced-motion
