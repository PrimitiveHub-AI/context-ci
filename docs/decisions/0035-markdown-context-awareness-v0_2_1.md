# ADR-0035: Markdown context awareness in scanners — v0.2.1 (frontmatter + inline-code + fenced-code)

**Status:** Accepted
**Date:** 2026-06-04
**Related:** ADR-0016 (Top 10 versioning), ADR-0023 (detector parity),
ADR-0030 (FP resolution + AV-vendor parallel), ADR-0032 (adversarial
corpus), `docs/false-positive-resolution.md` § 6 (FP-001..005),
`docs/bugs.md` § 25 + § 27.

## Context

The v0.1 detector roster (T1..T10) matches regex patterns against raw
content. It cannot distinguish:

- **Frontmatter** (the YAML block at the head of a primitive declaring
  its `license:`, `author:`, `references:` URLs) from **body text**
  (the prose / code that primitives ship).
- **Inline code** (backtick spans like `` `npx shadcn@latest add Button` ``
  that are *referencing* a third-party command, not executing it) from
  **top-level instruction prose** ("run `npx foo` to install").
- **Fenced code blocks** that are *documenting* an attack pattern with
  explicit "DO NOT RUN" framing, from a fence that is actually
  instructing the agent to run code.

Five accepted false positives in `docs/false-positive-resolution.md`
§ 6 trace to this gap:

| FP | Detector | Trigger context |
|---|---|---|
| FP-001 | CCI-005 | CLAUDE.md prose teaching the T5 vector by name (negation context) |
| FP-002 | CCI-005 | Inline-code `` `npx shadcn@latest add <component>` `` in a primitive teaching shadcn/ui |
| FP-003 | CCI-009 | Frontmatter `license: CC-BY-4.0` declaration in every cognition primitive |
| FP-004 | CCI-009 | Body-text reference to `CC-BY-4.0 (corpus content)` in CLAUDE.md's canonical-docs table |
| FP-005 | CCI-007 | Body-text mentions of real vendor names (Stripe / Vercel / Linear / Sigstore) as design exemplars; one hit is a frontmatter URL list |

[`docs/bugs.md`](../bugs.md) § 25 named markdown-AST awareness as the
v0.2 prevention work for this entire class of false positive. This ADR
ships **the tractable half** — context awareness for three syntactic
constructs that are precisely defined by markdown syntax:

1. **Frontmatter blocks** (`---\n...\n---\n` at file head)
2. **Inline code spans** (`` `...` `` runs on a single line)
3. **Fenced code blocks** (` ``` ` or `~~~` delimited multi-line regions)

The harder half — **semantic context** (negation prose, mention vs.
impersonation, "DO NOT RUN" framing) — is deferred to a future ADR.
That work needs heuristic or model-based analysis; this ADR covers
what plain markdown syntax can answer deterministically.

## Decision

### 1. Ship a zero-dep markdown context analyzer on both sides

**TS:** `packages/phub/src/scanners/markdown-context.ts` — pure
function `analyzeMarkdownContext(content: string)` returning:

```ts
interface MarkdownContext {
  frontmatterEndOffset: number              // 0 if no frontmatter
  fencedRanges: ReadonlyArray<readonly [number, number]>   // [start, end] half-open
  inlineCodeRanges: ReadonlyArray<readonly [number, number]>
}
```

**Python:** `apps/api/scanners/markdown_context.py` — same shape,
returns a `MarkdownContext` dataclass.

Plus three context predicates on each side:

- `isInFrontmatter(offset, ctx)` / `is_in_frontmatter(offset, ctx)`
- `isInFence(offset, ctx)` / `is_in_fence(offset, ctx)`
- `isInInlineCode(offset, ctx)` / `is_in_inline_code(offset, ctx)`

**No new runtime dependencies.** The analyzer is hand-rolled
(~150 lines per side), tuned to the markdown subset the threat model
cares about. Adding `remark` (TS, ~150KB minified) or `mistune` (Python,
~50KB) would defeat the package's zero-deps narrative and tie the
detector behavior to upstream parser versioning. The hand-rolled
analyzer trades coverage of obscure markdown for the auditability of
~300 lines of code reviewers can read in 10 minutes.

### 2. Detector opt-in (not global)

Each detector decides for itself which contexts to skip. This is
**explicit rather than implicit** — a detector that should fire on
inline code (e.g., a future CCI-001 family that catches role-hijack
prompts embedded in code spans) is not silently muted.

Initial opt-ins (v0.2.1):

| Detector | Skips |
|---|---|
| CCI-005 (`t5.unsafe_shell_install`) | frontmatter + inline-code + fenced-code — install commands in any of these contexts are reference material, not execution instructions |
| CCI-007 (`t7.poisoned_naming`) | frontmatter — vendor URLs in `references:` lists are not impersonation; vendor mentions in body prose still flag (closes pending v0.2.2 work) |
| CCI-009 (`t9.copyright_contamination`) | frontmatter + inline-code — license declarations in frontmatter and license strings in code references are not borrowed content |

Other detectors (CCI-001..004, CCI-006, CCI-008, CCI-010) remain
context-unaware until evidence shows they have FPs that the v0.2.1
contexts would close.

### 3. Detector-parity rule applied (ADR-0023 lockstep)

The TS analyzer and the Python analyzer MUST produce identical context
boundaries for the same input. Cross-language parity is tested by:

- Unit tests on each side using the same fixture markdown.
- The corpus measurement (`bench/scripts/measure.{ts,py}`) — TS + Python
  detectors run against the same labeled samples; any FP that the TS
  side closes but the Python side doesn't (or vice versa) is a parity
  defect that blocks the merge.

### 4. What gets removed when this lands

Per `docs/false-positive-resolution.md` § 1 the Path-C exit removes
policy entries. v0.2.1 closes:

- **FP-002 (shadcn primitive npx in inline code)** → policy entry removed,
  ledger entry gets a `### Re-review log` subsection documenting the
  v0.2.1 closure date.
- **FP-003 (primitives license: CC-BY-4.0 in frontmatter)** → same.

v0.2.1 does **NOT** close:

- **FP-001 (CLAUDE.md teaches T5 by name)** — needs negation-context
  awareness (v0.2.2).
- **FP-004 (CLAUDE.md body-text reference to corpus license)** — needs
  body-text license-mention-vs-declaration heuristic (v0.2.2).
- **FP-005 (vendor names in design-elite body)** — needs
  mention-vs-impersonation awareness (v0.2.2). One hit (line 35,
  frontmatter URL list) closes; the other 5 stay.

The ledger entries for FP-001 / FP-004 / FP-005 each get a
`### Re-review log` subsection noting which v0.2.x ratchet retired
which hits, with the remaining open-status carried forward.

## Alternatives considered

1. **Adopt `remark` + `mistune` for full markdown AST coverage.**
   Rejected for v0.2.1. ~200KB of runtime dependency to close 2-3
   FPs is the wrong trade. The zero-deps narrative is a stated
   discipline (ADR-0023's hand-rolled argv parser carries this same
   logic). When v0.2.2's mention-vs-impersonation work needs real
   parsing, the choice may flip; this ADR doesn't preclude that.

2. **Run a separate AST normalization step in `runScan` / `runAudit`
   and pass the AST to every detector.** Rejected. Most detectors
   don't need context awareness (CCI-002 unicode steganography fires
   correctly on raw bytes; CCI-010 context-bloat measures total token
   count). Forcing every detector to thread an AST argument adds API
   surface for a benefit only ~3 of 10 detectors consume. Detector
   opt-in via inline `analyzeMarkdownContext()` call is the cleaner
   shape.

3. **Negation/mention-vs-impersonation awareness in this PR.**
   Rejected for scope. Those need heuristic analysis (sentence-boundary
   detection, dependency-style scoping) that doesn't fit in
   "hand-rolled in 150 lines." Honest v0.2.1 → v0.2.2 split keeps each
   PR reviewable.

4. **Global "skip everything in code blocks" with no per-detector
   override.** Rejected. CCI-002 (Unicode steganography) MUST fire on
   zero-width characters embedded in code spans — a malicious
   primitive could try to hide steganography inside backticks
   precisely to evade context-aware detectors. Per-detector opt-in
   forces each owner to argue what their threat model demands.

## Consequences

### Positive

- **FP-002 + FP-003 close at the detector level, not the policy
  level.** Policy file shrinks from 5 entries to 3. Two ledger
  entries earn their "Resolved via Path-C" close-out — proving the
  FP discipline locks the loop ADR-0030 § 1 promised.
- **Corpus baselines ratchet on the closed FPs.** CCI-005 P/R/F1
  improves on the seed corpus; CCI-009 ditto. Numbers the paper can
  cite reflect the detector-level work, not the policy patches.
- **No new runtime deps.** `phub` stays minimal; the zero-deps
  narrative is preserved.
- **Lockstep discipline exercised on a real cross-language change.**
  The corpus measurement scripts catch parity drift in CI, not just
  in code review.

### Negative

- **Hand-rolled markdown context analyzer misses edge cases.** The
  ~150-line analyzer recognises the 99% common shape; obscure
  markdown variants (HTML embedded code, indented code blocks
  without fences, nested fences) may fall through. Mitigation: unit
  tests cover the cases the corpus has; future corpus samples that
  expose gaps drive incremental tightening.
- **v0.2.1 is partial.** Three FPs stay open. Reviewers reading
  `policy.yaml` will see entries with "Resolved via v0.2.2 (pending)"
  notes — honest, but a discipline-debt signal until v0.2.2 lands.

### Neutral

- **Per-detector opt-in costs explicit work per detector.** Adding a
  new detector that needs context awareness means a one-line call to
  `analyzeMarkdownContext()` + a filter loop. Cheap, but explicit.
- **The fenced-code threat-model trade-off is locked here.** A
  malicious primitive that puts attack content INSIDE a fence to
  evade T5 v0.2.1 is a known limitation — the detector author's
  v0.1 docstring already acknowledged the false-positive-vs-
  false-negative trade. v0.2.1 prefers fewer false positives at this
  one detector; if real-world incidents show fence-evasion T5
  attacks, the detector flips back to fence-aware-with-flag-anyway.

## Implementation

`packages/phub/`:
- `src/scanners/markdown-context.ts` — analyzer + predicates + tests.
- `src/scanners/t5-unsafe-shell-install.ts` — opt-in via
  `analyzeMarkdownContext()` + filter loop on the existing match
  loop. Pattern set unchanged.
- `src/scanners/t7-poisoned-naming.ts` — opt-in (frontmatter only).
- `src/scanners/t9-copyright-contamination.ts` — opt-in (frontmatter
  + inline-code).
- `test/markdown-context.test.ts` — analyzer unit tests.
- Detector-specific tests extended in their existing test files.

`apps/api/scanners/`:
- `markdown_context.py` — same shape, Python.
- `t5_unsafe_shell_install.py` — same opt-in.
- `t7_poisoned_naming.py` — same opt-in.
- `t9_copyright_contamination.py` — same opt-in.
- `tests/test_markdown_context.py` + extensions to existing detector
  tests.

`bench/`:
- Both `measure.ts` + `measure.py` re-run to produce updated baselines
  (`bench/baseline/2026-06-04-{ts,py}.json` will be over-written or a
  new dated baseline added).

`docs/`:
- `docs/false-positive-resolution.md` § 6 — FP-002 + FP-003 get
  `### Re-review log` subsections marking closure date + the v0.2.1
  ratchet. FP-001 / FP-004 / FP-005 get notes marking which hits
  closed (where any did) and what's still pending v0.2.2.
- `.primitivehub/policy.yaml` — FP-002 + FP-003 entries removed.
- `.primitivehub/phub.lock` — re-stamped (no content changes, but
  detectors return cleaner verdicts; lock format pins state, not
  verdicts, so this is mostly a digest reaffirm).
- `docs/bugs.md` § 25 — append closure update referencing this ADR.

## What ships in subsequent PRs

- **ADR-0036 (planned) — Negation + mention-vs-impersonation
  awareness (v0.2.2).** Closes FP-001, FP-004, FP-005. Heuristic
  approach (negation keyword scoping, mention-context classifier)
  OR adoption of a real parser if the heuristic falls short.
- **Per-PR detector audit-on-self gate** in `phub-ci.yml` (per
  `docs/bugs.md` § 27 prevention notes) — wires `phub audit
  --check-lock` into the CI matrix on detector-touching PRs.
- **Corpus expansion** to volume target (per ADR-0032 — v0.2 corpus
  target = 100+ samples).

## References

- `docs/false-positive-resolution.md` — methodology + ledger (the FPs
  this ADR partially closes)
- `docs/bugs.md` § 25 — the canonical motivating FP class
- `docs/bugs.md` § 27 — the inter-session batch-FP discipline gap
- ADR-0016 — Top 10 versioning (this ADR is a v0.1 → v0.2.1 detector
  ratchet, not a Top 10 spec ratchet)
- ADR-0023 — Detector parity (TS + Python lockstep)
- ADR-0030 — FP resolution methodology (Path C is what this ADR
  ships)
- ADR-0032 — Adversarial corpus (the measurement layer this ADR
  ratchets)
