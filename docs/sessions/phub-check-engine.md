---
id: phub-check-engine
owns: [apps/api/checks, rules/CCI-*, trust-score, verdict-cache]
depends_on: [phub-platform]
touches: [phub-web, phub-corpus-eval, phub-cli]
transcript: transcripts/phub-check-engine.jsonl
updated: 2026-10-23
---

## Charter
Own the `/check` verdict engine: rules (`CCI-*`), trust-score computation, and the
by-digest verdict cache. Correctness-critical; moves slowly and deliberately.

## Current state (2026-10-23)
- Engine lives in `apps/api/checks`; async scan pipeline per ADR-0044.
- Verdict + scoring semantics per ADR-0041; multi-session isolation per ADR-0042.
- **All 10 detectors at F1=1.000 on BOTH in-sample (99) and holdout (25), BOTH languages.**
  Fresh measured-truth baselines `bench/baseline/2026-10-23-{py,ts}.json`; gate GREEN; Py↔TS parity intact.
- Trust score renders e.g. "12/100 fail" on high-risk corpora — findings are deterministic per digest.
- **SSRF #1 CLOSED (app layer) — 2026-10-23.** Handoff: `docs/security/2026-10-23-ssrf-01-handoff.md`
  (reporter abhibughunt3r, high/unauth; phub-cli routed it, platform took the network half). All 5
  app-layer handoff items done, **fail-closed**:
  1. shared SSRF-safe transport `checks/_safe_http.py` — `GuardedHTTPSConnection` validates the IP the
     socket *actually* connected to (`getpeername`), closing the DNS-rebinding TOCTOU; aborts before any
     request is sent. (2/4) redirects follow-capped + https-only, re-validated per hop. (3) scheme=https
     **+ port 443 allow-list**. (5) **generic client errors — upstream status/exception logged server-side,
     never echoed** (was a blind-SSRF exfil channel). Block-list adds IPv4-mapped-IPv6 / NAT64 / IMDS-v6.
  - **All three fetchers now route through `_safe_http`** (extract-reusable done): `url_fetcher` directly;
    `github_resolver` + `npx_resolver` via `guarded_urlopen` (host-allowlist stays the primary control,
    peer-IP pin is defense-in-depth). 31 SSRF tests (`tests/test_url_fetcher_ssrf.py`); 155 non-DB
    `checks/` tests green.

## Open items
- [x] **CCI-005 false-positive — RESOLVED 2026-10-23.** Was the only committed FP: corpus **S-014**
      (`benign-002-package-manager-discussion.md:16`), where the verb-anchored npx pattern anchored on
      *"install command (`npx shadcn…`)"* — `install` used as a **noun modifier**, not an imperative
      (v0.2.6 added `install` to the verb set for FN-018 and it over-matched compound nouns). Fix: a
      zero-width negative lookahead so verb-as-noun-modifier (`install/launch/run` + `command/guide/docs/
      instructions/reference/…`) no longer anchors (t5 **v0.2.8**, Py + TS lockstep). Real directives
      ("Install the uploader: `curl…`") still fire. CCI-005 in-sample 0.909→**1.000**, no recall loss
      (FLOOR.md: FP-class elimination, floor ratchets up, no RECALL-TRADE needed). Regression test:
      `apps/api/checks/tests/test_fp_regressions.py` (4 FP-must-not-fire + 3 directive-must-still-fire).
- [x] **Py↔TS holdout "divergence" — STALE / already closed.** The ledger text + the 2026-06-07 baselines
      predated Round 13 (`58bbe86`, T5 v0.2.7 + T1 v0.2.2 multilingual). Re-measured at HEAD on 2026-10-23:
      **TS holdout recall is 1.000**, not 0.832 — the gap was fixed in code but never re-baselined. Now
      captured in the fresh 2026-10-23 baselines + `docs/evaluation.md`. The gate still only enforces
      *in-sample* parity, so the holdout-blind-spot structural note below remains open.
- [ ] **Gate blind spot (structural):** `gate.sh` enforces Py↔TS parity on in-sample only; holdout drift
      can recur silently. Consider extending `parity_check.py` to also diff the holdout block (and note
      the committed baselines' `parity.{agreed,drift}_sample_ids` arrays are empty — the per-sample parity
      record isn't being populated). `[→ flag: phub-corpus-eval owns bench/]`
- [ ] Trust-score calibration review vs holdout — holdout recall is now 1.000, so the old "recall 0.832"
      premise is void; re-scope as a score-band calibration pass (does the 4-band mapping land real
      corpora where a human would expect) rather than a recall-recovery task.
- [x] **SSRF defense-in-depth for the resolvers — DONE 2026-10-23.** Extracted the guard into shared
      `checks/_safe_http.py`; `github_resolver` + `npx_resolver` now fetch via `guarded_urlopen` (peer-IP
      pin on every hop) on top of their host allowlist. One guard, three fetchers.
- [ ] Reputation-layer / verdict-cache scope — BLOCKED on phub-strategy owner-ratify (see that ledger).
      Option-neutral task ready on ratify: **re-key verdict cache from `raw_input` → resolved content
      digest** (results.py:107), use `phub.lock` manifest hash for repo/skill tree identity, wire to
      durable `GET /api/v1/trust/by-digest/<hash>`. Un-defers ADR-0044. Fixes stale URL verdicts too.

## Cross-scope touches this sprint (edit + flag, per SPINE cross-session rule)
- `[from: phub-check-engine → phub-cli]` Edited `packages/phub/src/scanners/t5-unsafe-shell-install.ts`
  (phub-cli scope) to keep Py↔TS parity green — identical v0.2.8 noun-modifier lookahead on the two
  verb-anchored patterns + `detectorVersion` 0.2.7→0.2.8. Byte-parity mirror of the Python rule change;
  owner authorized the dual edit. Rebuilt `packages/phub`; all 398 TS tests pass.
- `[from: phub-check-engine → phub-corpus-eval]` Re-cut `bench/baseline/2026-10-23-{py,ts}.json` and
  regenerated `docs/evaluation.md` (bench/ + scoreboard are corpus-eval scope) — mechanical measured-truth
  output of the v0.2.8 fix. Floor advances monotonically (all F1=1.000); no corpus samples changed.
- `[from: phub-check-engine → phub-platform]` **SSRF handoff, network half.** I closed the application-layer
  SSRF in `apps/api/checks/url_fetcher.py` (peer-IP pin + https-only redirects). The defense-in-depth half
  is yours: **block outbound egress from the api container to the cloud metadata endpoint
  (169.254.169.254 / fd00:ec2::254) and RFC1918/loopback** at the network/firewall layer, so a future
  fetch bug can't reach internal services even if the app guard regresses. Ties to the 127.0.0.1-only
  bind posture. (phub-cli originated the handoff; this is the infra portion it routed to you.)

## Decisions / ADRs
ADR-0041 (verdict+scoring), ADR-0042 (session isolation), ADR-0044 (async pipeline).

## HELD / staged
(staged rule variants / guarded verdict-cache code — list before close; never delete)
- None added or removed this sprint. The guarded verdict-cache re-key code remains HELD pending
  phub-strategy ratify (see open items); untouched.

## Resume prompt
```
Role: lead eng for the phub-check-engine bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-check-engine.md first.
Scope: apps/api/checks + CCI-* rules + trust-score + verdict-cache. UI/corpus → log + flag.
Constraints: pnpm · containerize · 127.0.0.1 only · measured-truth numbers only · never delete HELD.
Task: <this sprint's goal>.
First action: restate current state + known FPs, then plan + open-items priority before editing.
Any public number must trace to bench/baseline. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🟠 active

- **Task:** Close known FP/FN gaps; add attack classes; design anonymized /check-telemetry → threat-intel loop.
- **Gain:** Detection quality + compounding moat — fewer FPs = trust; flywheel replaces lost community.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.

### Sprint pipeline (3 phases, sequenced — do NOT parallelize across scopes)

**Phase 1 — Close FP/FN gaps + refresh measured truth. ✅ DONE 2026-10-23.**
CCI-005 S-014 FP eliminated (t5 v0.2.8, Py+TS lockstep); TS-holdout item proven stale; all 10 detectors
F1=1.000 both slices both languages; baselines + `docs/evaluation.md` re-cut; gate GREEN. See Open items.

**Phase 2 — Anonymized `/check-telemetry` → threat-intel loop (DESIGN, next up).** Engine-owned data loop;
no detector code until the design is ratified. Sequence:
  1. *Privacy envelope first.* Define what a `/check` may emit WITHOUT content: per-finding
     `(cci_id, detail_tag, verdictClass, detector_version, engine_version)` + a **salted, truncated**
     content digest for k-anonymous dedup — never raw snippets, URLs, repo names, or the paste body.
     (Ties to `feedback_localhost_only` + the no-PII posture; needs a `DemoDataBadge`-grade honesty bar.)
  2. *Aggregation surface.* Append-only counts keyed by `(detail_tag, digest-prefix)` with a demand→eviction
     TTL — the `project_check_reputation_layer` guardrail: **count demand, never store the verdict**; a
     trending surface = skills.sh = not-us.
  3. *Threat-intel feedback.* A periodic job mines high-frequency NEW `(detail_tag, digest)` clusters that
     currently fall through as CLEAN/low-signal → candidate signatures → **corpus proposals** (phub-corpus-eval
     labels them) → new rubric/detector entries. Closes the flywheel: real-world misses become corpus samples.
  4. *Deliverable:* an ADR draft (verdict-engine + strategy co-owned) + a data-schema stub. No live
     collection until owner-ratify. `[→ coordinate: phub-strategy owns the flywheel/pricing framing;
     phub-platform owns any ingest endpoint; phub-corpus-eval owns the resulting labels.]`

**Phase 3 — New attack classes (CCI-011+, LAST; partly blocked on corpus).** Draft rule *specs* only until
phub-corpus-eval has labeled adversarial + benign samples (a detector with no corpus can't be measured →
violates measured-truth). Candidate classes to scope, each needing a precision/recall story before code:
  - **Tool-poisoning / MCP-description injection** — malicious instructions in an MCP tool's `description`/
    schema that the agent ingests as context (distinct from T1 prose injection; the carrier is the tool def).
  - **Indirect / deferred injection** — payloads in content the agent will *retrieve later* (linked docs,
    issue bodies, RAG sources) rather than the primitive itself.
  - **Dependency-confusion / lockfile tampering** — beyond T7 typosquats: scoped-package shadowing,
    `resolutions`/overrides pinning to attacker registries, lockfile integrity-hash mismatches.
  - *Deliverable:* one CCI-011 spec doc + a corpus-sample request to phub-corpus-eval; build after labels land.
