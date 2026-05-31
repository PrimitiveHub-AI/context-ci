---
name: Doctrine RFC
about: Propose a change to docs/doctrine.md, docs/brand-voice.md, or mid-quarter docs/okrs/*.md
title: 'doctrine-rfc: <one-line summary>'
labels: doctrine-rfc
assignees: ''
---

<!--
This template enforces ADR-0025 (doctrine versioning policy).
Breaking changes require ≥48h review window + named human reviewer ack
before the PR can merge. Non-breaking changes do NOT require this RFC —
they can land in a normal PR.
-->

## Which document(s) does this change?

- [ ] `docs/doctrine.md`
- [ ] `docs/brand-voice.md`
- [ ] `docs/okrs/<quarter>.md` (mid-quarter change after quarter has started)

## Current version

<!-- e.g. doctrine v0.1, brand-voice v0.1 -->

vX.Y

## Proposed version

<!-- Bump the second number for non-breaking accumulation.
     Bump the first number for breaking changes. -->

vX.(Y+1)  OR  v(X+1).0

## Is this breaking or non-breaking?

Per ADR-0025, a change is **breaking** if it:

- [ ] Adds, removes, or rewords an Operating Law
- [ ] Changes the named category statement
- [ ] Changes the named enemy
- [ ] Changes the ICP
- [ ] Changes the mission lines (operational or philosophical)
- [ ] Changes the decision algorithm
- [ ] Removes a "We are not …" entry
- [ ] Renames any "Layer of the Trust Runtime"
- [ ] Removes a banned-vocabulary entry from `brand-voice.md`
- [ ] Mid-quarter KR change

Per ADR-0025, a change is **non-breaking** if it:

- [ ] Tightens wording without changing meaning
- [ ] Adds examples or case studies
- [ ] Adds cross-references to other docs
- [ ] Adds new "We are not …" entries
- [ ] Adds killer-phrase or banned-vocabulary entries

**If any breaking box is checked → this RFC requires ≥48h review window
+ named human reviewer ack before the PR can merge. Otherwise, this RFC
is informational and the PR can land normally.**

## Reasoning

<!-- Why this change? What surfaced it? What does it unlock or prevent? -->

## Proposed diff

<!-- Either paste the diff inline, or link the PR. -->

## Review window

<!-- Required for breaking changes. -->

- Window opens: YYYY-MM-DD HH:MM (UTC)
- Window closes: YYYY-MM-DD HH:MM (UTC) (≥48h later)
- Named reviewer (required for breaking): @

## Acks

<!-- Reviewer ticks the box and signs here. Required before merge for breaking. -->

- [ ] @&lt;reviewer&gt; — acknowledged (date: YYYY-MM-DD)
