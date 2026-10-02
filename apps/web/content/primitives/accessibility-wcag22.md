---
spec_version: "0.1"
name: accessibility-wcag22
version: 0.1.0
type: design
domain: frontend
author: PrimitiveHub AI (synthesized 2026-05-29 from WCAG 2.2 AA + ARIA Authoring Practices)
license: CC-BY-4.0
tokens: 3600
token_budget: 5000
risk_level: low
content_digest: sha256:a11ec8a1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a7
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
  - windsurf
use_when:
  - "Building or reviewing any interactive UI component"
  - "Implementing focus management, keyboard navigation, or screen reader behavior"
  - "Auditing a page before merge"
  - "Designing color, contrast, or motion choices"
  - "Touching forms, dialogs, menus, or complex widgets"
do_not_use_when:
  - "Backend code with no UI"
  - "Build configuration"
attestation: cci-v0.1
description: "WCAG 2.2 AA + ARIA APG production rules. POUR principles, focus management, keyboard patterns, color contrast 4.5:1, screen reader testing, axe-core integration, motion preferences, anti-patterns to never ship."
keywords: [accessibility, a11y, wcag, aria, focus-management, keyboard, screen-reader, axe-core]
references:
  - "WCAG 2.2 — https://www.w3.org/TR/WCAG22/"
  - "ARIA Authoring Practices Guide — https://www.w3.org/WAI/ARIA/apg/"
  - "WebAIM — Articles + Contrast Checker"
---

# Accessibility (WCAG 2.2 AA)

## Purpose

PrimitiveHub will be evaluated by enterprise procurement, security
review, and (for the paper) the academic community — accessibility is
not a "nice to have." This primitive teaches an AI agent to write UI
that passes WCAG 2.2 AA and follows the ARIA Authoring Practices Guide
patterns. It's also the right thing to do.

The most common AI-output failures: (a) custom Dialog/Menu/Combobox
without focus management, (b) color-only encoding for state, (c)
missing `aria-label` on icon buttons, (d) keyboard traps from
unfortunate `tabindex`, (e) ignoring `prefers-reduced-motion`.

## Core Principles (POUR)

- **Perceivable.** Information and UI must be presentable in ways
  users can perceive. Text alternatives for non-text; captions for
  audio; contrast 4.5:1 (3:1 for large text); content must work
  without sound or color alone.

- **Operable.** UI must be operable. Keyboard accessible for every
  function; no keyboard traps; visible focus indicator; enough time
  to read; no seizure-inducing flashing; multiple ways to find pages.

- **Understandable.** Information and UI operation must be
  understandable. Readable text; predictable behavior; input
  assistance; consistent navigation.

- **Robust.** Content must be robust enough to be interpreted by a
  wide variety of user agents, including assistive technologies.

## Decision Rules

### Focus + keyboard

- **IF a component is interactive THEN** it must be reachable by
  keyboard (Tab) AND operable from keyboard (Enter/Space). If it
  isn't, it's broken.
- **IF a component traps focus (modal, drawer) THEN** focus must
  return to the trigger on close. Tab cycles within; Escape exits.
  Radix primitives handle this; custom implementations must too.
- **IF a focus indicator is hidden THEN** restore it. Never `outline:
  none` without a `focus-visible:` replacement.
- **IF a `tabindex` is positive THEN** reject. Positive `tabindex`
  breaks document order. Use `tabindex="0"` for "focusable in flow" or
  `tabindex="-1"` for "programmatically focusable only."
- **IF a custom widget mimics a select / menu / combobox THEN** read
  the ARIA APG pattern for that widget before implementing. Don't
  invent.

### Color, contrast, motion

- **IF text contrast is below 4.5:1 (3:1 for large, 18pt+ or 14pt
  bold) THEN** reject. Run WebAIM contrast checker.
- **IF state is encoded by color alone THEN** add a non-color encoding
  (icon, text, position). "Red bar = error" alone fails colorblind
  users.
- **IF animation is added THEN** wrap with
  `@media (prefers-reduced-motion: reduce)` to disable for users who
  request reduced motion. Browser support: assume yes.
- **IF auto-rotating carousel exists THEN** provide pause control.
- **IF parallax / continuous motion is present THEN** provide a
  preference toggle.

### Forms

- **IF a form input exists THEN** it has an associated `<label>` (by
  `for=` or wrapping). Placeholder text is NOT a label.
- **IF a form input has validation THEN** errors are announced to
  screen readers via `aria-describedby` linking to the error message,
  or via `aria-live="polite"` on a status region.
- **IF a button submits a form THEN** `type="submit"`. Default button
  type is "submit" inside `<form>` but explicit beats implicit.
- **IF a required field exists THEN** mark with `aria-required="true"`
  AND visually with `*` or "(required)". HTML `required` attribute
  also works.

### ARIA usage rules

- **First rule of ARIA: don't use ARIA.** Native HTML semantics first
  (`<button>`, `<label>`, `<nav>`, `<main>`). ARIA only fills gaps.
- **IF a `<div>` is being made into a button THEN** stop. Use
  `<button>`. If you can't, the `<div>` needs `role="button"`,
  `tabindex="0"`, Enter/Space handlers, AND ARIA state attributes.
  Usually wrong; usually the right answer is `<button>`.
- **IF an icon-only button exists THEN** `aria-label` describes
  what it does. The icon's `aria-hidden="true"`.
- **IF a Dialog has no visible title THEN** the title still exists,
  wrapped in `<VisuallyHidden>`. ARIA requires it. Same for
  `Dialog.Description`.
- **IF tabs / menubar / tree / grid exist THEN** follow the ARIA APG
  pattern exactly. Arrow keys for navigation, Home/End for first/last,
  type-ahead where applicable.

### Screen reader testing

- **IF a complex widget is shipped THEN** test with a real screen
  reader (NVDA on Windows, VoiceOver on macOS, ORCA on Linux) before
  merge. Automated tools (axe-core) catch ~30% of issues; the rest
  are perception bugs.
- **IF announcements are needed THEN** use ARIA live regions:
  `aria-live="polite"` for non-urgent, `aria-live="assertive"` for
  urgent. Don't overuse assertive — it interrupts.

### Testing infrastructure

- **IF the project ships UI THEN** integrate `axe-core` /
  `@axe-core/playwright` into CI. Fails build on serious violations.
- **IF a Radix primitive is used THEN** trust its built-in
  accessibility but verify via testing — wrappers can break what
  Radix gives.

## Anti-Patterns

- **`<div onClick={…}>`** instead of `<button>`. Loses keyboard,
  loses screen reader semantics, loses focus.
- **`outline: none` without `focus-visible:` replacement.** Erases
  keyboard navigation.
- **Color as sole encoding.** Red/green/yellow without text or icon.
- **`<a href="#">` for buttons.** Loses semantics; "#" creates
  history pollution.
- **Custom select/dropdown without keyboard support.** Native
  `<select>` is accessible by default.
- **Hidden but tab-able content.** `display: none` removes from
  flow; `visibility: hidden` too; `aria-hidden="true"` removes from AT
  but not from tab. Use the right one for the intent.
- **`tabindex` > 0.** Breaks document order.
- **Auto-playing audio.** Loud, surprising, unfair.
- **Carousels without pause.** Moving content is hard to read.
- **`placeholder` as label.** Disappears on input, fails screen
  readers.
- **Auto-focus on page load away from top.** Confuses keyboard
  users.
- **Skipping `Dialog.Title` / `Dialog.Description`.** ARIA requires.

## Review Checklist

- [ ] Every interactive control is reachable + operable by keyboard.
- [ ] Focus indicator visible on every focusable element.
- [ ] Tab order matches visual reading order.
- [ ] Color contrast ≥ 4.5:1 (3:1 for large text).
- [ ] No state encoded by color alone.
- [ ] `prefers-reduced-motion` respected.
- [ ] All form inputs labeled; errors announced.
- [ ] Icon buttons have `aria-label`.
- [ ] Custom widgets follow ARIA APG patterns.
- [ ] Dialogs trap focus + return on close.
- [ ] Live regions for dynamic announcements.
- [ ] No `tabindex` > 0.
- [ ] No `outline: none` without `focus-visible:` replacement.
- [ ] Tested with at least one screen reader OR axe-core CI gate
      passing.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Default to semantic HTML. Reach for ARIA only when semantics fall
   short.
2. When wrapping or styling a Radix primitive, do not break its
   accessibility. Test focus, keyboard, and screen reader behavior.
3. When proposing color choices, run the contrast check mentally
   (or with a tool) and surface the ratio.
4. When proposing animations, propose the `prefers-reduced-motion`
   fallback at the same time.
5. For complex widgets, point to the ARIA APG pattern by name.

## Expected Output Format

For an interactive component:

```
PATTERN:    <ARIA APG pattern name or "native <element>">
KEYBOARD:   <Tab / Enter/Space / Arrow / Esc — what each does>
FOCUS:      <where focus goes on open/close>
LABELS:     <visible label, aria-label, aria-labelledby — explicit>
CONTRAST:   <ratio>
MOTION:     <reduced-motion handling>
SR TEST:    <which screen reader, what it announces>
```

## Examples

PrimitiveHub's Cards | Table view toggle on `/registry` uses
`role="radiogroup"` + `role="radio"` + `aria-checked`, supports
arrow-key navigation, and visible focus rings. Native pattern.

The CodeMirror editor inherits CodeMirror 6's accessibility (which is
strong) but our wrapper adds `phubEditorTheme` that respects the
text contrast minimum.

## References

- WCAG 2.2 specification: https://www.w3.org/TR/WCAG22/
- ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- WebAIM contrast checker: https://webaim.org/resources/contrastchecker/
- axe-core: https://github.com/dequelabs/axe-core
- Companion: `shadcn-ui-composition` (Radix accessibility built-in)
- Companion: `frontend-design-elite` (color + motion restraint)
