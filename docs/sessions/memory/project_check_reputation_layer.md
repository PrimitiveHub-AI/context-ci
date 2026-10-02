---
name: project-check-reputation-layer
description: "PARKED strategic fork — what /check's by-digest verdict cache becomes (public reputation layer vs internal catalog engine vs perf cache)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 146972d1-97bb-458c-8ec5-888e8cb8877a
---

**Open, deliberately-parked strategic decision** (parked 2026-07-21 by mhm: "we will think of it thoroughly" — NO option chosen; do not build in any direction until the owner decides).

**The fork:** the `/check` surface lets users paste GitHub/skills/npx URLs to be scanned. Once a verdict is keyed by content digest and served to many callers, that IS the AV-family "Cloud lookup / reputation" row ([[project-primitivehub]] doctrine). What should it become?
- **(a) Public reputation layer** — durable, digest-keyed, API-first trust DB others embed/query (VirusTotal-for-agent-context). Drives the north-star (verified context loads) + can manufacture the seed catalog the website flip is gated on. Biggest moat; real liability (publishing verdicts about third-party content you don't own).
- **(b) Internal catalog engine** — durable corpus but internal-only; feeds registry/seed-catalog, not a public verdict API. Builds moat substrate, defers liability, flippable public later.
- **(c) Convenience scanner** — cache is pure perf, ephemeral verdicts, no public corpus. Lowest scope, but undifferentiated (GitHub ships it in a quarter) and doesn't compound.

**Current build state (verify before acting):** a content-addressed verdict cache exists in `apps/api/checks/results.py` but keys on `engine_version + mode + raw_input` (the input STRING), not the resolved content digest — so URL modes serve stale verdicts within TTL and miss cross-URL dedup. Caching "by resolved coordinate / tarball digest" is explicitly deferred in ADR-0044. Durable by-digest lookup already exists: `GET /api/v1/trust/by-digest/<hash>` (ADR-0013). Multi-file identity (repo/skill) needs a tree digest — the `phub.lock` manifest is already a byte-reproducible Merkle-style manifest to hash.

**Why it matters:** `/check` is a launch-gating surface — the website DNS/noindex flip waits on Explorer + Forge round-trip + `/check` + a seed catalog ([[project-launch-posture]]). How the cache is framed decides whether `/check` compounds into infrastructure or is undifferentiated marketplace polish.

**How to apply (durable guardrail regardless of which option wins):**
- Demand/popularity drives **eviction + pre-warming only — NEVER the verdict.** A "trending / most-checked skills" surface = skills.sh = explicitly *not us* (doctrine "We are not…"). North-star counts by-digest bundle verifications, not downloads/popularity ([[feedback-no-fake-numbers]]).
- Cache key must version on **detectors (Top10) AND scoring engine**, or an immutable cache serves stale-safe verdicts and misses newly-detectable attacks (false-negative vector; ADR-0023 lockstep).
- Any *public* publishing of third-party verdicts stays behind the **human-only irreversible-flip** discipline.
- When this work resumes: re-surface this fork to the owner before implementing; default to digest-keyed + API-first plumbing that forecloses no option.

Related: [[project-launch-posture]], [[project-primitivehub]], [[feedback-no-fake-numbers]]
