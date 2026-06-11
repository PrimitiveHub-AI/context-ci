# Launch-night checklist

> **Status:** Pre-positioned. The owner reads this top-to-bottom on
> launch night. Every box is either an irreversible flip (human-only
> per CLAUDE.md hard rule #5 + ADR-0022 three-lock) or a verification
> the flip succeeded. The assistant cannot pull any of these triggers.
>
> **Companion artefacts:**
> - [`demo-script.md`](./demo-script.md) — the 5-minute recording
> - [`SECURITY-BOUNTY.md`](../../SECURITY-BOUNTY.md) — the bounty programme
> - [`docs/usage/02-trust-contract.md`](../usage/02-trust-contract.md) — user-facing Trust Contract
> - The on-host scripts: `scripts/check-pre-launch-posture.sh`, `scripts/build-public-repo.sh`

## 0. Twenty-four hours before launch

| ☐ | Task | Owner | Verification |
|---|------|-------|--------------|
| ☐ | Lock the engine: no detector PRs merged in the final 24h. Floor is final | parallel session | `git log feat/corpus-steering-wheel --since="24 hours ago"` shows zero detector commits |
| ☐ | Re-stamp `.primitivehub/phub.lock` against the final tree | parallel session | `phub audit --check-lock` exits 0 |
| ☐ | Re-run `bench/scripts/gate.sh` against the final tree | parallel session | Green; per-detector F1 matches `bench/baseline/<latest>-ts.json` |
| ☐ | Re-stamp `apps/web/lib/evaluation.data.json` from the final baseline | engineer | `pnpm --filter primitivehub sync:evaluation` reports up-to-date |
| ☐ | Record the demo video against `docs/launch/demo-script.md` | owner | Final cut hits 5:00 ± 5s; captions burned in |
| ☐ | Generate the public-repo bundle | owner | `scripts/build-public-repo.sh` produces a clean tree under `scripts/public-repo/` |
| ☐ | Pre-tape PGP key + `security@primitivehub.ai` MX records ready | owner | `dig MX primitivehub.ai` shows the records cued (TTL low) |
| ☐ | Status page final review | engineer | `/status` shows all 7 services operational; `isSample = true` is still set per `lib/status.ts` |

## 1. T-minus 1 hour: the three locks (ADR-0022)

> Each lock is an irreversible flip. **The assistant cannot run any of
> these.** The owner runs each in sequence and verifies before moving
> on.

### Lock 1: distribution

| ☐ | Step |
|---|------|
| ☐ | Create the public GitHub repo `primitivehub/context-ci` |
| ☐ | Push the bundle from `scripts/public-repo/` |
| ☐ | Verify `README.md`, `LICENSE`, `SECURITY.md`, `SECURITY-BOUNTY.md` render correctly |
| ☐ | Claim the GitHub Actions Marketplace listing for `primitivehub/phub-scan@v0.1` |

### Lock 2: package registry

| ☐ | Step |
|---|------|
| ☐ | Claim the `@primitivehub` npm org |
| ☐ | Run the gated `npm publish` workflows: `@primitivehub/verify`, `@primitivehub/phub`, `@primitivehub/mcp-server` |
| ☐ | Verify each package resolves: `npm view @primitivehub/<pkg>` returns metadata |
| ☐ | Smoke each from a fresh shell: `npx @primitivehub/phub --version` returns `v0.1.0` |

### Lock 3: web posture

| ☐ | Step |
|---|------|
| ☐ | Flip DNS for `primitivehub.ai` to the production Hetzner CX22+ |
| ☐ | Wait for resolver propagation (TTL-dependent) |
| ☐ | Verify HTTPS cert issuance via Caddy/Traefik logs |
| ☐ | Lift `noindex` defenses in **exactly** this order: `public/robots.txt` → `apps/web/app/layout.tsx` robots metadata → `next.config.mjs` `X-Robots-Tag` header |
| ☐ | Verify the lift: `curl -I https://primitivehub.ai/` no longer shows `X-Robots-Tag: noindex`; `https://primitivehub.ai/robots.txt` reads the post-launch policy |
| ☐ | Flip status snapshot: edit `apps/web/lib/status.ts` to set `isSample = false` and point at the live backend |

## 2. T-zero: announce

| ☐ | Step |
|---|------|
| ☐ | arXiv submission goes live; capture the arXiv ID |
| ☐ | Update `paper/main.tex` BibTeX URL to the arXiv ID |
| ☐ | Hosted demo video published at `primitivehub.ai/launch/demo` |
| ☐ | Single-tweet announcement from the owner's account: doctrine § Category statement verbatim + arXiv link + repo link |
| ☐ | Single LinkedIn post (same content) from the owner's account |
| ☐ | Submit Show HN with the title *"PrimitiveHub: the Context Firewall for AI agents"* + arXiv + repo |

## 3. T-plus 1 hour: verify the post-launch posture

| ☐ | Task | Verification |
|---|------|-------------|
| ☐ | `/check` operational on the live host | `curl -X POST https://primitivehub.ai/api/v1/check -d '{"mode":"auto","input":"# test"}'` returns a verdict |
| ☐ | Sigstore signing operational | One end-to-end `phub publish` against staging Sigstore succeeds |
| ☐ | `@primitivehub/verify` resolves on a fresh box | `npx @primitivehub/verify --version` |
| ☐ | GitHub Action listed | Marketplace search for `primitivehub/phub-scan` returns the listing |
| ☐ | MCP runtime gate operational | `claude mcp call primitivehub verify_before_load --subject "skill:test@0.1"` returns a verdict |
| ☐ | Status page reads non-sample | `/status` no longer renders the `schema staged` badge |
| ☐ | OG previews render | Paste a `primitivehub.ai/top-10` link in Slack; preview shows the CCI chip strip |

## 4. T-plus 24 hours: the watch

| ☐ | Task |
|---|------|
| ☐ | Bug bounty intake monitored: `security@primitivehub.ai` triaged at least once |
| ☐ | First external `phub` install: someone runs `npx @primitivehub/phub audit` outside the team |
| ☐ | First external `/check` paste: a non-team request hits the API |
| ☐ | First Show HN comment thread: triage feedback |
| ☐ | First Twitter quote-RT: triage feedback |
| ☐ | Status page metrics: still operational; if not, file an incident through the existing pipeline |
| ☐ | Daily corpus baseline ran green (`bench/scripts/gate.sh` cron) |

## 5. Rollback paths (use only if necessary)

> The master rollback procedure ships in Round 8 PR 8.2 (`launch-day
> runbook + master rollback procedure`). What follows is the quick
> map; the full procedure is canonical.

| If this breaks | Roll back by |
|---|---|
| npm publish reveals a fatal bug | `npm deprecate @primitivehub/<pkg>@<version> "rolling back"`; do not unpublish (Sigstore + Rekor entries are immutable) |
| Public repo has a leak | Force-push corrected tree; rotate any leaked credential immediately; file `docs/bugs.md` post-mortem within 30 days |
| DNS routes incorrectly | Revert DNS records to the pre-launch posture (Hetzner staging IPs) |
| `noindex` flip was premature | Restore the three layers in reverse order: `next.config.mjs` X-Robots-Tag → `apps/web/app/layout.tsx` robots metadata → `public/robots.txt` |
| Sigstore staging used instead of prod | Re-sign affected primitives against production Sigstore; submit a `docs/bugs.md` entry naming the affected versions |
| Status page misrepresenting state | Revert `isSample = true` if the live backend is misreporting; communicate the rollback in the next snapshot's incident timeline |

## 6. Pre-flight assistant check (run by an engineer before T-1h)

The assistant prepares every artefact above. The engineer verifies
the artefacts exist and are version-correct:

| ☐ | Artefact | Path |
|---|---|---|
| ☐ | Demo script frozen | `docs/launch/demo-script.md` |
| ☐ | Bounty programme live | `SECURITY-BOUNTY.md` + `/security` |
| ☐ | Trust Contract user-doc | `docs/usage/02-trust-contract.md` |
| ☐ | OG image generators ship | `apps/web/app/opengraph-image.tsx` + per-route variants |
| ☐ | Status page schema final | `apps/web/lib/status.ts` |
| ☐ | Public repo build script | `scripts/build-public-repo.sh` |
| ☐ | Pre-launch posture audit | `scripts/check-pre-launch-posture.sh` returns clean before T-1h |
| ☐ | Paper sources ready for arXiv | `paper/main.tex` + `paper/sections/*.tex` + `paper/references.bib` |
| ☐ | Bug bounty Hall of Fame placeholder | `docs/security-hall-of-fame.md` exists (empty page is fine) |

## 7. Communications discipline

The launch message is the locked thesis verbatim. The owner does not
deviate. The assistant cannot send any of these messages.

> **Announcement copy (single line):** PrimitiveHub is the Context
> Firewall for AI agents. Every byte of agent context — AGENTS.md,
> SKILL.md, .cursor/rules, mcp.json — verified against the Context
> CI Top 10 before the agent reads it. Open source, paper-grade,
> measured. arXiv: \<id\>. Repo: github.com/primitivehub/context-ci.

Banned phrasing on launch day: any superlative ("revolutionary,"
"world-class," etc. per `docs/brand-voice.md` § Banned vocabulary);
any unmeasured number; any competitor name in a hostile frame.

## 8. After the dust settles

| ☐ | Task | Owner | Deadline |
|---|------|-------|----------|
| ☐ | Write the launch retro into `docs/bugs.md` if anything broke | engineer | T+7d |
| ☐ | Process the first bug-bounty queue: triage decisions + reward calibration | owner | T+30d |
| ☐ | Pay out retroactive pre-launch bounty reporters | owner | T+30d |
| ☐ | Populate `docs/security-hall-of-fame.md` with the first cohort of named reporters (with consent) | owner | T+60d |
| ☐ | First academic citation tracked: arXiv stats + Google Scholar | owner | T+30d |
| ☐ | Update `docs/okrs/2026-Q3.md` retros with what hit vs missed | owner | T+30d |

## 9. The boundary

This checklist exists because the assistant prepares every artefact
the launch needs and **cannot pull any of the irreversible
external triggers**. Specifically the assistant cannot:

- Create or push to the public GitHub repo
- Claim the `@primitivehub` npm organisation
- Run any gated `npm publish` workflow
- Flip DNS or modify any `noindex` defence
- Send any external announcement (Twitter / LinkedIn / Show HN)
- Submit to arXiv

These belong to the owner. The assistant is here to make every flip
a confirmation step, not a drafting step.

---

**Checklist version:** v0.1
**Last reviewed:** 2026-06-10
**Owner:** `mhm@cyberorca.sa`
