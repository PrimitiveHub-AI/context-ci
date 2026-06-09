---
spec_version: "0.1"
name: discovery-and-design-discipline
version: 0.1.0
type: process
domain: product-engineering
author: PrimitiveHub Labs (synthesized 2026-06-09 from two external skills, consumed per Hard rule #6 — read into /tmp, audited clean via `phub audit`, distilled, sources deleted: obra/superpowers `brainstorming` SKILL.md + anthropics/knowledge-work-plugins `product-brainstorming` SKILL.md. Re-keyed from their generic/foreign-path defaults to PrimitiveHub's ADR + decision-algorithm + PR workflow. The upstream browser "visual companion" server feature was deliberately NOT adopted — it is an executable T5 surface and suggested `--host 0.0.0.0`, which violates Hard rule #3.)
license: CC-BY-4.0
tokens: 5200
token_budget: 6500
risk_level: low
content_digest: sha256:pending-cci-v0.1-attestation
compatible_agents:
  - claude-code
  - cursor
  - codex
  - windsurf
use_when:
  - "Before starting ANY new feature, component, surface, or behavior change (the design gate)"
  - "Exploring a product opportunity, GTM angle, or strategic direction (product/strategy mode)"
  - "Stress-testing an idea or assumption before it becomes an ADR or a PR"
  - "A request describes multiple independent subsystems and needs decomposition"
  - "Resolving 'the user pasted an idea and wants it built' without a clarified design"
do_not_use_when:
  - "A mechanical, fully-specified change (rename, dep bump, typo, lint fix) with no design surface"
  - "Mid-implementation of an already-approved design (this is the before-step, not the build-step)"
  - "Pure research questions that need data, not ideation (go gather the data instead)"
attestation: cci-v0.1
description: "Pre-implementation discovery + design discipline for PrimitiveHub. Two modes on a shared core: (A) product/strategy exploration as a sharp thinking-partner with named frameworks (HMW, JTBD, OST, First Principles, SCAMPER, OODA, reverse brainstorming) and a Frame→Diverge→Provoke→Converge→Capture arc; (B) a scaled design gate turning a feature idea into a validated design → ADR/PR before any code. Diverge before converge; one question at a time; never anchor on the first idea."
keywords: [brainstorming, discovery, design-gate, product-strategy, ideation-frameworks, jtbd, scamper, ooda, decision-algorithm, adr]
references:
  - "obra/superpowers — brainstorming skill (idea → validated design → spec gate)"
  - "anthropics/knowledge-work-plugins — product-brainstorming skill (PM thinking-partner + frameworks)"
  - "docs/doctrine.md — the decision algorithm (Operating Law → OKR → category position)"
  - "docs/decisions/ — ADRs are this project's spec/design-doc artifact"
---

# Discovery & Design Discipline

## Purpose

PrimitiveHub's single most-stated working value is *being consulted on
direction* — the user "prefers two clarifying questions to one wrong
assumption" (CLAUDE.md § When in doubt). This primitive operationalizes
that value into a repeatable discipline for the moment **before**
implementation: how to explore an idea, challenge it, and converge on a
design that's worth building.

It distills two external skills into one engine with two modes:

- **Mode A — Product / strategy exploration.** Be a sharp thinking
  partner, not a deliverable generator. Used when the question is
  *what should we build / pursue / bet on* (opportunity, GTM, strategy,
  positioning). Maps onto the GTM framing in
  [[feedback-product-not-paper]].
- **Mode B — Feature → validated design → gate.** Turn an approved idea
  into a design scaled to its complexity, captured in the right artifact
  (an **ADR** for load-bearing choices, the **PR description** for
  lighter ones), and *approved before any code is written*.

Both modes run on the same core: **diverge before you converge, one
question at a time, never anchor on the first idea, capture what
matters.** The most common failure this prevents: building the wrong
thing well because the idea was never examined.

## The shared core (both modes)

- **One question at a time.** Don't overwhelm with a battery of
  questions. Use the `AskUserQuestion` tool (multi-select where the
  choices are genuinely independent); prefer multiple-choice over
  open-ended when you can frame the options. Reserve it for decisions
  that are genuinely the user's to make — not for facts you can verify
  in the repo yourself.
- **Diverge before you converge.** The first 3–5 ideas are the ones
  anyone would think of. Generate more before evaluating any.
- **Never anchor on the first idea.** If the user leads with a solution,
  acknowledge it, then ask "what else could solve this?" — always
  surface 2–3 approaches with a recommendation and reasoning.
- **YAGNI ruthlessly.** Remove unrequested features from every design.
- **Decompose oversized scope first.** If the request spans multiple
  independent subsystems, flag it *before* spending questions on
  details. Help split into sub-projects, each with its own
  design → ADR/PR → implementation cycle.
- **Capture, or it never happened.** A brainstorm with no recorded
  output is wasted. The output is an ADR, a PR plan, or at minimum a
  written summary of decisions + assumptions-to-test.

## Mode A — Product / strategy exploration

You are a sharp product/design partner: opinionated, challenging, and
willing to bring unexpected angles. Your job is to think *alongside*,
not to hand over a list.

**Sub-modes (shift as the conversation evolves):**

- **Problem exploration** — who has this problem, what do they do today,
  symptom vs root cause (keep asking "why" until something structural),
  how it varies by segment. "What happens if we do nothing — who
  suffers?"
- **Solution ideation** — generate 5–7 distinct approaches before
  evaluating. Vary by scope (tweak vs big bet), type (product vs process
  vs policy), timing (quick win vs long bet). Include one "do the
  opposite" and one "remove something instead of adding."
- **Assumption testing** — list every assumption (stated + unstated),
  name the *riskiest* one (the one that kills the idea if wrong), and
  the cheapest way to test it before building. Argue the strongest case
  *against* the idea.
- **Strategy exploration** — map the playing field, think in bets
  (what/odds/payoff), second-order effects, competitive response,
  timeframes (3mo / 12mo / 3yr).

**Frameworks (thinking tools, not templates — pull one when it moves the
conversation; never dump the whole list):**

- **How Might We** — "How might we [outcome] for [user] without
  [constraint]?" Generate 5–10 from one problem; avoid too-broad and
  solution-in-disguise framings.
- **Jobs-to-be-Done** — "When [situation], I want to [motivation] so I
  can [outcome]." The job is stable; solutions change. Ask "what did
  they fire to hire this?"
- **Opportunity Solution Tree** — outcome → opportunities (evidence-
  backed) → multiple solutions → multiple cheap experiments.
- **First Principles** — decompose to fundamental truths; question each
  ("law of physics or convention?"); rebuild. For when the team is stuck
  in incremental thinking.
- **SCAMPER** — Substitute / Combine / Adapt / Modify / Put-to-other-use
  / Eliminate / Reverse, applied to an existing surface.
- **OODA** — Observe / Orient / Decide / Act; the edge is *tempo*, not
  the steps. Reframes decisions as reversible. Use when the team
  over-deliberates or a competitive window is closing.
- **Reverse brainstorming** — "how would we make this *worse*?" then
  invert each. People spot what's wrong more easily than what's right.

**Session arc:** Frame (boundaries, why-now, what-we-know, constraints,
what-good-looks-like) → Diverge (no judgment) → Provoke ("strongest
argument against this? who hates it? what's the 10x-more-ambitious
version?") → Converge (group into themes; evaluate against user impact,
feasibility, strategic alignment, evidence — **and run the
[[doctrine]] decision algorithm**: Operating Law → active OKR → category
position) → Capture (top 2–3 ideas, the biggest unknown per idea, the
cheapest test, what was explicitly set aside).

**Be a good partner — do:** be opinionated ("B is stronger because…");
challenge constructively ("that assumes X — confident?"); bring
cross-industry analogies and counterexamples; match energy before poking
holes; ask the next question; name the trap when you see one.
**Do not:** dump frameworks; hand over a list instead of a conversation;
agree with everything; evaluate feasibility during divergence; anchor on
the first idea; confuse the brainstorm with the decision.

## Mode B — Feature → validated design → gate

The build-time discipline. **No implementation skill, scaffold, or code
until a design has been presented and approved — scaled to the change's
complexity** (see the scaled-gate rule below).

**Checklist (run in order):**

1. **Explore context** — read the relevant files, docs, recent commits,
   and the primitives CLAUDE.md routes for this surface. Follow existing
   patterns; this codebase's conventions are authoritative.
2. **Scope check / decompose** — if it spans independent subsystems,
   decompose before detailing.
3. **Clarify** — one question at a time (purpose, constraints, success
   criteria) via `AskUserQuestion`.
4. **Propose 2–3 approaches** — trade-offs + your recommendation first,
   with reasoning.
5. **Present the design in sections** — scale each section to its
   complexity (a sentence for the trivial, up to a few hundred words for
   the nuanced). Cover what's relevant: architecture, components, data
   flow, error handling, testing, tenant/security implications. Ask
   after each section whether it's right.
6. **Capture in the right artifact** — for a **load-bearing** decision,
   write an **ADR** in `docs/decisions/NNNN-*.md` (status, alternatives,
   consequences — the project's spec/design-doc; never `--squash`
   released ADRs). For a **lighter** change, the design lives in the
   **PR description**. Pass external copy through
   [`docs/brand-voice.md`](../../../docs/brand-voice.md).
7. **Self-review with fresh eyes** — scan for placeholders/TBDs,
   internal contradictions, scope creep, and any requirement that could
   be read two ways (pick one, make it explicit). Fix inline. For a
   large/risky design, dispatch an `Agent` (general-purpose) reviewer
   that flags only issues that would cause real implementation
   problems — not stylistic nits. Cross-check against
   [[feedback-audit-methodology]].
8. **User gate** — present the captured design and wait for explicit
   approval before implementing. This is the same gate as Hard rule
   "no merging without the user's explicit OK," moved earlier.
9. **Hand off to implementation** — one logical change per PR, branched
   from `main`. Track the build with `TodoWrite`. *Then* load the
   stack-specific primitives CLAUDE.md routes for the surface.

## The scaled design-gate (project rule, adapted)

Upstream ships a literal HARD-GATE ("no code on ANY change until a
written design is approved, regardless of simplicity"). PrimitiveHub
adopts the **scaled** form (owner's call, 2026-06-09):

- **Always present a design and get approval before implementing** — even
  for "simple" work, where unexamined assumptions waste the most effort.
- **Scale the artifact to the change.** Trivial change → a sentence of
  design inline. Feature → a design walk-through + PR description.
  Load-bearing / architectural → a full **ADR**.
- **Exempt:** mechanical, fully-specified edits with no design surface
  (rename, dep bump, typo, lint fix) — listed in `do_not_use_when`.
- This is the *consult-on-direction* value made mechanical; it does not
  replace the merge gate, it precedes it.

## Anti-Patterns

- **"Too simple to need a design."** Every change states its design,
  even if it's one sentence. Simple changes hide the costliest unexamined
  assumptions.
- **Solutioning before framing.** Jumping to "we should build X" before
  the user problem and the evidence are named. Slow down; frame first.
- **The feature-parity trap.** "Competitor has X, so we need X" is
  copying, not brainstorming. Ask what *need* X serves and whether
  there's a better way to serve it.
- **Framework dumping.** Marching a conversation through every framework
  as a checklist. Pull one when it helps; otherwise stay conversational.
- **The one-idea brainstorm.** Arriving with a solution and calling it
  brainstorming. Acknowledge, then push for alternatives.
- **Anchoring on constraints during divergence.** "We can't because of
  Y." Explore freely first; test feasibility at convergence.
- **Analysis paralysis.** Endless divergence, no convergence. Prompt:
  "If you had to pick one direction right now, which and why?"
- **Brainstorming when you should be researching.** If the session
  circles because nobody knows the answer, stop and name the research
  needed. (Ties to [[feedback-no-fake-numbers]]: don't invent the answer
  to converge.)

## Decision Rules

- **IF a request asks to build something without a clarified design
  THEN** enter Mode B step 1 — explore context and clarify before
  proposing, never code first.
- **IF the user pastes an idea/prompt from another assistant THEN**
  evaluate before executing ([[user-workflow]]); brainstorm intent in
  Mode A if the goal is fuzzy, design in Mode B once it's clear.
- **IF the question is "what/whether to build" (opportunity, GTM,
  strategy) THEN** use Mode A; treat PrimitiveHub as a present-day
  product, not the paper ([[feedback-product-not-paper]]).
- **IF the request spans multiple independent subsystems THEN** stop and
  decompose before detailing any one of them.
- **IF a decision is load-bearing THEN** capture it as an ADR and run the
  [[doctrine]] decision algorithm before converging; if it can't pass
  "preserve our category position," the answer is no.
- **IF converging THEN** name, for each surviving idea, the biggest
  unknown and the cheapest way to resolve it before building.
- **IF you're tempted to ask five questions at once THEN** pick the one
  that most reduces uncertainty and ask only it.

## Re-key map (upstream → PrimitiveHub)

| Upstream artifact / step | PrimitiveHub equivalent |
|---|---|
| `docs/superpowers/specs/<date>-design.md` | **ADR** in `docs/decisions/` (load-bearing) or the **PR description** (lighter) |
| Invoke `writing-plans` skill (terminal) | One-logical-change **PR** + `TodoWrite` build plan |
| `elements-of-style:writing-clearly` skill | [`docs/brand-voice.md`](../../../docs/brand-voice.md) filter |
| Spec-reviewer subagent | `Agent` (general-purpose) review, gated by [[feedback-audit-methodology]] |
| Convergence evaluation criteria | The [[doctrine]] decision algorithm (Law → OKR → category) |
| Browser "visual companion" server | **Not adopted** — executable T5 surface; violates Hard rule #3 (`--host 0.0.0.0`) |

## Companion primitives

| When the discovery touches… | Load alongside |
|---|---|
| A strategic / category / positioning question | [[doctrine]] + `docs/positioning.md` + `docs/vision.md` |
| A frontend feature about to be designed | [`frontend-design-elite`](./frontend-design-elite.md), then the surface's stack primitives |
| A backend / data / tenant design | [`ddia-multi-tenant`](./ddia-multi-tenant.md), [`security-engineering-supplychain`](./security-engineering-supplychain.md) |
| Picking the right primitive set for the chosen build | [`primitive-cross-reference-index`](./primitive-cross-reference-index.md), capped by [[feedback-bloat-control]] |

**Precedence:** this primitive governs *whether and what* to build and
*when to stop and ask*. Once a design is approved, the stack and
security primitives govern *how*. On any conflict, the
[[feedback-priority-stack]] ordering wins (security > truth > tenant >
spec > stack > data > a11y > taste > velocity).

## References

- Source skills (consumed + deleted per Hard rule #6, audited clean):
  `obra/superpowers` → `skills/brainstorming/SKILL.md`;
  `anthropics/knowledge-work-plugins` →
  `product-management/skills/product-brainstorming/SKILL.md`.
- [`docs/doctrine.md`](../../../docs/doctrine.md) — the decision
  algorithm this primitive routes convergence through.
- [`docs/decisions/`](../../../docs/decisions/) — ADRs, the design
  artifact of record.
