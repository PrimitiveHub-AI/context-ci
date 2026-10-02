---
name: project-paper-measured-truth
description: "The arXiv/IEEE paper and public numbers must report the measured baseline, not the stale all-F1=1.000 claim"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2617ce7-b44b-46bd-b49c-dbdbaa870fb9
---

The `paper/` draft and earlier commit messages (e.g. "Round 13 PR 13.3 —
ALL 10 AT F1=1.000 ON BOTH SLICES") claimed perfect scores, but the
committed `bench/baseline/2026-06-07-{py,ts}.json` they produced do NOT
support that. Measured truth as of 2026-06-07:

- In-sample (99 samples, both engines byte-identical): macro **F1 = 0.991**
  — CCI-005 (unsafe-shell-install) carries one benign false positive
  (P=0.833, F1=0.909); the other nine detectors are 1.000.
- Held-out (25 adversarial samples): **Python recovers all 25** (recall
  1.000); **TypeScript recovers 18** (macro recall 0.832), missing 7 —
  CCI-001×1, CCI-005×3, CCI-006×2, CCI-007×1. Cross-engine parity is
  enforced ONLY on the in-sample slice; the holdout is an honest overfit
  probe and exposes this gap.

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
metric, echo the committed `bench/baseline/*.json` via `docs/evaluation.md`
— including the CCI-005 FP and the TS holdout recall gap. Never restate the
all-1.000 claim. Re-run `bench/scripts/gate.sh` and refresh before quoting.
Relates to [[feedback-no-fake-numbers]].
