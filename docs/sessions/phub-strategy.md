---
id: phub-strategy
owns: [docs/positioning.md, docs/vision.md, docs/okrs, docs/roadmap.md, docs/decisions]
depends_on: []
touches: [phub-web, phub-check-engine, phub-corpus-eval, phub-cli, phub-platform]
transcript: transcripts/phub-strategy.jsonl
updated: 2026-10-02
---

## Charter
No-code session. Sets scope, priority, and positioning for all others: category creation,
launch posture, GTM, and the parked reputation-layer decision.

## Current state (2026-10-02)
- Posture: PRODUCT-FIRST (ADR-0045). PrimitiveHub = product solving a present-day problem
  (GitHub-for-AI-context); the paper is NOT the gating event, owner-owned, don't raise it.
- Distribution: public repo PrimitiveHub-AI/context-ci + npm scope @primitivehub.
  Some docs still say lowercase primitivehub/context-ci (stale).
- Positioning explored: "between PrimitiveHub, skills.sh, and coolify.io"; hero = /check + phub CLI.

## Recommendation (2026-10-02 — ADVISORY, owner ratifies before any build)
**Option (b) now, architected (a)-ready.** Build internal catalog substrate; defer the public
verdict API (and its liability) behind the human-only irreversible flip. Reject (c) as an
end-state (undifferentiated — GitHub ships a convenience scanner in a quarter), but you get its
perf-cache for free inside (b).

Why (priority stack: security > truth > tenant > … > velocity):
- (a) public reputation layer = publishing verdicts about third-party content you don't own →
  real legal/trust liability. Not a pre-launch move. Keep it *reachable*, not *shipped*.
- (b) builds the moat substrate — the seed catalog the DNS/noindex flip is gated on — with no
  liability, and stays flippable to (a). Best risk-adjusted compounding.

The one move that forecloses no option (do this regardless of a/b/c):
- **Re-key the verdict cache on resolved CONTENT digest, not `raw_input`** (verified today:
  apps/api/checks/results.py:107 keys on `VERDICT_ENGINE_VERSION\0mode\0raw_input`). This is a
  strict fix — kills stale URL verdicts within TTL + enables cross-URL dedup — AND is the exact
  plumbing (a) needs later. Deferred in ADR-0044; un-defer it.
- Multi-file identity (repo/skill) → hash the `phub.lock` manifest as the tree digest; wire to the
  existing durable `GET /api/v1/trust/by-digest/<hash>` (ADR-0013).
- Cache key versions on detectors (Top10) AND scoring engine (ADR-0023 lockstep) — else immutable
  cache serves stale-safe verdicts, a false-negative vector.
- Demand/popularity → eviction + pre-warm ONLY, never the verdict. No "trending skills" surface.

## Open items
- [ ] **OWNER RATIFY** the recommendation above (parked since 2026-07-21). Until ratified, build
      only the option-neutral plumbing (digest re-key), nothing public-facing.
- [ ] On ratify → hand the digest re-key task to phub-check-engine (its ledger open-item #3).
- [ ] Reconcile stale repo-name references (lowercase → PrimitiveHub-AI).
- [ ] Priority stack when primitives clash: security > truth > tenant > spec > stack > data > a11y > taste > velocity.
- [ ] **OWNER DECISION — defer auth entirely (ADR-0047 scope) `[from: phub-platform]`.** Verified
      2026-10-03: Authentik (server+worker) is LIVE in dev *and* prod (containers up 4 months,
      healthy), not a dormant surface — `DEV_AUTH_BYPASS` was retired (Step 7), every read endpoint
      is behind `requires_auth` (apps/api/primitivehub_api/auth.py). Proposal on the table: make
      `/check` + `/Forge` **anonymous-public** and retire the login path, so auth becomes truly
      deferred per a strict ADR-0047 reading. This is a product+liability call (anonymous abuse /
      rate-limit / cost exposure) spanning phub-web + phub-check-engine, NOT a platform flip. On
      ratify, platform will profile-gate authentik (keep HELD, never delete) + drop OIDC from the
      critical path. Until ratified, authentik stays always-on.
- [ ] **`[from: phub-web]` 2026-10-24 — brand rename "Forge" → "Skill IDE" + two-flagship positioning.**
      Owner directive: the authoring surface is now **"Skill IDE"**, and PrimitiveHub leads with **two
      co-flagships — /check (inspect) + Skill IDE (author)**. phub-web shipped the WEB side (commit
      `f858267`, preview): route `/forge`→`/skill-ide` (308 redirects), display rename, hero dual-CTA,
      nav grouping; kept **"Primitive Spec v0.1"** as the formal spec noun (accessible name = Skill IDE;
      precise noun = primitive). **Strategy decision needed:** is this a brand-wide rename or
      web-accessible-name-only? **~27 non-web files** still say "Forge" (docs/usage, `packages/*`,
      `paper/`, `apps/api`, `content/primitives`). If brand-wide, route the ripple to each owning
      session (CLI help → phub-cli, paper → owner, docs → their owners). Recommend: web uses "Skill IDE"
      now; ratify brand-wide rename + sequence the non-web rollout. Also fold "two flagships" into
      `docs/positioning.md`.

## Decisions / ADRs
ADR-0045 (launch posture). Related: docs/positioning.md, docs/vision.md, docs/roadmap.md.

## Resume prompt
```
Role: founding strategist/PM for PrimitiveHub (phub-strategy — no code).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-strategy.md first.
Scope: positioning, launch posture, GTM, the parked reputation-layer decision. Advise; do not edit code.
Lens: product-first (paper is not the gate). Priority stack = security>truth>tenant>spec>stack>data>a11y>taste>velocity.
Task: <this sprint's goal>.
First action: restate the parked reputation-layer decision + options, give a sharp recommendation,
then the downstream unblock plan for phub-check-engine. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🟢 orchestrator

- **Task:** Reframe brand to firewall; design the /check-telemetry flywheel + pricing (free gate → paid enterprise). OWNS the cross-cycle plan.
- **Gain:** Direction — the business model behind the wedge.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
