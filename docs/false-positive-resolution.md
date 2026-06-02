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
