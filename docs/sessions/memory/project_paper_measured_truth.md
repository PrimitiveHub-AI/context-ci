---
name: project-paper-measured-truth
description: "The arXiv/IEEE paper and public numbers must report the measured baseline, not the stale all-F1=1.000 claim"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2617ce7-b44b-46bd-b49c-dbdbaa870fb9
---

**UPDATED 2026-10-23 — measured truth has moved; always re-read the LATEST
committed baseline before quoting any number.** Current committed truth is
`bench/baseline/2026-10-23-{py,ts}.json` (+ regenerated `docs/evaluation.md`):

- In-sample (99 samples, both engines byte-identical): macro **F1 = 1.000**.
  The CCI-005 benign FP (corpus S-014) was eliminated in t5 **v0.2.8**
  (noun-modifier lookahead; Py+TS lockstep) — a real FP-class fix, not a
  relabel, no recall loss.
- Held-out (25 adversarial samples): **both engines recall 1.000.** The
  earlier TS holdout gap (recall 0.832, 7 misses) was already closed in code
  by Round 13 but never re-baselined; re-measured and committed 2026-10-23.

History (do not quote as current): the 2026-06-07 baselines showed in-sample
**F1 = 0.991** (CCI-005 P=0.833/F1=0.909) and **TS holdout recall 0.832**.
Those are superseded. **The all-1.000 claim is now TRUE and measured — but on
a 124-sample corpus it still reads as overfit/theater at a real venue unless
the paper contextualizes corpus size + that in-sample is the tuned slice and
the 25-sample holdout is thin (1 sample for several families).** Honesty bar
unchanged: the risk shifted from "stale over-claim" to "under-contextualized
perfect score."

`docs/evaluation.md`'s auto-generated tables are the truth; its hand-written
"Limitations" prose was stale (said 6 holdout / 35 vendors / all-1.000).
Corpus-size prose corrected 2026-07-21 (105→124: 99 in-sample + 25 holdout;
77 adv / 37 benign / 10 borderline) across evaluation.md, its generator
`bench/scripts/render-evaluation.py`, `bench/baseline/FLOOR.md`, and
false-negative-resolution.md (commit 6f2c5e8). Limitation #9 added for the
signing backend (commit 6d6e713).

**Three implementation caveats the paper must NOT overstate** (verified
2026-07-21, confirm before re-asserting): (1) the MCP runtime gate
(`scan_text` / `verify_before_load` / `audit_workspace`) enforces only the
**T1/T2/T5 subset — 3 of 10 detectors**; all 10 exist but are exercised only
by the bench harness. (2) **Registry publish is NOT scan-gated** — `POST
…/versions` does role-check + digest + dedup + async in-toto signing, no
Context CI detector pass at admission; the "validate before admission"
boundary is author-side `/check` discipline. (3) **Signing default is a
staging/noop backend** (`signing/backends.py` fabricates cert/signature/Rekor
material); the in-toto Statement + attestation state machine are real, the
crypto is not. These are the paper's three overstatement risks — draw them
DASHED in figures.

**Why:** the `feat/web-credibility-sweep` branch exists to pay down exactly
this gap between claimed and measured numbers. An F1=1.000-everywhere paper
on a 124-sample corpus reads as overfit/theater at a real venue.

**How to apply:** when writing the paper, the homepage, or any public
metric, echo the LATEST committed `bench/baseline/*.json` via
`docs/evaluation.md` — now all-F1=1.000 both slices both languages. Do not
quote the historical 0.991 / CCI-005-FP / TS-0.832 figures as current. When
reporting 1.000, pair it with corpus size + holdout thinness so it doesn't
read as theater. Re-run `bench/scripts/gate.sh` and `render-evaluation.py`
and refresh before quoting. Relates to [[feedback-no-fake-numbers]].
