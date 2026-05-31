# ADR-0022: `@primitivehub/verify` npm publish deferred to launch event

**Status:** Accepted
**Date:** 2026-05-31
**Related:** ADR-0015 (Trust Contract versioning), ADR-0020
(verify as reference implementation), `CLAUDE.md` launch posture,
`packages/verify/CHANGELOG.md`,
`.github/workflows/verify-publish.yml`

## Context

PR 5.5.4 shipped the source, tests, build, and reference-implementation
designation of `@primitivehub/verify`. Gate G-B in
`docs/execution-plan.md` requires the package "published to npm under
MIT" to be ticked.

Publishing now creates a load-bearing conflict with the project's
pre-launch posture rule (`CLAUDE.md`):

> **No public deploys, no social posts, no domain references** anywhere
> indexable until the paper publishes. `noindex` defenses are live
> (robots.txt + meta + X-Robots-Tag).

An npm package at `@primitivehub/verify` has the following
public-exposure properties that the noindex defenses cannot mitigate:

1. **npmjs.com is indexed by every major search engine within hours**
   and surfaces the package in `npmjs.com/search` immediately.
2. **The package name reveals the brand.** `primitivehub.ai` is owned
   but unannounced. A scoped npm package effectively pre-announces.
3. **The `homepage`, `repository`, `bugs` fields all point at the
   brand surface** (the GitHub repo + the eventual `primitivehub.ai`
   landing page). Even a stripped package.json would leak via
   `provenance` attestations linking back to the GitHub Actions run.
4. **npm unpublish has a 72-hour window**; after that, removal is
   semi-permanent and discoverable through replication mirrors
   (deps.dev, libraries.io, npm-stat, GitHub dependency graph).

Once published, the brand surface is committed. There is no clean
rollback.

## Decision

**Publish workflow infrastructure lands in this PR. Actual
publication is gated to the launch event via three independent locks:**

1. **`workflow_dispatch` only** — no `push:` or `tags:` triggers in
   `.github/workflows/verify-publish.yml`. The workflow cannot fire
   from any push to any branch; only an authenticated GitHub user with
   write access can dispatch it.

2. **Mandatory `LAUNCH-CONFIRMED` string input** — the workflow has a
   required `confirm_launch` input and a guard job that exits non-zero
   if the value is not exactly `LAUNCH-CONFIRMED`. Accidental
   "just-test-the-workflow" dispatches abort before any publish.

3. **GitHub Actions `environment: launch` protection** — the publish
   job targets a protected environment that requires reviewer approval
   on every run. (This requires a one-time human-only setup on the
   GitHub side: Settings → Environments → New environment named
   `launch` with required reviewers.)

All three locks must be defeated independently for a publish to
happen. None of them rely on the assistant — they are designed to
make an accidental publish (by a human in a hurry or by a future AI
agent that didn't read CLAUDE.md) implausible.

## What gets published when the locks are defeated

- npm package `@primitivehub/verify` at version `0.1.0`
- MIT license
- npm provenance attestation (via OIDC; no long-lived `NPM_TOKEN`
  secret needed — Trusted Publishing must be configured on the npm
  org side ahead of launch)
- `dist/`, `schema/`, `README.md`, `LICENSE`, `CHANGELOG.md` (matches
  `package.json` `files` allowlist; verified by CI `pnpm publish
  --dry-run`)

## What does NOT happen until launch

- No actual `npm publish` command runs.
- No npm registry entry exists.
- No `@primitivehub` npm org claim (deliberately deferred — claiming
  the org publicly creates the same brand-exposure problem the publish
  would).
- The sample external embed (`examples/verify-embed/`) uses a
  `file:../../packages/verify` dependency instead of `^0.1.0` from
  npm. This is swapped at launch in a one-line edit.

## Alternatives considered

1. **Publish under a neutral scope (`@cyberorca-labs/verify`) now.**
   Rejected. The whole point of the reference implementation is that
   third parties verify against `@primitivehub/verify` — a different
   name during launch week is a brand-fracturing footgun (newcomers
   pin the wrong package, search engines split signal). The 90-day
   delay until launch is cheaper than that cleanup.

2. **Publish as a private npm package.** Rejected. Private npm
   requires a paid org; the package is destined for public open
   source anyway; and a private package can't be consumed by the
   `examples/verify-embed/` sample for review.

3. **Skip the publish workflow entirely until launch.** Rejected.
   The workflow IS infrastructure that needs PR review + a dry-run
   in CI to prove it works. Landing it gated is safer than
   landing it under launch-week time pressure.

4. **Publish a "0.0.0-pre" placeholder to reserve the name.** Rejected.
   Still creates a public npmjs.com page that reveals the brand and
   is indexed by Google within hours. The reservation problem is
   real but it does not justify breaking the launch posture; we
   accept the (small) risk that the name is squatted in the
   intervening months and have a remediation playbook (npm
   dispute-resolution process exists for trademark/brand claims;
   `primitivehub.ai` domain ownership is documented dated proof of
   first use).

## Consequences

### Positive

- **Launch posture intact.** No public deploys, no brand exposure,
  no indexable surface created prematurely.
- **Launch-day action is one button.** Trusted Publishing is wired,
  the dry-run has proven the package builds cleanly, the size budget
  is verified at every CI run. Launch-day publishing is mechanical.
- **Three independent locks** make an accidental publish from a
  badly-scoped script or an AI-agent error practically impossible.
- **Gate G-B "published to npm" stays honestly open.** The
  acceptance criterion isn't ticked until the act happens; pretending
  otherwise would be the kind of "fake progress" the project's audit
  discipline explicitly forbids.

### Negative

- **Name squat risk.** Someone could claim `@primitivehub` on npm
  between now and launch. Mitigation: domain ownership + this ADR's
  publication date are dated proof of first use; npm has a brand
  dispute process; the cost of cleanup (a week of correspondence with
  npm) is much smaller than the cost of breaking launch posture.
- **CI cannot prove the publish path end-to-end** — only the
  dry-run. A pathological registry-rejection-on-real-publish bug
  could surface on launch day. Mitigation: dry-run catches every
  client-side packaging error; real-publish failures from registry
  are rare and well-understood (rate limit, name collision, missing
  org access).
- **Gate G-B closure is split** — the build half lands in PR 5.5.4
  and the publish half waits until launch. This requires the gate
  to be tracked as "infra ready, awaiting trigger" rather than
  "closed."

### Neutral

- **The same gating model applies to `@primitivehub/mcp-server` and
  `phub`.** PR 5.5.5 and PR 5.5.3 inherit this ADR's discipline
  without re-deciding it — both packages stay file:-linked in the
  monorepo until the launch publish event, at which point all three
  publish in a single coordinated dispatch.

## Launch-day playbook (one-shot, not for assistant execution)

When the paper is accepted and a launch date is locked:

1. (Human) Claim the `@primitivehub` npm org. Add the maintainer
   accounts. Enable 2FA on every account.
2. (Human) Configure Trusted Publishing on the org: link the
   `DevXYZx/primitivehub` repo + the
   `.github/workflows/verify-publish.yml` workflow path.
3. (Human) Create the `launch` GitHub Actions environment with the
   maintainer accounts as required reviewers.
4. (Human) Trigger `verify — publish to npm (gated)` workflow via
   workflow_dispatch with input `LAUNCH-CONFIRMED`. Approve the
   environment gate when GitHub prompts.
5. (Human) After publish succeeds, in a single PR: bump the embed
   example's dependency from `file:../../packages/verify` to
   `^0.1.0`; mark Gate G-B "published" item as closed in
   `docs/execution-plan.md`; add the `verify-v0.1.0` GitHub release
   pointing at the npm tarball.
6. (Human) Same dispatch flow for `@primitivehub/mcp-server` and
   `phub` (when their analogous publish workflows ship).

The assistant MUST NOT perform steps 1, 2, 3, 4. The assistant MAY
prepare the PR in step 5 once the human confirms the publish landed.

## References

- `CLAUDE.md` § "Hard rules" item 5 — pre-launch posture
- `docs/execution-plan.md` Gate G-B — Verifier Kernel acceptance
- ADR-0015 — Trust Contract versioning
- ADR-0020 — verify as reference implementation
- `.github/workflows/verify-publish.yml` — the gated workflow
- `packages/verify/CHANGELOG.md` — release notes
- `examples/verify-embed/` — file:-linked sample (swap to npm at launch)
