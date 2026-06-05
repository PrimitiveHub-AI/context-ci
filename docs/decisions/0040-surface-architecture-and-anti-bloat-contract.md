# ADR-0040: Surface architecture & the anti-bloat contract

**Status:** Accepted
**Date:** 2026-06-05
**Related:** ADR-0025 (active posture + `phub audit`), ADR-0030 (FP
resolution + AV-vendor parallel), ADR-0034 (public `/check` lookup
surface), ADR-0037 (corpus-as-steering-wheel), ADR-0038 (corpus v0.2 +
holdout split), [`docs/doctrine.md`](../doctrine.md),
[`docs/positioning.md`](../positioning.md),
[`docs/owasp-llm-top10-crosswalk.md`](../owasp-llm-top10-crosswalk.md).

## Context

PrimitiveHub now ships several user-facing surfaces — the `phub` CLI
(`audit` / `scan`), the public `/check` paste-and-verdict page
(ADR-0034), the T1–T10 detectors, the Context CI Top 10 taxonomy, the
adversarial corpus, and the FP/FN ledgers + `policy.yaml` allowlist.
The engine behind them keeps deepening: corpus v0.2 (ADR-0038) added 20
samples and a holdout split; the Top 10 is a candidate to grow as
trendy taxonomies (notably the **OWASP Top 10 for LLM Applications**)
raise buyer expectations.

Two distinct growth pressures are easy to conflate, and conflating them
is how a focused product becomes a bloated one:

1. **Engine depth** — more detectors-per-category, more corpus samples,
   tighter precision/recall. The user never touches this directly.
2. **Surface breadth** — more pages, commands, dashboards, "modes."
   Every one of these competes for the user's attention and the team's
   maintenance budget.

The named enemy (`doctrine.md`) is *unverified agent context*, and the
category claim is *Context Firewall, not a registry*. A surface that
does not serve that claim is a distraction that dilutes it. We have no
written contract for what earns a surface, so the next "let's also ship
a …" has no gate to pass. This ADR is that gate.

## Decision

### 1. The reference frame is the AV product-family map (locked by ADR-0030 §3)

Every surface maps to exactly one slot in the antivirus product family.
The slot defines **who** it serves and **at what moment**. If a proposed
surface does not map to a slot — or duplicates a slot already filled —
it is rejected.

| AV analog | Our surface | Who | Moment | Posture |
|---|---|---|---|---|
| Threat encyclopedia | **Context CI Top 10** (public doc) + [OWASP crosswalk](../owasp-llm-top10-crosswalk.md) | researcher, buyer, the paper | learning / evaluating the category | passive |
| AV-TEST lab benchmark | **Corpus + F1/holdout numbers** (ADR-0032/0037/0038) | reviewer, paper, contributor | proving efficacy | research |
| Signature database | **Detectors T1–T10** (Py+TS, ADR-0023) | *(engine — no UI)* | every scan | — |
| Cloud lookup | **`/check`** paste-and-verdict (ADR-0034) | anyone, pre-install | "quick verdict, zero commitment" | passive, public |
| On-demand scanner | **`phub scan <file>`** | dev with one suspect file | "is *this* safe?" | passive (aimed) |
| On-access guard | **`phub audit`** (ADR-0025, walks the tree) | dev / CI | "scan what I didn't know to look at" | active |
| Allowlist + FP/FN portal | **`policy.yaml`** + FP/FN ledgers (ADR-0030) | maintainer | resolving a finding | — |
| Provenance / signature DB | **registry + attestation** (Phase 4 signing) | org publishing | distribution | — |

### 2. One surface per funnel stage — depth is free, breadth is taxed

The surfaces above form a single funnel, and we ship **exactly one
surface per stage**:

- first touch, anonymous → `/check`
- evaluating one primitive → `phub scan`
- hardening a whole repo → `phub audit`
- org / CI enforcement → the corpus regression gate + `policy.yaml`
- buyer / researcher / paper → Top 10 doc + corpus numbers

**Engine depth (rows added behind a surface) is unconstrained and
encouraged.** A new attack family does not get its own page or command;
it rides the existing scan surfaces silently — exactly as a new virus
signature rides the existing scanner. **Surface breadth (a new funnel
entry point) must replace or merge with an existing stage, or it is
bloat and is rejected** (doctrine decision algorithm, step 3).

### 3. A new Top 10 category ships as a quadruple, or not at all

Growing the taxonomy is allowed but gated so it cannot sprawl into thin,
unmeasurable coverage (the failure mode ADR-0037 exists to prevent). A
new category enters the Top 10 **only** as a complete quadruple in one
PR:

1. a `docs/threat-model.md` taxonomy entry (Tn) with a stable `CCI-NNN`;
2. a **Python** detector;
3. a **TypeScript** detector in lockstep parity (ADR-0023);
4. **corpus samples** meeting the v0.1 composition minimums
   (≥5 adversarial / ≥5 benign / ≥2 borderline), with the
   holdout fraction per ADR-0038.

No category is "in the Top 10" until its corpus support exists and the
regression gate (ADR-0037) can defend it. The gate's existence is what
makes this rule self-enforcing: a taxonomy entry without measurement
moves no number and earns no merge.

### 4. Ride trends by mapping, not by expanding

When a trendy external taxonomy (OWASP LLM Top 10, MITRE ATLAS, a
vendor's "agent security" list) raises buyer expectations, the default
response is a **crosswalk document** in the encyclopedia slot — not a
new surface and not a reflexive category bump. The Context CI Top 10
stays *ten* by design; "Top 10" is load-bearing branding that mirrors
OWASP's own discipline of curation over coverage-maximalism. We expand
the *count* only when a crosswalk surfaces a genuine **in-scope** gap
(per the boundary in
[`docs/owasp-llm-top10-crosswalk.md`](../owasp-llm-top10-crosswalk.md)),
and then only under the quadruple rule above.

## Consequences

**Positive:**

- The next "let's also ship a …" has a written gate. Surface
  proposals are accepted or rejected against the AV-family map, not
  re-litigated by taste each time.
- Engine investment (corpus, detectors) is explicitly *unblocked* — the
  contract says depth is free, which is where the moat actually grows.
- Trend pressure (OWASP) gets a cheap, on-strategy answer (a crosswalk)
  instead of an expensive, off-strategy one (a sprawling taxonomy or a
  new dashboard).

**Negative:**

- The contract can feel restrictive to a contributor who wants to ship
  a shiny new page. That friction is the point; it is cheaper than the
  maintenance debt of an orphaned surface.
- The AV-family map is a v1 frame. If the product genuinely outgrows the
  antivirus analogy (e.g. a runtime-gate slot we don't yet fill), this
  ADR is superseded, not silently violated.

## Alternatives considered

- **No contract; decide surface-by-surface.** Status quo. Rejected: it
  is exactly how registries accrete dashboards until the category claim
  blurs. Every competitor in `positioning.md` did this.
- **Bump the Top 10 to match OWASP's count / cover trendy items.**
  Rejected: most of OWASP LLM Top 10 is out of our scope on purpose
  (runtime output handling, model poisoning, embedding weaknesses — see
  the crosswalk). Importing them drifts us off the Context-Firewall
  category and dilutes the paper's taxonomy claim.
- **Per-category UI (a page per Tn).** Rejected directly by §2: that is
  surface breadth masquerading as depth.

## Effective immediately

From this commit, a PR that adds a user-facing surface MUST name the
AV-family slot it fills (§1) and show it does not duplicate a filled
stage (§2). A PR that adds a Top 10 category MUST ship the full
quadruple (§3). Trend-driven coverage asks are answered with a crosswalk
first (§4).
