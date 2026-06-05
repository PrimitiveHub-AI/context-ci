# False-Positive Resolution — Methodology + Ledger

> **Status:** Living document. Authored 2026-06-01. Owner: mhm.
> **Scope:** How PrimitiveHub triages, resolves, documents, and
> re-reviews false-positive findings from `phub audit` / `phub scan` /
> the Context CI pipeline. The methodology lives in §1–§5; the
> append-only ledger of every accepted false-positive lives in §6.
>
> **Related:** [Context Policy Language v0.1](./context-policy-v0.1.md),
> [ADR-0018](./decisions/0018-context-policy-language.md),
> [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
> [ADR-0025](./decisions/0025-active-posture-and-phub-audit.md),
> [docs/bugs.md](./bugs.md).

## Why this exists

PrimitiveHub ships scanners that flag attack patterns in agent
context. Every scanner — like every malware-detection signature in
classical AV — eventually flags content the *project* legitimately
produces: documentation that *teaches* the attack pattern, prose that
*describes* an unsafe install, a primitive that *demonstrates* an
adversarial input by name. These are **false positives in posture, not
in pattern matching**. The detector did its job; the content is benign.

AV vendors learned in the 1990s that handling false positives is its
own discipline — separate from writing signatures. Get it wrong and
either (a) your scanner becomes the noisy boy who cries wolf and users
stop reading the output, or (b) you over-correct by widening signatures
and miss real attacks. We adopt their discipline, adapted to our
threat model and our spec:

- **Every accepted false positive has a numbered ledger entry.** No
  silent allow rules.
- **Allow entries are narrow.** Specific file globs, specific detector
  IDs, specific `detail_tags` — not wildcards.
- **The reason is auditable.** Every allow entry's `reason:` field
  references this document by FP-NNN ID. Anyone reading the policy
  can find the full justification.
- **Allow entries expire.** Re-reviewed quarterly + on every Top 10
  minor-version bump. Stale entries get removed.

The product cannot ship a "Trusted" badge backed by an allowlist no
one audited. Therefore the allowlist is auditable, and this document
is the audit trail.

---

## §1 — The four resolution paths

When `phub audit` flags an artifact, the operator (or future Claude
session) MUST classify the finding into exactly one of four paths.
This is the decision tree; there are no other moves.

```
                ┌──────────────────────────────┐
                │   phub flagged an artifact.  │
                │   Classify the finding.      │
                └──────────────┬───────────────┘
                               │
   ┌───────────────────────────┼───────────────────────────┐
   │                           │                           │
   ▼                           ▼                           ▼
PATH A                      PATH B                      PATH C / D
True positive               Domain WAI                  Detector defect
(real risk in content)      (project legitimately       OR ambiguous
                             documents the pattern)
   │                           │                           │
   ▼                           ▼                           ▼
Edit the file.              Add a narrow allow            PATH C → propose
Re-run audit.               entry. Author a               a detector tightening
No allow entry.             ledger entry. Re-run          (Python + TS lockstep,
                            audit.                        ADR-0023).
                                                          PATH D → escalate to
                                                          security-reviewer; do
                                                          NOT silently allow.
```

### Path A — True positive (fix the content)

The detector is correct AND the content shouldn't exist that way. Fix
the prose, the install instruction, the primitive — whatever it is.
**Do not add an allow entry to suppress a true positive.** That's the
single most expensive failure mode: it normalizes hiding real risk
behind a policy file.

How to recognize: a maintainer who hasn't seen this artifact before
would say "that's not how we should be teaching this." Or the content
would change a reader's behavior to something genuinely unsafe.

### Path B — Domain WAI (Working As Intended)

The detector is correct as a *pattern matcher*, but the project
legitimately produces this pattern because:

1. **Self-documentation** — the artifact teaches the attack vector
   itself. CLAUDE.md saying *"no `npx skill installs`"* trips the T5
   regex; that's the whole point of the prose. Same shape as bugs.md
   #25.
2. **Reference material** — a primitive that documents a framework's
   own install command (e.g. `npx shadcn@latest`) is teaching the
   target framework's canonical pattern, not running it.
3. **Adversarial test fixtures** — the `test/fixtures/` files we ship
   intentionally contain attack content so the detectors have something
   to fire on.

How to recognize: the artifact is a markdown document; it describes a
pattern as *content*, not *invokes* it. The pattern can't be executed
from where it sits.

This is the path the methodology in §2–§5 is for.

### Path C — Detector defect

The regex is too broad. It matches text that is structurally NOT the
attack family it claims to find. Example: a T1 prompt-injection
detector that matches "Ignore previous typos" because of an
"Ignore previous \w+" regex.

How to recognize: the matched text wouldn't change an agent's
behavior in the worst case.

Resolution: open a lockstep-PR (per [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md))
that tightens BOTH the Python detector in `apps/api/scanners/` AND the
TS port in `packages/phub/src/scanners/`. Add a fixture that documents
the FP and locks the regression. Do NOT add an allow entry — the right
fix is the detector, not the policy.

### Path D — Ambiguous

You're not sure if it's A, B, or C. The matched text is plausibly
unsafe AND plausibly documentary. The content's author isn't reachable.
The detector is recent and you haven't built intuition for it.

Resolution: file an issue tagged `fp-triage-pending`, **do not silently
allow**, and escalate to a security-reviewer (role-bound publishing,
per [docs/positioning.md](./positioning.md) §3). The audit stays in
the failing state until a human with reviewer authority signs off on
which of A/B/C this finding actually is.

---

## §2 — Allow-entry format requirements

Every entry in `.primitivehub/policy.yaml` MUST satisfy:

| Field | Requirement |
|---|---|
| `reason:` | REQUIRED. Multi-line YAML scalar. MUST contain a `FP-NNN` ledger ID that points to a §6 entry in this document. SHOULD reference the ADR(s) and any bugs.md entries that explain the *why*. |
| `files:` | At least one glob. **Narrow.** Specific file paths (`CLAUDE.md`) or tight directory globs (`apps/web/content/primitives/shadcn-ui-composition.md`). **`**/*` is forbidden** outside the synthetic `--allow-fail` entry the CLI generates. |
| `rules[].id` | Specific stable ID (`CCI-005`) or detector name (`t5.unsafe_shell_install`). The catch-all `*` is reserved for `--allow-fail=*`-style CLI overrides and is NOT acceptable in committed policy. |
| `rules[].detail_tags` | SHOULD be present. The narrower the better. `["npx-arbitrary-install"]` is better than allowing all of CCI-005. The detail tag is what tells future-you *which* family of T5 you opted into. |

If the entry can't satisfy all four, the finding isn't Path B — it's
Path C (detector too broad) or Path D (escalate).

---

## §3 — Ledger entry format (this document, §6)

Every numbered FP entry in §6 contains:

1. **Identifier** — `FP-NNN` where N starts at 001 and increments by
   one. Never re-used. Never re-numbered.
2. **Date** — ISO date the entry was authored. Drives re-review cadence.
3. **Artifact** — the file path the allow targets, exactly as written
   in `policy.yaml`'s `files:`.
4. **Detector** — the CCI ID + detector name + detail_tag(s).
5. **Path** — `B` (domain WAI). Path C never appears here because it
   becomes a detector tightening, not an allow.
6. **Justification** — 2–4 paragraphs. *Why* is this artifact correct
   as-is? *What would change* the answer? *Who* signed off?
7. **Cross-references** — links to ADRs, bugs.md entries, related
   ledger entries.
8. **Re-review date** — explicit date by which this entry must be
   walked again. Default: 90 days from authorship.

---

## §4 — Re-review cadence

Like AV signature files, the allowlist decays. We re-review on two
triggers:

1. **Calendar** — quarterly walk of every entry whose `Re-review date`
   has passed. Per entry, decide: (a) still valid → bump the re-review
   date forward 90 days; (b) detector has been tightened and the
   pattern no longer fires → remove the entry; (c) artifact has been
   rewritten and the pattern no longer appears → remove the entry; (d)
   still ambiguous → escalate to security-reviewer for a second
   opinion.
2. **Top 10 minor-version bump** — when [ADR-0016](./decisions/0016-context-ci-top-10-versioning.md)'s
   Top 10 spec ratchets (e.g. CCI-005 v0.1 → v0.2 with tightened
   regexes), every entry referencing the changed CCI ID is re-reviewed
   even if its calendar date hasn't expired. Tightening may have made
   the entry unnecessary.

Re-review minutes are appended to the entry as a `### Re-review log`
subsection. Entries are NOT renumbered or rewritten in place;
modifications are append-only so the audit trail survives.

---

## §5 — Quick reference for future sessions

When a future Claude Code session (or contributor) encounters a
`phub audit` failure:

1. Read the finding. Classify into Path A / B / C / D using §1.
2. If Path B: write a new FP-NNN entry in §6 of this document
   (see §3 for format). Add the matching `allow:` entry to
   `.primitivehub/policy.yaml` with `reason:` pointing at the FP-NNN.
   Re-run `phub audit` to confirm the project comes up clean.
3. If Path A: edit the artifact. Re-run audit.
4. If Path C: open a lockstep-PR tightening the Python + TS detector
   in `apps/api/scanners/` and `packages/phub/src/scanners/`, per
   [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md). Add
   a fixture that locks the regression.
5. If Path D: don't silently allow. File a tracking issue and
   escalate to a security-reviewer.

**Hard rule:** every commit that adds an `allow:` entry to
`.primitivehub/policy.yaml` MUST also append an FP-NNN entry to §6 of
this document IN THE SAME COMMIT. A policy entry without a ledger
entry is a defect.

---

## §6 — Ledger of accepted false positives

> Append-only. New entries get the next available FP-NNN. Modifications
> happen via a `### Re-review log` subsection on the relevant entry.

### FP-001 — CLAUDE.md teaches the T5 attack vector by name

- **Date authored:** 2026-06-01
- **Artifact:** `CLAUDE.md`
- **Detector:** CCI-005 / `t5.unsafe_shell_install` / `npx-arbitrary-install`
- **Path:** B (domain WAI)
- **Re-review date:** 2026-09-01

**Justification.** [CLAUDE.md](../CLAUDE.md) contains hard-rule #6
explicitly naming `npx skill installs` as a T5 supply-chain attack
vector, instructing future sessions to refuse the pattern. Hard-rule
#6 also describes `npx @primitivehub/phub audit` as the
*local enforcement surface* for the rule. Both mentions trip the T5
v0.1 regex family `npx-arbitrary-install`.

This is exactly the canonical WAI documented in
[docs/bugs.md](./bugs.md) #25 — *the project's instructional content
about an attack pattern is indistinguishable from the attack pattern
itself, at the regex level*. The content is correct; the detector is
correct; the categorical clash is the project's own meta-status (we
*are* the people who wrote the threat model, so our docs talk about
it). A `detail_tags`-narrow allow is the right tool.

What would change the answer:
- Path B → Path C transition: if a future Top 10 minor-version bump
  introduces markdown-AST awareness (the v0.1 `Known limitations`
  bullet in `packages/phub/CHANGELOG.md`), CCI-005 might learn to
  distinguish *code-fenced* attack patterns from *prose mentions*. At
  that point this allow becomes redundant and the entry is removed.
- Path B → Path A transition: if the CLAUDE.md text is rewritten to
  describe the rule without naming the pattern (e.g., replacing
  `"no \`npx skill installs\`"` with `"no remote skill installs"`),
  the regex stops firing and the allow becomes unnecessary.

**Cross-references:**
[ADR-0018](./decisions/0018-context-policy-language.md),
[ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
[ADR-0025](./decisions/0025-active-posture-and-phub-audit.md),
[docs/bugs.md](./bugs.md) #25.

### FP-001 Re-review log

- **2026-06-05 — Resolved via Path C (ADR-0036 v0.2.2).** The v0.2.2
  CCI-005 detector now consults `isInNegationContext()` and skips
  matches that fall within a negated sentence. CLAUDE.md hard-rule
  #6's prose — "**No** npx skill installs", "**Don't** run", "**never**
  run X" — is recognized as negation framing and no longer flagged.
  The active policy rule for this entry was removed from
  `.primitivehub/policy.yaml` in the same commit. Corpus measurement
  confirms: CCI-005 precision stays at 1.000 with the new benign
  sample S-016 (negation-prose teaching primitive) passing through.
  The ledger entry stays committed (append-only discipline per
  ADR-0030 § 1 practice 1); only the policy allow rule was removed.

---

### FP-002 — shadcn primitive documents the canonical shadcn/ui install command

- **Date authored:** 2026-06-01
- **Artifact:** `apps/web/content/primitives/shadcn-ui-composition.md`
- **Detector:** CCI-005 / `t5.unsafe_shell_install` / `npx-arbitrary-install`
- **Path:** B (domain WAI)
- **Re-review date:** 2026-09-01

**Justification.** The primitive in
[apps/web/content/primitives/shadcn-ui-composition.md](../apps/web/content/primitives/shadcn-ui-composition.md)
is a cognition document teaching how to compose shadcn/ui components.
At line 130 it mentions `npx shadcn@latest add Button` — the canonical
install command published by the shadcn/ui project itself in their
public documentation.

This is reference material describing a third-party tool's intended
entry point, not an executable installer. The primitive is a markdown
document; the `npx` string cannot be invoked from where it sits. The
target framework (shadcn/ui) ships under its own provenance discipline
(npm package `shadcn`, published by the framework maintainers); the
primitive's *teaching* of the framework's documented pattern is not
the supply-chain risk T5 was written to catch.

What would change the answer:
- Path B → Path A: if shadcn/ui changes their canonical install
  pattern (or if PrimitiveHub later publishes a hardened shadcn-install
  wrapper that supersedes raw `npx`), the primitive should be rewritten
  to point at the new pattern and the allow removed.
- Path B → Path C: same Top 10 markdown-AST-awareness condition as
  FP-001 — code-fence-aware detection would let the v0.2 detector skip
  this on its own.

**Cross-references:**
[ADR-0018](./decisions/0018-context-policy-language.md),
[ADR-0025](./decisions/0025-active-posture-and-phub-audit.md),
[CLAUDE.md](../CLAUDE.md) §"Expert primitives".

---

### FP-002 Re-review log

- **2026-06-04 — Resolved via Path C (ADR-0035 v0.2.1).** The v0.2.1
  CCI-005 detector now consults `analyzeMarkdownContext()` and skips
  matches that fall inside inline-code spans. The `npx shadcn@latest
  add Button` mention in `apps/web/content/primitives/shadcn-ui-composition.md:130`
  sits inside `` ` ` `` and is no longer flagged. The active policy
  rule for this entry was removed from `.primitivehub/policy.yaml` in
  the same commit. Corpus measurement confirms: CCI-005 precision
  ratcheted from 0.667 → 1.000 on the seed corpus; the FP-002-shaped
  sample (S-014 — "shadcn install in inline code") now correctly
  passes. The ledger entry stays committed (append-only discipline
  per ADR-0030 § 1 practice 1); only the policy allow rule was removed.

### FP-003 — Cognition primitives declare their own CC-BY-4.0 license

- **Date authored:** 2026-06-04
- **Artifact:** `apps/web/content/primitives/**/*.md` (glob — 19 files at time of authorship)
- **Detector:** CCI-009 / `t9.copyright_contamination` / `cc-attribution-required`
- **Path:** B (domain WAI)
- **Re-review date:** 2026-09-04

**Justification.** Every cognition primitive under
`apps/web/content/primitives/` carries a frontmatter line `license:
CC-BY-4.0` — the primitive's own published license. The v0.1 CCI-009
detector matches the literal `CC-BY-4.0` string anywhere in the file
and emits "downstream licensing risk; add attribution." Applied to a
primitive's own license declaration the warning is inverted: **the
primitive is the source, not the consumer**.

The detector cannot distinguish *"I declare my license"* (frontmatter
or LICENSE-block declaration) from *"I copied content licensed
under this"* (body-of-text quotation). For a registry whose entire
purpose is publishing primitives under explicit licenses, every primitive
will carry this same pattern. Path B with a glob is the right scope —
narrower (file-by-file) would defeat the whole point.

What would change the answer:
- Path B → Path C: a v0.2 CCI-009 detector that distinguishes
  frontmatter-block matches from body-text matches retires this allow.
  The narrow shape is: skip lines inside `^---$` … `^---$` blocks at
  the head of the file. Once shipped (lockstep TS + Python per
  ADR-0023), this entry can be removed.
- Path B → Path A: if a primitive author starts QUOTING externally-licensed
  content under CC-BY in the body, the primitive needs an actual
  attribution line and the allow stops applying to that file. Reviewers
  catch this in PR review.

**Cross-references:**
[ADR-0018](./decisions/0018-context-policy-language.md),
[ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md),
`bench/corpus/manifest.yaml` (the corpus is the test bed for the v0.2
tightening).

### FP-003 Re-review log

- **2026-06-04 — Resolved via Path C (ADR-0035 v0.2.1).** The v0.2.1
  CCI-009 detector now consults `analyzeMarkdownContext()` and skips
  matches that fall inside the frontmatter block. Every primitive's
  `license: CC-BY-4.0` frontmatter line is recognized as a declaration
  (not borrowed content) and no longer flagged. The active policy rule
  for this entry was removed from `.primitivehub/policy.yaml` in the
  same commit. Corpus measurement confirms: CCI-009 precision stays at
  1.000 on the seed corpus with no new FPs introduced. The ledger entry
  stays committed (append-only discipline per ADR-0030 § 1 practice 1).

---

### FP-004 — CLAUDE.md mentions CC-BY-4.0 in describing the corpus license

- **Date authored:** 2026-06-04
- **Artifact:** `CLAUDE.md`
- **Detector:** CCI-009 / `t9.copyright_contamination` / `cc-attribution-required`
- **Path:** B (domain WAI)
- **Re-review date:** 2026-09-04

**Justification.** The canonical-docs table in
[CLAUDE.md](../CLAUDE.md) describes the Corpus v0.1 row with the phrase
`CC-BY-4.0 (corpus content)` — meta-documentation about which artifact
ships under which license. This is the same structural shape as
FP-003 applied to the project's own meta-docs: the project is the source
of the corpus, not a consumer of CC-BY content.

What would change the answer: same as FP-003 (a v0.2 detector that
exempts frontmatter + license-description prose retires this allow).

**Cross-references:**
[ADR-0018](./decisions/0018-context-policy-language.md),
[ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md).

### FP-004 Re-review log

- **2026-06-05 — Resolved via Path C (ADR-0036 v0.2.2).** The v0.2.2
  CCI-009 detector now consults `isInDeclarationContext()` and skips
  matches that appear in license-declaration prose (parenthesized
  follow-on markers like `(corpus content)` / `(license)`, "ships
  under X" pre-markers, `license: X` framing). CLAUDE.md's
  canonical-docs table reference to `CC-BY-4.0 (corpus content)` is
  recognized as declaration, not borrowed content. The active policy
  rule for this entry was removed from `.primitivehub/policy.yaml`
  in the same commit. Corpus measurement confirms: CCI-009 precision
  stays at 1.000 with the new benign sample S-018 (canonical-docs
  license-doc) passing through. The ledger entry stays committed
  (append-only discipline per ADR-0030 § 1 practice 1).

---

### FP-005 — `frontend-design-elite` references real vendor names as design exemplars

- **Date authored:** 2026-06-04
- **Artifact:** `apps/web/content/primitives/frontend-design-elite.md`
- **Detector:** CCI-007 / `t7.poisoned_naming` / `vendor-typosquat`
- **Path:** B (domain WAI) — leaning toward Path C
- **Re-review date:** 2026-09-04

**Justification.** The
[frontend-design-elite](../apps/web/content/primitives/frontend-design-elite.md)
primitive teaches design taste by naming the design discipline of
specific vendors as exemplars: **Stripe** (typography + restraint),
**Vercel** (motion + density), **Linear** (information hierarchy),
**Sigstore** (trust UX). The v0.1 CCI-007 detector flags every literal
occurrence of those vendor names as `vendor-typosquat / impersonation`.

This is wrong at the detector level: the primitive is **referencing**
the real vendors, not **impersonating** them. The detector confuses
mention with impersonation. Path B is the short-term fix because the
primitive is correct as written. The deeper fix is Path C — the v0.2
CCI-007 detector should distinguish:

- *Mention context* — design references, comparisons, quotations:
  vendor names appearing in prose alongside descriptive language
  (`"Stripe's typography rhythm"`, `"the Vercel docs convention"`).
  No CCI-007 hit.
- *Impersonation context* — install commands, package names, author
  identity claims, attestation subject lines: vendor names where the
  primitive is **claiming to be** the vendor. Real CCI-007 hit.

The Path-C tightening also wants context awareness around confusable-
character matching (Latin-vs-Cyrillic homoglyphs in vendor names — the
*actual* typosquat attack), distinct from the `Stripe == Stripe` case
this allow covers.

What would change the answer:
- Path B → Path A: if a primitive starts naming itself as Stripe (e.g.
  in an `author:` frontmatter field or a Sigstore subject claim), that
  IS impersonation and the allow stops applying to that file.
- Path B → Path C: when CCI-007 v0.2 ships with mention-vs-impersonation
  context, this allow is removed.

**Cross-references:**
[ADR-0018](./decisions/0018-context-policy-language.md),
[ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md) (Path-C
work requires lockstep TS + Python tightening),
[ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md).

### FP-005 Re-review log

- **2026-06-05 — Resolved via Path C (ADR-0036 v0.2.2).** The v0.2.2
  CCI-007 detector now consults `isInMentionContext()` and skips
  bare-vendor-name typosquat matches that appear in mention prose
  ("Stripe's typography", "like Linear", "such as Vercel", possessive
  forms in comma-separated exemplar lists). The
  `frontend-design-elite` primitive's references to Stripe / Vercel /
  Linear / Sigstore as design exemplars are recognized as mention,
  not impersonation. OFFICIAL_CLAIM + FALSE_AFFILIATION pattern
  families remain context-unaware (per ADR-0036 § 3), so explicit
  impersonation prose ("the official Stripe primitive", "endorsed by
  Linear") still fires correctly. The active policy rule for this
  entry was removed from `.primitivehub/policy.yaml` in the same
  commit. Corpus measurement confirms: the new benign sample S-017
  (design-exemplars-prose primitive) passes through cleanly; CCI-007
  has no FPs on the seed corpus. The ledger entry stays committed
  (append-only discipline per ADR-0030 § 1 practice 1).

### FP-006 — CCI-007 typosquat patterns fired on canonical vendor names

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t7_poisoned_naming.py` (regex bug, not content)
- **Detector:** CCI-007 / `t7.poisoned_naming` / `vendor-typosquat`
- **Path:** C — detector defect; resolved at the detector level.
- **Surfacing context:** discovered via `/check` (ADR-0034) scanning a
  real cybersecurity skills repo. The detector fired `vendor-typosquat`
  on the literal canonical strings `Anthropic`, `Microsoft`, `Okta`,
  `Stripe`. Volume on a single 4,000-file repo scan: ~2,400 spurious
  hints, drowning out real findings.

**Root cause.** Four character-class regexes in `_TYPOSQUAT_PATTERNS`
included the canonical letter itself as one of the alternation
choices:

```python
r"\b[A4O0]nthropic\b",   # matched "Anthropic" (canonical A!)
r"\bM[i1l]crosoft\b",    # matched "Microsoft" (canonical i!)
r"\b[O0]kta\b(?!\w)",    # matched "Okta" (canonical O!)
r"\bSt[r1]ipe\b",        # matched "Stripe" (canonical r!)
```

A typosquat detector by definition catches imitations, not bare
mentions — the canonical letter has no business in the character
class. The patch (v0.2.3) drops the canonical letter, leaving only
the substitute digits/letters that actually constitute typosquats:
`[40]nthropic`, `M[1l]crosoft`, `0kta`, `St1ipe`.

**Why this matters.** Every primitive, README, or skill that mentions
"Anthropic" by name (i.e. virtually every primitive in any AI-adjacent
repo) was tripping CCI-007 with FAIL severity, dropping the trust
score by 25 points per file. `/check` verdicts on real repos were
unusable noise. This is the "scanner becomes the noisy boy who cries
wolf" failure mode that ADR-0030 § 1 warns about — closed at the
detector level rather than papered over with an allowlist.

**No policy entry needed.** This is a Path-C defect fix, not a Path-B
suppression. The regex is corrected in code; no
`.primitivehub/policy.yaml` rule exists for this case. Regression
tests live at
[`apps/api/checks/tests/test_fp_regressions.py`](../apps/api/checks/tests/test_fp_regressions.py) —
the canonical-name parametrize ensures the bug doesn't return.

**TS parity follow-up.** `packages/phub/src/scanners/t7-poisoned-naming.ts`
has the same regex bug and will be patched in lockstep per ADR-0023
in the next phub release.

**Cross-references:**
[ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md) (parity),
[ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md),
[ADR-0034](./decisions/0034-public-check-lookup-surface.md) (surfacing
surface).

### FP-006 Re-review log

_None yet — entry authored 2026-06-04._

### FP-007 — CCI-009 license-header fired on canonical Apache 2.0 source-file headers

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t9_copyright_contamination.py` (over-broad scope, not content)
- **Detector:** CCI-009 / `t9.copyright_contamination` /
  `permissive-license-header`, `gpl-header`, `cc-attribution-required`
- **Path:** C — detector defect (spec-context mismatch); resolved at
  the detector level.
- **Surfacing context:** `/check` scanning a real Apache-2.0-licensed
  GitHub repo. Every `.java` / `.py` / `.go` / `.js` file with the
  canonical Apache 2.0 header (`"Licensed under the Apache License,
  Version 2.0 (the \"License\")"`) flagged as "downstream licensing
  risk." 20+ FAILs per scan from license-aware file headers.

**Root cause.** T9 v0.2.2 had no notion of file type or in-file
position. The detector was designed for the Primitive-Forge context
(scanning a single markdown primitive in isolation), where embedded
license boilerplate IS the threat — primitive content shouldn't
copy-paste verbatim license text it can't redistribute (see the
adversarial fixtures at
`docs/context-ci-top-10/conformance/fixtures/CCI-009/`).

For the `/check` repo-scanning context (ADR-0034), the detector ran
against every file in the tarball, including source code files where
the Apache header at the top is the CANONICAL place for the header.
That's not the threat; that's how Apache-2.0-licensed code is
supposed to look.

**Patch (v0.2.3).** Two narrow exemptions for the open-source-license
family (`permissive-license-header`, `gpl-header`,
`cc-attribution-required`):

1. **License-named files** (`LICENSE`, `LICENSE.md`, `COPYING`,
   `NOTICE`, etc., case-insensitive, anywhere in path): exempt
   anywhere in the file. The file's job IS to be the license.
2. **Source files + header region**: if the file extension is in the
   source-code list (`.py`, `.js`, `.ts`, `.java`, `.go`, `.rs`, `.c`,
   etc.) AND the match is within the first 40 lines, exempt. This is
   the canonical license-header position.

Markdown / text / config / data files get no exemption — embedded
license boilerplate in those IS the T9 threat, and the conformance
fixtures at
[`docs/context-ci-top-10/conformance/fixtures/CCI-009/`](./context-ci-top-10/conformance/fixtures/CCI-009/)
explicitly validate that. The fixtures (which are `.md` files)
continue to fire CCI-009 after this patch.

The `proprietary-copyright-notice` and `forum-source-attribution`
families do NOT get the exemption — they're meaningful wherever they
appear (a `© ACME 2023 All Rights Reserved` at the top of a `.py`
file is still a third-party-copy smell).

**Filename plumbing.** `DetectorContext` gained an optional
`file_path: str` field. The `/check` endpoint populates it from the
tarball-entry name when scanning multi-file archives; single-blob
callers (mode=content) leave it empty and get the original
markdown-primitive behavior (no exemption).

**No policy entry needed.** Path-C fix; regression tests at
[`apps/api/checks/tests/test_fp_regressions.py`](../apps/api/checks/tests/test_fp_regressions.py).

**TS parity follow-up.**
`packages/phub/src/scanners/t9-copyright-contamination.ts` will mirror
this fix in lockstep per ADR-0023 in the next phub release.

**Cross-references:** ADR-0023, ADR-0030, ADR-0034, conformance
fixtures CCI-009.

### FP-007 Re-review log

_None yet — entry authored 2026-06-04._

### FP-008 — CCI-009 forum-source-attribution fired on legitimate GitHub citations

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t9_copyright_contamination.py` (over-broad pattern)
- **Detector:** CCI-009 / `t9.copyright_contamination` / `forum-source-attribution`
- **Path:** C — detector defect (over-broad pattern).
- **Surfacing context:** `/check` flagged
  `Source: https://github.com/thinkst/canarytokens` as a "downstream
  licensing risk." The skill was correctly attributing its source —
  the opposite of contamination.

**Root cause.** The v0.1 pattern grouped `Source:
https://github.com/...` with `Source: https://stackoverflow.com/...`.
Stack Overflow content is CC-BY-SA (real attribution obligation);
GitHub repos carry their own per-repo license, so a `Source:`
attribution to a github URL is benign — and is in fact the
RIGHT thing to do when adapting code or skills from upstream.

**Patch (v0.2.3).** The GitHub `Source:` pattern is removed from
`_FORUM_PATTERNS`. Stack Overflow, Reddit, Medium, dev.to, Substack
patterns kept — those have user-license heterogeneity and attribution
requirements. The actual GitHub-contamination cases (verbatim copy of
copyrighted code) get caught by `permissive-license-header` and
`proprietary-copyright-notice` instead, when those headers appear.

**TS parity.** `packages/phub/src/scanners/t9-copyright-contamination.ts`
mirrors this patch in lockstep per ADR-0023.

**Cross-references:** ADR-0023, ADR-0030, ADR-0034.

### FP-008 Re-review log

_None yet — entry authored 2026-06-04._

### FP-009 — CCI-008 fake-doi-prefix list missing major registrants

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t8_fake_citation.py` (under-sized allowlist)
- **Detector:** CCI-008 / `t8.fake_citation` / `fake-doi-prefix`
- **Path:** C — detector calibration; allowlist expansion.
- **Surfacing context:** `/check` flagged `doi.org/10.1184/R1/12124386`
  as fake. `10.1184` is Carnegie Mellon University — entirely
  legitimate, just absent from the v0.1 28-prefix list.

**Root cause.** The v0.1 list covered top commercial publishers
(IEEE, ACM, Springer, Elsevier) but had ZERO university-press
prefixes, ZERO US federal research orgs (NIST, OSTI, USGS), and
ZERO of the standard preprint servers besides arXiv. Real-world
cybersecurity citations regularly target NIST publications
(10.6028) and Carnegie Mellon's CyLab (10.1184).

**Patch (v0.2.0).** Expanded the allowlist from 28 to ~80 prefixes
covering:
- Major commercial publishers (added Elsevier 10.1016, SAGE 10.1177,
  MDPI 10.3390, Annual Reviews 10.1146, …)
- US federal research orgs (NIST 10.6028, OSTI 10.2172, NIST alt
  10.18434, USGS 10.25333)
- University presses + repositories (CMU 10.1184, Columbia 10.7916,
  Cornell 10.7298, Harvard Dataverse 10.7910, UC Irvine ML Repo
  10.24432, MIT DSpace 10.34740, ETH Zurich 10.34894, Penn State
  10.22152, Princeton 10.23943, UC San Diego 10.25394, …)
- Preprint servers (ResearchGate 10.13140, OSF 10.31219, PsyArXiv
  10.31234, TechRxiv 10.36227, Figshare 10.6084, …)
- Standards bodies (BSI 10.3403)

**TS parity.** `packages/phub/src/scanners/t8-fake-citation.ts`
mirrors the expansion.

**Cross-references:** ADR-0023, ADR-0030, ADR-0034.

### FP-009 Re-review log

_None yet — entry authored 2026-06-04._

### FP-010 — CCI-010 fired on every documentation file in repo scans

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t10_context_bloat.py` (spec-context mismatch + over-strict threshold)
- **Detector:** CCI-010 / `t10.context_bloat` (all sub-tags)
- **Path:** C — detector defect (calibrated for single-primitive
  context, not multi-file repo scans) + threshold tuning.
- **Surfacing context:** `/check` repo scan of
  `anthropic-cybersecurity-skills` (4,184 files) produced **1,044
  T10 WARN hits** — overwhelming useful signal. ~1,017 of those
  were `heading-proliferation` on files with 4–6 short sections.

**Root cause #1 (scope).** T10 was calibrated for the Primitive Forge
context (one .md primitive being authored). When `/check` ships a
multi-file scan, every README / changelog / docs page gets evaluated
as if it were a primitive. That's a category error.

**Root cause #2 (calibration).** The `heading-proliferation` threshold
required ≥500 chars per h2 to pass. Legitimate documentation patterns
— cheatsheets, reference catalogs, structured runbooks — routinely
have 4–6 short sections in 2 KB and tripped the floor.

**Patch (v0.1.1).** Two narrow changes:

1. **File-type awareness.** When `DetectorContext.file_path` is
   populated (multi-file scan), T10 only runs on files whose path
   indicates they're a primitive: anything under `/primitives/`,
   `/skills/`, `/prompts/`, `/agents/`, `/.claude/skills/`,
   `/.cursor/rules/`, or with a primitive-y basename
   (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, etc.). Empty `file_path`
   (single-blob / Forge mode) → run as before.

2. **Threshold tune.** `HEADING_PROLIFERATION_RATIO` lowered from
   500 → 200 chars/h2 (~50 tokens/section), and a new minimum
   `HEADING_PROLIFERATION_MIN_COUNT = 6` — a file must have at least
   6 h2 sections to qualify. This still catches the outline-spam
   attack pattern (15+ empty headings in <1 KB) without flagging
   well-structured short docs.

**Combined impact** on the anthropic-cybersecurity-skills repo scan:
T10 hits dropped from **1,044 → 48** (95% reduction). Total `/check`
verdict noise across all detectors dropped from **2,434 → 60** (97.5%
reduction) when combined with FP-006 + FP-007 + FP-008 + FP-009 +
FP-011 fixes.

**TS parity.** `packages/phub/src/scanners/t10-context-bloat.ts`
mirrors both fixes.

**Cross-references:** ADR-0023, ADR-0030, ADR-0034.

### FP-010 Re-review log

_None yet — entry authored 2026-06-04._

### FP-011 — CCI-001 / CCI-003 / CCI-004 fired on patterns inside teaching code fences

- **Date authored:** 2026-06-04
- **Artifact:** `apps/api/scanners/t1_prompt_injection.py`,
  `apps/api/scanners/t3_encoded_payloads.py`,
  `apps/api/scanners/t4_remote_fetch.py`
- **Detectors:** CCI-001 (`override-system-instructions` +
  `credential-exfiltration-hint`), CCI-003 (`base64-long-blob`,
  `hex-long-blob`, decode-instructions), CCI-004 (`agent-side-include`)
- **Path:** C — markdown-context awareness gap.
- **Surfacing context:** Cybersecurity skill primitives TEACH the
  attack patterns by quoting them in ```code blocks. Those
  demonstrations fired the detectors as if they were live attacks.

**Root cause.** T5 already had `is_in_any_code_or_frontmatter()`
filtering since ADR-0035 (v0.2.1). T1, T3, T4 did not. Result: every
fenced demonstration of "Ignore previous instructions" in a tutorial
was scored as a real injection.

**Patch.**
- **T1 v0.2.0** — SELECTIVE context awareness. Skip
  `override-system-instructions` and `credential-exfiltration-hint`
  when inside fence / inline code / frontmatter. Keep
  `hidden-instructions` (`\`\`\`system`, `[SYSTEM]:`,
  `<!-- instructions`) and `role-hijack` context-unaware — those tag
  families DO live in fence-like structures as the attack carrier
  itself, and the conformance suite validates them firing.
- **T3 v0.2.0** — Skip all matches (long blobs + decode instructions)
  inside fence / inline code / frontmatter.
- **T4 v0.2.0** — Same — `<iframe>` example in a ```html block is
  teaching content, not a runtime fetch instruction.

**TS parity.** `packages/phub/src/scanners/t1-prompt-injection.ts`,
`t3-encoded-payloads.ts`, `t4-remote-fetch.ts` mirror these patches.

**Cross-references:** ADR-0023 (parity), ADR-0030, ADR-0034,
ADR-0035 (the markdown-context infrastructure this patch consumes),
ADR-0036 (semantic-context infrastructure, related).

### FP-011 Re-review log

_None yet — entry authored 2026-06-04._

### FP-012 — CCI-008 vague-trigger fired inside defender-prose example listing

- **Date authored:** 2026-06-05
- **Artifact:** `bench/corpus/samples/cci-008-fake-citation/benign-001-defender-prose.md` (corpus sample S-055)
- **Detector:** CCI-008 / `t8.fake_citation` / `vague-citation`
- **Path:** C (detector defect; resolution is a lockstep tightening, not an allowlist entry)
- **Re-review date:** n/a — Path C closes via Round 3 commit, not via an allow entry.

**Symptom.** Round 2 of the elite-tier path
([ADR-0037](./decisions/0037-corpus-as-steering-wheel.md)) measured the
v0.1 corpus and found CCI-008 at P = 0.778. Two FPs out of 9 benign
samples — both on defender-prose content describing the CCI-008
attack family itself. S-055 contains the literal phrases
`"studies show"`, `"research demonstrates"`, `"experts agree"`
inside the parenthetical `("...", "...", "...")` clause that
ENUMERATES the vague-trigger taxonomy for documentation purposes.
The current `_VAGUE_TRIGGER_RE` matches the bare phrases anywhere in
the document, the 200-char lookahead finds no `arXiv:` / `DOI:` /
`RFC` / `[N]` / `(YYYY)` reference signal nearby, and the detector
emits `FAIL`.

This is structurally the same shape as FP-001 / FP-011: the
project's own teaching prose about an attack family is
indistinguishable, at the regex level, from the attack itself —
because the prose names the attack.

**Justification for Path C** (not Path B / allow entry). An allow
entry on `bench/corpus/samples/**` would defeat the corpus's purpose:
the corpus is supposed to fire its own detectors so we can measure.
Suppressing the FP via policy hides the detector defect from the
gate. The right fix is a detector-level skip: vague triggers
enclosed in same-line quote pairs (`"..."` or `'...'`) are
citations of the phrase, not uses of it.

**Resolution vector** (executed in Round 3, lockstep PR per ADR-0023):
extend `_scan_vague_citations` to skip matches where BOTH:

1. The trigger is wholly enclosed in a same-line `"..."` or `'...'`
   pair within ±50 characters of the match, AND
2. A **metalinguistic noun** appears within ±100 characters of the
   match: one of `phrase|term|trigger|expression|rhetoric|framing|appeal|wording|verbiage|construction|example|sub-shape|pattern`.

The two-signal rule is the peer-review hardening (see addendum below):
quote-pair enclosure alone is too easy for an attacker to defeat —
they could wrap a real authority-appeal in quotes and evade. Requiring
a metalinguistic noun nearby means the document is explicitly
DISCUSSING the phrase rather than USING it.

Add a fixture in `apps/api/scanners/tests/test_scanners_t8.py` +
`packages/phub/test/scanners/t8.test.ts` that locks the regression on
both S-055 and S-057 shapes.

### FP-012 Peer-review addendum (2026-06-05)

Adversarial peer reviewer flagged the originally-proposed
quote-pair-only heuristic as too narrow on cross-line boundaries
AND too easy to defeat (attacker wraps appeal in quotes and evades).
Both risks mitigated by the two-signal rule above. The same-line
constraint is preserved — defender prose discussing a phrase nearly
always keeps the phrase and the metalinguistic noun on the same line
in practice, and the cross-line edge case is bounded by the ±100
char window on the noun search.

**Cross-references:** [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
[ADR-0037](./decisions/0037-corpus-as-steering-wheel.md), related
FP-013 (same root cause, different sample), FP-001 / FP-011 (same
"docs-about-attack" shape on other detectors), detector at
[`apps/api/scanners/t8_fake_citation.py:295`](../apps/api/scanners/t8_fake_citation.py#L295).

### FP-012 Re-review log

_None yet — entry authored 2026-06-05._

### FP-013 — CCI-008 vague-trigger fired on meta-prose discussing the detector

- **Date authored:** 2026-06-05
- **Artifact:** `bench/corpus/samples/cci-008-fake-citation/benign-003-vague-near-reference.md` (corpus sample S-057)
- **Detector:** CCI-008 / `t8.fake_citation` / `vague-citation`
- **Path:** C (detector defect)
- **Re-review date:** n/a — Path C.

**Symptom.** S-057 is structured in two parts. Part 1 is a
LEGITIMATE technical paragraph that uses "Studies show" and
"Research demonstrates" — each correctly paired with an inline
reference (`arXiv:2401.12345`, `RFC 9421`); the v0.1 detector
correctly skips both via the 200-char lookahead. Part 2 is a META
paragraph explaining WHY the v0.1 detector correctly skipped Part 1
— and in doing so quotes the phrases `"studies show"` and
`"research demonstrates"` back. The detector matches the META quotes
and finds no nearby reference signal (the META prose explains the
mechanism, it doesn't cite). Both META mentions emit `FAIL`.

The detector is honest at the pattern-matcher layer — there really is
a vague-trigger without a nearby citation. But it is mistaken at the
posture layer: the phrase is QUOTED meta-discussion of the trigger,
not an authority appeal grounded in the trigger.

**Justification for Path C.** Same as FP-012. Suppressing this via
allowlist defeats the corpus's purpose. The fix belongs in the
detector.

**Resolution vector.** Identical to FP-012: same-line quote-enclosed
matches skip **only if a metalinguistic noun (`phrase|term|...`)
appears within ±100 characters**. Same lockstep PR closes both.
Fixture covers both sample shapes.

**Cross-references:** [ADR-0023](./decisions/0023-phub-cli-and-detector-parity.md),
[ADR-0037](./decisions/0037-corpus-as-steering-wheel.md), related
FP-012 (same fix vector + peer-review addendum), detector at
[`apps/api/scanners/t8_fake_citation.py:295`](../apps/api/scanners/t8_fake_citation.py#L295).

### FP-013 Re-review log

_None yet — entry authored 2026-06-05._
