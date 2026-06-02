# ADR-0030: False-positive resolution as product discipline — the AV-vendor parallel

**Status:** Accepted
**Date:** 2026-06-01
**Related:** ADR-0016 (Top 10 versioning), ADR-0018 (Context Policy
Language), ADR-0023 (phub CLI + detector parity), ADR-0024 (SARIF +
GitHub Action), ADR-0025 (active surfaces + phub audit),
`docs/false-positive-resolution.md`, `docs/principles.md` Principles
19–20, `docs/positioning.md` § "Product-family parallel."

## Context

PrimitiveHub now ships scanners that flag attack patterns in agent
context. Three pieces of evidence make this an ADR-grade decision
rather than a hygiene note:

1. **Every scanner eventually flags content the project legitimately
   produces.** Our own `CLAUDE.md` trips T5 on its hard-rule prose
   forbidding the very pattern T5 detects (`docs/bugs.md` #25). A
   primitive teaching shadcn/ui composition trips T5 on the canonical
   `npx shadcn@latest` install command. These are *false positives in
   posture, not pattern matching*. The detector is correct; the content
   is correct; the categorical clash is structural.

2. **There is exactly one industry with 30 years of practice at this
   problem: anti-virus vendors.** Norton, McAfee, Kaspersky, ESET,
   Symantec, Sophos — they all converged on the same FP-handling
   discipline (numbered submission queues, narrow allowlist entries,
   periodic re-review, signature precision tuning) because the
   alternatives are documented failure modes: allowlist rot, scanner
   ignored by users ("crying wolf"), and over-tightened signatures
   that miss real attacks.

3. **The Context Policy Language v0.1 (ADR-0018) gives operators the
   *mechanism* to suppress findings narrowly, but specifies nothing
   about the *process* that decides when to suppress, what
   justification is required, when the suppression expires, or how to
   distinguish a domain-WAI from a detector defect.** That gap is a
   defect at the discipline layer.

This ADR closes the gap, names the AV-vendor parallel as load-bearing
strategy (not just a colorful framing), and locks the methodology
document as a versioned process artifact.

## Decision

### 1. Adopt the AV-vendor FP discipline as product behavior

The methodology lives in
[`docs/false-positive-resolution.md`](../false-positive-resolution.md)
as a versioned process document. Every PrimitiveHub surface that emits
findings — `phub scan`, `phub audit`, the Context CI pipeline, every
future active surface (lock / watch / install / MCP runtime gate) —
MUST integrate this methodology into its workflow.

**Five concrete practices we adopt:**

1. **Numbered append-only FP ledger.** Every accepted allow entry gets
   an `FP-NNN` identifier in `docs/false-positive-resolution.md` § 6.
   Identifiers never re-used. Modifications are append-only via a
   `Re-review log` subsection on the entry.
2. **Justification-required allowlist entries.** Every entry in
   `.primitivehub/policy.yaml`'s `allow:` array MUST carry a `reason:`
   field that references the matching `FP-NNN` ledger entry. A policy
   entry without a ledger entry is a defect.
3. **Narrow allow scope.** Specific file globs, specific detector IDs,
   specific `detail_tags`. The wildcards `**/*` and `id: "*"` are
   reserved for synthetic CLI overrides (`--allow-fail=*`) and are
   forbidden in committed policy.
4. **Periodic re-review cadence.** Quarterly + on every Top 10
   minor-version bump (ADR-0016). Default per-entry re-review date is
   +90 days from authorship. Stale entries are removed; ratcheted
   entries are documented in their `Re-review log`.
5. **Strict path-classification before suppression.** Every finding
   walks the four-path decision tree (true positive / domain WAI /
   detector defect / escalate to security-reviewer) defined in
   `docs/false-positive-resolution.md` § 1. Skipping the triage and
   silently adding an allow is a discipline failure.

### 2. Four practices we DO NOT adopt from the AV-vendor playbook

The parallel is load-bearing but it is not total. Reject these four
explicitly so future sessions don't accidentally import them:

1. **Heuristic FP scoring.** We use deterministic glob + ID matching.
   No probabilistic suppression, no "looks like" scoring, no
   ML-classified FP-vs-true-positive judgments. Determinism is
   auditable; heuristic isn't.
2. **Centralized signature database with proprietary update channel.**
   Our Top 10 (ADR-0016) is a versioned public spec; our detectors are
   open-source (Python in `apps/api/scanners/`, TS port in
   `packages/phub/src/scanners/` per ADR-0023). No phone-home, no
   subscription, no opaque updates.
3. **Quarantine-and-delete on detection.** We surface findings; we do
   not mutate the operator's working tree. Quarantine semantics belong
   to the future `phub watch` (ADR-0027) and even there the move is
   "refuse to admit into the lock," not "delete from disk."
4. **Cloud-lookup gating ("call home before allowing").** Our policy
   evaluation is local-first, air-gap safe (per ADR-0013, ADR-0023,
   ADR-0020). A factory disconnected from the internet must be able to
   audit, allow, and ship.

### 3. The AV product-family parallel is category-defining

This is the strategic half of the decision. PrimitiveHub is **not** a
registry with a side scanner. It is **the AV-product-family equivalent
for agent cognition**, with cryptographic provenance native to the
stack.

| AV product family | PrimitiveHub equivalent | State |
|---|---|---|
| On-demand scanner (`avscan file.exe`) | `phub scan AGENTS.md` | shipped (ADR-0023) |
| Full system scan | `phub audit .` | shipped (ADR-0025) |
| Signature database | Context CI Top 10 v0.1 | shipped (ADR-0016) |
| Signature precision tuning | Detector lockstep PRs (Python + TS) | shipped (ADR-0023) |
| Signature updater | Top 10 minor-version bumps + conformance suite | partially shipped (ADR-0021) |
| FP submission portal | `docs/false-positive-resolution.md` + the FP-NNN ledger | shipped (this ADR) |
| Allowlist / exception DB | `.primitivehub/policy.yaml` `allow:` array | shipped (ADR-0018) |
| On-access guard / real-time protection | `phub watch` | planned (ADR-0027) |
| Boot-time / pre-flight integrity check | `phub.lock` + `phub audit --check-lock` | shipped (ADR-0026) |
| HIPS / behavior blocker at runtime | MCP runtime gate (`verify_before_load`) | planned (ADR-0029) |
| Cloud lookup / reputation service | Trust API by-digest lookup | shipped (ADR-0013) |
| Provenance / signature attestation | Sigstore-keyless OIDC | shipped (Phase 4) |
| Quarantine vault | (not adopted — we surface, we don't mutate) | n/a by design |

When a customer asks "what kind of product is this?", the answer is
**"agent-context AV plus registry, with cryptographic provenance
native to the stack."** Not "GitHub for prompts." Not "Snyk for
skills." The AV product family is the closest existing category, and
it's the framing that survives competing platforms shipping their own
prompt registries — because they don't ship the AV-product-family
disciplines, and retrofitting those disciplines onto an existing
storage layer is the multi-year project AV vendors already did.

## Alternatives considered

1. **No formal FP process; ad-hoc allow entries with no audit trail.**
   Rejected. Same failure mode AV vendors learned about 25 years ago:
   allowlist rot, no one knows why entries exist, regressions appear
   on minor signature changes because no one re-reviews. The product
   becomes the "noisy boy who cries wolf" or worse — silently allows
   real attacks because some past allow was too broad.

2. **Treat every flag as terminal; require detector tightening before
   any allow.** Rejected. Conflates Path B (domain WAI) with Path C
   (detector defect). Some content legitimately documents attack
   patterns — the project's own threat-model prose, primitives that
   teach a framework's install command, adversarial test fixtures.
   Marketing copy and educational material cannot change shape to
   satisfy a regex.

3. **Allow entries in source-file comments instead of YAML policy.**
   Rejected. Comments don't survive refactor; can't be lint-checked;
   don't aggregate across files; bake security decisions into
   language-specific syntax (which surface — .md? .ts? .py?); and
   distribute the audit trail across the working tree instead of
   centralizing it where reviewers can scan it.

4. **Position PrimitiveHub as "GitHub for AI cognition" instead of as
   AV-product-family-plus-registry.** Rejected on positioning grounds.
   GitHub framing puts the storage layer first; the AV framing puts
   the *defense* layer first. The defense layer is the moat. GitHub
   can eventually ship trusted storage for prompts; they cannot
   eventually ship 30 years of AV-vendor process discipline grafted
   onto a marketplace UX. (See `docs/positioning.md` "The 'competing
   with monsters' question" — same play, sharper framing.)

5. **Ship the methodology document but skip the ADR.** Rejected. The
   AV-vendor parallel is a category-defining strategic decision that
   shapes positioning, principles, and every future product surface.
   Without an ADR, future sessions will rederive the framing or drift
   from it. ADR-grade discipline is the right tier.

## Consequences

### Positive

- **Auditable allowlist.** Every `allow:` entry traceable to a numbered
  ledger entry with full justification. Reviewers can verify
  legitimacy in seconds.
- **Decay-resistant.** Quarterly + version-bump re-review prevents
  allowlist rot. Detector precision improvements automatically retire
  obsolete allows.
- **Strategic clarity.** "Agent-context AV plus registry" is a
  positioning answer that survives competitor moves. GitHub /
  HuggingFace / Anthropic / OpenAI each face the AV-product-family
  build-out we've already started.
- **Hire-friendly.** The AV-vendor parallel maps engineering and
  product roles onto a familiar industry vocabulary: "FP triage
  engineer," "signature precision team," "policy reviewer." Future
  hires can step into known role shapes.
- **Customer-explanation friendly.** The supply-chain-for-AI category
  has been hard to explain. "Agent-context AV plus registry" is the
  five-word version that lands in one sentence.

### Negative

- **Process overhead per FP.** Every accepted FP is now a documented
  ledger entry, not a one-line YAML edit. Faster than detector
  tightening; slower than no process at all. We pay this cost
  deliberately.
- **Reviewer judgment required.** The Path C / Path D split (detector
  defect vs. ambiguous) requires a security-reviewer role, which the
  project has but hasn't yet exercised heavily. Risk: bottleneck on
  the maintainer until the role bench grows.
- **Drift risk between the methodology doc and the policy file.** If
  someone edits one without the other, the audit trail breaks. CI
  check planned (see § Implementation).

### Neutral

- **The methodology is process discipline, not code.** It governs how
  humans use the policy mechanism, not how the policy mechanism is
  implemented. ADR-0018 still defines the mechanism; this ADR governs
  its use.
- **The AV-vendor parallel is a framing, not a license to import
  every AV practice.** § 2 above names four explicit non-adoptions.

## Implementation

Already landed in this PR:

- `docs/false-positive-resolution.md` — methodology + ledger (§1–§5
  + §6 starter entries FP-001, FP-002).
- `.primitivehub/policy.yaml` — project-level policy with FP-001
  + FP-002 entries.
- `docs/bugs.md` #25 — "operationally resolved via FP-001" line added.
- `docs/decisions/0018-context-policy-language.md` —
  "False-positive resolution methodology" supplement.
- This ADR (0030).

Landing in follow-ups (tracked, not blocking):

- **CI check:** a GitHub workflow that validates `policy.yaml` entries
  have matching `FP-NNN` ledger entries in
  `docs/false-positive-resolution.md`. Drift detection.
- **`phub policy explain <file>`:** dry-run mode showing which allow
  entries would fire on a file (cited in ADR-0018's "Implementation"
  section as v0.2 work).
- **Quarterly re-review action item:** added to the maintainer's
  routine when the first 90-day mark hits (2026-09-01).

## Strategic implications

This ADR is the place to point future contributors when they ask:

- "Why is there so much process around an allow entry?" — § 1 + § 3.
- "What is PrimitiveHub, really?" — § 3 product-family table.
- "Why don't we just tighten the detector?" — § 1 path classification
  + § alt. 2.
- "Is this just a registry?" — § 3.
- "Why does the policy file have a `reason:` field?" — § 1 practice 2.
- "When can I remove an allow entry?" — § 1 practice 4.

When the paper coordinates with launch (Phase 10), the AV-product-
family framing is the elevator pitch. The threat model justifies the
detectors; the spec defines the contract; **this ADR names the
category we ship into.**

## References

- `docs/false-positive-resolution.md` — methodology + ledger
- `.primitivehub/policy.yaml` — project-level allow entries
- `docs/principles.md` Principle 19 (active by default), Principle 20
  (FP discipline)
- `docs/positioning.md` § "Product-family parallel"
- ADR-0016 — Top 10 versioning + stable IDs
- ADR-0018 — Context Policy Language v0.1 (mechanism this ADR
  governs)
- ADR-0021 — Conformance suite (signature-updater equivalent)
- ADR-0023 — phub CLI + detector parity (signature-precision-tuning
  equivalent)
- ADR-0025 — Active surfaces + phub audit (full-system-scan
  equivalent)
- `docs/bugs.md` #25 — canonical motivating false positive
- `docs/threat-model.md` — what the detectors are designed to find
