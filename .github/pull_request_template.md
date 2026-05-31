<!--
This template enforces the decision algorithm in docs/doctrine.md.
Delete the comment block but DO NOT delete the sections below.
PRs that bypass these sections will be requested to refile.
-->

## Summary

<!-- 1-3 sentences. What this PR ships and why. -->

## Operating Law(s) served

<!-- Cite the law(s) from docs/doctrine.md § "The Operating Laws".
     Example: "Serves Operating Law 1 (no context without verification) —
     adds digest-pin check to the verify lib."
     If this PR serves none, justify the scope. -->

- Serves Operating Law(s):

## KR(s) served

<!-- Cite the KR(s) from docs/okrs/<active-quarter>.md.
     Format: KR-X.Y (status before → status after). -->

- KR served:

## Category-position check

<!-- "We are the Context Firewall, not a registry." Answer in one line. -->

> Does this PR preserve our category position?

- [ ] Yes — one-line explanation:

## Pre-launch posture

<!-- All four boxes must be checked. CLAUDE.md hard rule 5 is absolute. -->

- [ ] No public deploy triggered by this PR
- [ ] No social posts referenced or implied
- [ ] No domain references in indexable surfaces (`primitivehub.ai` / `cyberorca.sa` outside non-indexed docs)
- [ ] `noindex` defenses preserved (robots.txt, meta, `X-Robots-Tag`)

## Gate served (from docs/execution-plan.md)

<!-- Which acceptance gate (G-A through G-G) does this PR move forward? -->

- Gate:
- Acceptance criterion from that gate this PR satisfies:

## Related ADRs / specs

<!-- Link any ADR this PR depends on or supersedes; any spec section it implements. -->

-

## Brand-voice check (required for external-facing copy)

<!-- Only required for PRs touching landing pages, blog posts, READMEs,
     paper sections, conference abstracts, marketing copy. -->

- [ ] N/A — no external-facing copy in this PR
- [ ] No banned vocabulary present (checked against `docs/brand-voice.md`)
- [ ] At least one killer phrase used where appropriate
- [ ] On-voice / off-voice mirror table applied

## Test plan

- [ ]

---

<!-- Reminder of the decision algorithm from docs/doctrine.md:
     1. Does this serve an Operating Law? → priority
     2. Does this serve an active OKR? → schedule
     3. Does this preserve our category position? → maybe
     If a PR cannot pass step 3, the answer is no. -->
