# ADR-0045: Product-first public launch + single public distribution repo

**Status:** Accepted
**Date:** 2026-06-07
**Supersedes (in part):** ADR-0022 (publishing deferred to launch — the
*timing* premise, not the *mechanism*)
**Related:** ADR-0020 (verify as reference implementation), ADR-0024
(SARIF + GitHub Action), `CLAUDE.md` § Hard rules 5, `docs/execution-plan.md`
Phase 10, `docs/roadmap.md` Phase 10, launch-posture memory.

## Context

ADR-0022 and `CLAUDE.md` Hard-rule #5 gated every public surface behind
a **paper-coordinated** launch event (Phase 10, ~Q3 2026). The premise
was: product and arXiv paper drop together; the paper is the launch
announcement.

On **2026-06-07** the owner (mhm) decided to **decouple**: launch the
product publicly now, product-first. The paper proceeds on its own
track, owned by mhm, on mhm's timeline — it is no longer a gate on
shipping the tools.

This ADR records that reversal as a deliberate, dated decision so future
sessions do not "restore" the pre-launch posture from the still-present
language in older docs. **It is not silent drift.** Where this ADR and an
older doc conflict, this ADR wins until itself superseded.

## Decision

### 1. Launch is product-first, not paper-gated.

The arXiv paper is no longer the launch event. The product ships when
the product is ready. Hard-rule #5's "until the paper publishes" clause
is replaced by "until the owner triggers the launch flip" (see §4).

### 2. Distribution: ONE public OSS repo — `primitivehub/context-ci`.

A single public repository holds all four downloadable artifacts:

```
primitivehub/context-ci          (PUBLIC, MIT)
├── packages/verify/             → npm @primitivehub/verify
├── packages/phub/               → npm @primitivehub/phub        (bin: phub)
├── packages/mcp-server/         → npm @primitivehub/mcp-server  (bin: primitivehub-mcp)
├── actions/phub-scan/           → GitHub Marketplace (composite action)
├── examples/                    → embedding + MCP integration samples
└── README.md                    → the canonical "download / install" surface
```

- **The dev monorepo (`DevXYZx/primitivehub`) stays private.** `apps/api`,
  `apps/web`, `docs/` (strategy, ADRs, OKRs, paper), `bench/corpus` are
  NOT mirrored. The public repo is *assembled from* the monorepo, not a
  fork of it.
- **Download channels:** npm is primary (`npm i @primitivehub/verify`,
  `npx @primitivehub/phub audit`). GitHub Releases mirror the tarballs +
  hold the action tag. This satisfies "a dedicated GitHub, users download
  from it."
- Rejected: per-package repos (more surface, fractures issues) and
  mirroring the whole monorepo public (leaks the playbook). See the
  topology decision 2026-06-07.

### 3. Assembly is reproducible, not a one-time copy.

The public repo is produced from the monorepo by a documented build step
that (a) copies the four artifact dirs, (b) rewrites internal `file:`
deps to published `^semver` ranges, (c) rewrites `repository`/`bugs` URLs
from `DevXYZx/primitivehub` to `primitivehub/context-ci`, (d) drops in
public-repo scaffolding (root README, CONTRIBUTING, CI + gated-publish
workflows). Re-runnable as the packages evolve.

### 4. The irreversible external flips stay HUMAN-ONLY.

ADR-0022's *mechanism* survives: the three-lock publish model
(`workflow_dispatch` + `LAUNCH-CONFIRMED` + `launch` environment) is
correct and stays. The assistant continues to **prepare** everything and
**must not** perform the irreversible, outward-facing actions:

- claim the `@primitivehub` npm org / configure Trusted Publishing,
- create the public GitHub repo / push to it,
- run the gated `npm publish` workflows,
- flip DNS, lift `noindex` (robots.txt / meta / `X-Robots-Tag`).

These expose the brand permanently (npm's 72h unpublish window, then
mirrored forever; search-index within hours). They are the owner's to
pull. This is a safety property, not a posture about the paper.

## Launch-day checklist (owner-executed, in order)

1. (Owner) Create public repo `primitivehub/context-ci`; push the
   assembled tree.
2. (Owner) Claim `@primitivehub` npm org; enable 2FA on all maintainers.
3. (Owner) Configure npm Trusted Publishing → `primitivehub/context-ci`
   + each publish workflow path.
4. (Owner) Create the `launch` GitHub Actions environment with required
   reviewers.
5. (Owner) Dispatch the three gated publish workflows with input
   `LAUNCH-CONFIRMED`; approve each environment gate.
6. (Owner) Publish the GitHub Action to Marketplace; tag `v0.1.0`.
7. (Owner) When the website surfaces + seed catalog are ready: flip DNS,
   lift `noindex`.
8. (Assistant, post-publish) Prepare the cleanup PR: swap `examples/`
   `file:` deps → `^0.1.0`, close the relevant Gate G-B/G-C/G-D publish
   items, add release notes.

## Consequences

**Positive:** ships the tools to users now; one repo to star/watch/file
issues; dev monorepo + strategy stay private; the decision is recorded so
sessions stop fighting it.

**Negative / accepted:** launching without the paper forgoes the
academic-credibility-first framing (owner's explicit call); the website's
own surfaces (Explorer, Forge round-trip, `/check`) and a seed catalog
are not yet built — §4 step 7 (the website flip) should wait on them even
though the package publish (steps 1–6) need not.

**Follow-on edits required** (tracked, not yet made): `CLAUDE.md`
Hard-rule #5, `docs/execution-plan.md` Phase 10, `docs/roadmap.md`
Phase 10, launch-posture memory — all reworded from "paper-gated" to
"owner-triggered, product-first." This ADR is the authority they cite.
