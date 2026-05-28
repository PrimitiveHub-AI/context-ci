---
spec_version: "0.1"
name: elite-mobile-design
version: 1.0.0
type: design
domain: product-design
author: PrimitiveHub Labs
license: CC-BY-4.0
tokens: 4200
token_budget: 5000
risk_level: low
content_digest: sha256:a3f8c2d1e9b74f6a3f8c2d1e9b74f6a3f8c2d1e9b74f6a3f8c2d1e9b74f6a3f8
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
use_when:
  - "Designing premium mobile app screens for emotional consumer products"
  - "Reviewing UX of identity, memory, ritual, or community products"
  - "Building habit-forming products that should NOT be addictive"
  - "Crafting microcopy and empty states for emotional consumer apps"
do_not_use_when:
  - "Backend API design"
  - "Legal or compliance writing"
  - "Data pipeline architecture"
  - "Pure utility apps where personality is noise (calculators, scanners)"
attestation: cci-v0.1
description: "Premium mobile design for emotional consumer products. Emotional hierarchy, ritual identity, touch ergonomics, non-addictive UX, microcopy with weight, empty states as second product."
keywords: [mobile-design, premium-ux, emotional-hierarchy, microcopy, empty-states, non-addictive]
---

# Elite Mobile Design

## Purpose

Teach an AI agent how to design premium emotional consumer mobile
applications without falling into the two failure modes that dominate
AI-generated UX: (a) generic social-app patterns lifted from Instagram
circa 2019, and (b) addiction-engineered dark patterns optimized for
session length. Premium emotional products — the category occupied by
the most enduring consumer apps — operate by a different logic. This
primitive captures that logic.

The product the agent designs should make the user feel **respected,
not extracted**. Premium consumer brands earn loyalty by treating
attention as the user's resource, not the platform's inventory.

## Core Principles

- **Emotional hierarchy precedes visual hierarchy.** What matters most
  to the user is rarely the largest thing on screen. A photo's
  emotional weight is in the face, not the timestamp; a memory's
  emotional weight is in the moment, not the metadata. Visual scale,
  weight, and color exist to *direct attention to the emotional anchor*
  — not to compete with it. Concrete: a profile screen for an emotional
  product places the user's chosen identity expression (avatar, name,
  one-line essence) at the optical center and reduces everything else
  to support. Followers count is information; it is not the anchor.

- **Ritual identity over performance identity.** The user's profile is
  not a billboard. It is a *ritual space* the user enters and tends.
  The interface should reward considered curation (carefully chosen
  saved moments, written notes, intentional empty spaces) and disincentivize
  performative content (vanity metrics displayed prominently, public
  comparison features, "viral" ranking). The design says: this is your
  garden, not your stage.

- **Mobile touch ergonomics is product, not afterthought.** Primary
  actions live within reach of the thumb resting on the device's
  bottom-right (or bottom-left for left-handers — respect the OS
  setting). The "thumb zone" is the lower 60% of the screen; the upper
  third is hostile territory and should hold only ambient navigation
  or passive content. Tap targets minimum 44pt × 44pt (iOS) / 48dp ×
  48dp (Android) — never smaller. Reachable distance from thumb at
  rest is more important than visual symmetry; lean primary actions
  toward the dominant hand.

- **Non-addictive engagement loops.** The product can be enjoyable
  without being compulsive. Tactics that ARE allowed: meaningful
  return-state (the user opens the app and finds something new that
  matters), considered notifications (batched, signal-rich, never
  fake-urgent), beautiful craft that rewards attention. Tactics that
  are NOT allowed: infinite scroll without natural stopping cues,
  artificial scarcity ("12 hours left!"), engagement-baiting "you might
  have missed" notifications, streak mechanics that punish absence,
  red badge notifications for low-priority events. The product's
  business model must not be "minutes per day."

- **Microcopy is the second product.** Every word the interface speaks
  is a brand voice decision. The register is calm, specific, and adult.
  "12 saved moments" is correct; "You've saved 12 awesome memories! 🎉"
  is not. "Continue" is fine; "Continue your journey" is not.
  Microcopy in premium emotional products earns trust one short
  sentence at a time. Read every label aloud. If it sounds like an
  AI marketing assistant wrote it, rewrite.

- **Empty states are the second product (cont.).** What the screen
  shows the *first time* the user arrives is the defining moment of
  the relationship. Empty states should explain what the space is
  *for*, demonstrate the smallest possible meaningful action, and
  invite without pressuring. They should never show illustrations of
  generic happy people, motivational quotes, or "Add your first
  whatever!" exclamation marks. Premium empty states are calm,
  literal, and respectful of the user's intelligence.

- **Premium restraint.** Three considered elements feel curated; ten
  elements feel busy. Remove rather than add. Remove a border, remove
  a color, remove a word, remove a feature — then check whether the
  meaning survives. If yes, ship the reduced version. Premium products
  are recognizable by what they leave out.

## Decision Rules

- **IF the design needs to communicate hierarchy THEN** use typography
  scale and white space first, color second, weight third. Reserve
  background fills and shadows for state, never decoration.
- **IF a primary CTA is placed THEN** verify it's in the thumb zone
  for one-handed use. Bottom-anchored when possible.
- **IF the design has more than three actions in one decision area
  THEN** consolidate, defer, or remove. The reader cannot prioritize
  more than three.
- **IF the user is being asked to make an emotional commitment
  (post, share, save, follow) THEN** the affordance should feel
  considered — slight friction, brief moment of confirmation,
  reversibility. Frictionless is appropriate for utility actions, not
  identity actions.
- **IF the screen needs to acknowledge user emotion (loss, grief,
  joy, milestone) THEN** the interface goes quiet. Less chrome, less
  animation, more space. Imitating emotion with color and motion
  reads as patronizing; making room for it reads as respect.
- **IF designing a notification THEN** justify each one in one
  sentence. If you cannot, do not send.
- **IF designing for a habit-forming behavior THEN** add a natural
  stopping cue. Infinite is not premium.
- **IF microcopy uses an exclamation mark, emoji (without explicit
  product purpose), or imperative ("Click here!") THEN** rewrite.

## Anti-Patterns

- **Generic social-grid profile.** Avatar + bio + post grid is the
  template every emotional product is *not*. Premium emotional
  products have profile shapes specific to their thesis: a *moments*
  product shows considered moments; a *ritual* product shows ritual
  state; an *identity* product shows expressed identity. Default
  templates signal lack of thought.

- **Dark-pattern engagement mechanics.** Red dot notifications for
  marketing, streak guilt, "X people just viewed this," loss-aversion
  framing on retention prompts. These read as exploitative even when
  effective and undermine the trust that premium products are built on.

- **Decorative illustrations.** Cartoon people, abstract blob shapes,
  hand-drawn icons depicting emotions. They convert emotional surface
  into cute-app surface. Premium emotional products either show real
  imagery (photographs of users' own moments) or abstract restraint
  (typography + space). Never illustrated avatars of fake users.

- **"You might be interested in…" content recommendations** in
  emotional contexts. The user came for something specific; algorithm
  injection feels like an advertiser at a memorial.

- **Animated splash screens, mascots, branded loaders.** Premium loads
  quietly. A subtle skeleton or a single accent pulse is the maximum
  acceptable celebration of waiting.

- **Microcopy that mimics human warmth via punctuation.** "Welcome
  back! 👋", "Almost there! ✨", "You did it! 🎉". The warmth is fake
  and the user knows. Real warmth comes from the product behaving as
  the user hoped, not from the punctuation.

## Review Checklist

- [ ] Identify the emotional anchor of every screen. Is it placed
      at the optical center with adequate space around it?
- [ ] Primary actions land in the thumb zone for one-handed reachability.
- [ ] Tap targets meet 44pt / 48dp minimums.
- [ ] No more than three actions in any single decision area.
- [ ] Notifications are justifiable in a sentence; non-justifiable
      ones are removed.
- [ ] No infinite scroll without natural stopping cues.
- [ ] No streak / loss-aversion mechanics.
- [ ] No red-dot notifications for marketing content.
- [ ] Empty states are calm, literal, instructive — no illustrations,
      no exclamations.
- [ ] Microcopy read aloud sounds adult, calm, specific.
- [ ] No decorative illustrations or stock-style emoji.
- [ ] Removed something during review and verified meaning survived.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before producing a layout, identify the emotional anchor of the
   screen in one sentence: "this screen is about [X]." Place that
   sentence at the top of the design output as the brief.
2. Verify primary actions land in thumb-reach zones. Annotate
   placement decisions explicitly.
3. Read every label aloud (mentally) and rewrite anything that sounds
   like AI marketing copy.
4. For each notification path designed, write the justification
   sentence next to it.
5. For each empty state, write the calm + literal version FIRST. Only
   add an illustration if explicitly requested AND it serves
   comprehension, not decoration.
6. Surface any tension between business-metric requests (DAU,
   session length, retention) and these principles. Document the
   tradeoff; do not silently comply.

## Expected Output Format

A screen design output should include, in order:

1. **Brief:** one sentence about what the screen is for and what its
   emotional anchor is.
2. **Layout:** description of where the anchor sits and what frames
   it. Reachability annotations for primary actions.
3. **Microcopy:** every visible string, written in the calm-adult
   register, with rejected alternatives noted briefly.
4. **Empty state:** the literal + calm version, separately specified.
5. **Notifications (if any):** justified in one sentence each.
6. **Anti-pattern check:** which dark patterns were considered and
   rejected, with reason.

## References

- Patagonia mobile app (e-commerce that respects users)
- Day One journal app (premium emotional consumer)
- Things 3 (premium personal productivity)
- Linear mobile (premium professional)
- "Designing for No" by Steven Hoober (touch ergonomics)
- Apple Human Interface Guidelines: Mobile, sections on Materials,
  Layout, Privacy
