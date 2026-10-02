---
name: project-launch-posture
description: PrimitiveHub is pre-launch — domain primitivehub.ai is owned but unannounced. Launch coordinates with an arXiv research paper.
metadata: 
  node_type: memory
  type: project
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

**Domain owned:** www.primitivehub.ai — registered.

**>>> 2026-06-07 DECISION (mhm): launch is now PRODUCT-FIRST, not paper-gated. See [ADR-0045](/srv/primitivehub/app/docs/decisions/0045-product-first-public-launch-and-distribution-repo.md) (renumbered from 0042 on 2026-07-19 to resolve a collision with main's multi-session-isolation ADR). <<<**
The arXiv paper is decoupled and owner-owned (mhm runs it on mhm's own timeline — do not raise it as a gate or volunteer paper advice). Distribution is **one public OSS repo** holding verify + phub + mcp-server + the phub-scan action; users download via npm + GitHub Releases. The dev monorepo stays private.

**GitHub org (confirmed 2026-07-19 by mhm):** the real public org is **`PrimitiveHub-AI`** (https://github.com/orgs/PrimitiveHub-AI), so the distribution repo slug is **`PrimitiveHub-AI/context-ci`** — NOT the lowercase `primitivehub/context-ci` still written in ADR-0045 §2 and CLAUDE.md Hard-rule #5 (those docs are STALE on the slug; a doc sweep is pending). The npm scope stays `@primitivehub` (a separate namespace from the GitHub org; package names unchanged). `scripts/build-public-repo.sh` targets `PrimitiveHub-AI/context-ci` and, as of 2026-07-19, (a) rewrites every private-monorepo slug across the copied tree — previously `packages/*/CHANGELOG.md` + `packages/phub/src/cli.ts` shipped the private `DevXYZx/primitivehub` name to npm users — and (b) runs a leak-check (step 6) that fails the build if any monorepo-private surface or non-`PrimitiveHub-AI/context-ci` slug survives.

**REPO NOW EXISTS + SEEDED (2026-07-20):** mhm chose `context-ci` over `primitivehub` for the repo name (org=brand, repo=product convention). The empty `PrimitiveHub-AI/primitivehub` was renamed → `PrimitiveHub-AI/context-ci` and seeded with a fresh single-commit v0.1.0 tree (clean genesis — NO monorepo history; leak-check green). **CI is GREEN** (442 tests: verify 23, phub 387, mcp-server 32). To make the extracted package tests self-contained, `build-public-repo.sh` now VENDORS the public conformance suites (`docs/*/conformance/*` + `docs/cbom/schema.json`) + a placeholder `.primitivehub/phub.lock` sentinel — the sensitive adversarial corpus in `bench/` stays private. The package dogfood tests (phub + mcp-server `verify-before-load`/`tools`) were refactored in the MONOREPO to seal a tmp CLAUDE.md instead of depending on the real repo's sealed CLAUDE.md (portable; passes both repos), and one stale test-content bug was fixed (CCI-005 no longer fires on a *negated* npx instruction). Those monorepo edits (build script + 3 test files) may be uncommitted in the working tree. NOTE: force-pushing a rewritten root did NOT trigger the paths-filtered CI — had to `workflow_dispatch`; normal pushes trigger fine. **LAUNCHED 2026-07-20:** the owner flipped `context-ci` **PUBLIC** and published all three packages — `@primitivehub/{verify,phub,mcp-server}@0.1.0` — via the gated Actions workflows, **WITH npm provenance** (Sigstore attestations). GitHub `v0.1.0` release published; secret scanning + push protection + branch protection (no force-push/deletion) enabled post-flip. **`npx @primitivehub/phub audit` is live for the world.** Hard-won launch lessons: npm org is `primitivehub` (owner: muharemh); CI publish needs a classic **Automation** token (bypasses 2FA — a Publish/granular token → E403) set as GitHub secret `NPM_TOKEN`; the publish workflows were wired with `NODE_AUTH_TOKEN` env + `--provenance`; **npm provenance REQUIRES the source repo be PUBLIC** (private → E422, the final blocker). **WEBSITE LAUNCHED 2026-07-21:** primitivehub.ai is now PUBLIC and serving HTTP/2 200 via Cloudflare (both apex + www). Mechanism = host-level nginx (`/etc/nginx/sites-enabled/primitivehub`, LE cert valid → Aug 25 2026) terminating TLS on 0.0.0.0:443, proxying to the source-mounted **dev** web container (`pnpm dev`) on 127.0.0.1:3000. Go-live steps that worked: (1) `sudo systemctl enable --now nginx` (config had survived the takedown, just disabled); (2) Cloudflare A records apex+www → 178.105.164.250, Proxied, SSL/TLS = Full(strict); (3) **the real blocker was ufw** — explicit `DENY IN 80/443` rules sat ABOVE any appended allow, so `ufw allow 'Nginx Full'` was dead until `ufw delete deny 80/tcp` + `443/tcp`; ports 3000/9000 correctly stay DENY. noindex lifted (next.config.mjs header + layout.tsx robots + public/robots.txt) committed on branch `launch/noindex-lift-go-live` (local only unless pushed). OPEN FOLLOW-UPS: (a) LE cert auto-renewal (~Jul 26) will FAIL under Cloudflare-proxied mode → grey-cloud during renewal, or DNS-01, or CF Origin cert before Aug 25; (b) origin 80/443 open to 0.0.0.0/0 → harden to Cloudflare IP ranges so the public IP can't bypass the WAF; (c) production traffic is served by the DEV server (source-mounted, unoptimized) — prod build deferred (the prod-overlay `up` fails: box not logged into GHCR, falls back to local build + broke the stack once). Earlier pkg push used a classic PAT pasted in-chat (now burned — should be revoked).

The irreversible external flips (create public repo, claim `@primitivehub` npm org, run the gated `npm publish` workflows, flip DNS, lift `noindex`) remain **HUMAN-ONLY** — the assistant prepares everything but does not pull these triggers (ADR-0022 mechanism survives; ADR-0045 §4). The website flip (DNS/noindex) should still wait until Explorer + Forge round-trip + `/check` + a seed catalog exist; the package publish need not.
Follow-on doc edits still pending per ADR-0045: CLAUDE.md Hard-rule #5 (incl. the stale slug), execution-plan/roadmap Phase 10. The text below is the SUPERSEDED pre-2026-06-07 posture, kept for history.

---
*(historical — superseded 2026-06-07)*

**Coordinated launch model:** PrimitiveHub launched *alongside* a technical/research paper on arXiv. The paper was the launch announcement. Product + paper dropped together. This was an academic-credibility-first launch, not a SaaS-marketing-first launch.

**Paper positioning (per user, May 28 2026):**
> "Contributing to the research community + responding to the cybersecurity supply-chain attacks targeting enterprises by infecting repos/npm packages with malicious codes."

The unique angle: **AI-agent context is a new supply-chain attack surface.** Traditional supply-chain security (npm/PyPI provenance, SLSA, Sigstore) covers code dependencies. It does NOT cover the markdown skills, rule files, prompt instructions, and agent configs that AI agents now load directly into their context. PrimitiveHub is the trust layer for that surface.

**Why:** The user wants academic credibility + standard-setting positioning, not "another AI SaaS." The paper makes PrimitiveHub a *contribution* to a real problem the community is now wrestling with (Shai-Hulud worm, ua-parser-js, eslint-config-prettier, xz, recent npm typo-squatting waves). Launching as a product before the paper would dilute the framing.

**How to apply:**
- Treat every benchmark number as a future paper citation. If we can't reproduce it, label it `[demo]` (we already do via DemoDataBadge) and replace with real CI output before paper submission.
- Threat model = real document at `docs/threat-model.md` (incoming). Cited in the paper.
- Validation scanners must be evaluated against a curated corpus (known-bad + known-good primitives). This dataset becomes part of the paper's empirical contribution.
- The architecture diagram + system description in the paper must match what's actually deployed at submission time. No paper-only claims.
- Align primitive spec with existing supply-chain attestation work (in-toto, SLSA, OpenSSF Scorecard) — inventing parallel formats weakens the contribution.
- **No public references to the project on Twitter/LinkedIn/HN/etc. until paper publishes.**

**Open questions to confirm with user:**
- arXiv preprint only, or arXiv + a targeted venue (USENIX Security, IEEE S&P, ACM CCS, NDSS, RAID, ACSAC)?
- Rough timeline target?
- Co-authors / acknowledgments?
- The "skills + md files" the user is sending — are those part of the corpus for empirical evaluation, or separate?

Related: [[project-primitivehub]], [[feedback-no-fake-numbers]]
