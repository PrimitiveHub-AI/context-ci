# ADR-0043: External-skill consumption discipline + skill-consumption ledger

**Status:** Accepted
**Date:** 2026-06-09
**Related:** `CLAUDE.md` Hard-rule #6 (the policy this operationalizes),
ADR-0025 (active posture + `phub audit`), ADR-0030 (FP resolution +
AV-vendor parallel), ADR-0023 (detector parity), `docs/threat-model.md`
(T5 unsafe-shell-install), `docs/false-positive-resolution.md` (the
FP-NNN ledger this mirrors), `feedback-skill-consumption-receipt` memory,
`apps/web/content/primitives/discovery-and-design-discipline.md`.

## Context

`CLAUDE.md` Hard-rule #6 forbids the `npx skills add …` install path and
mandates that external AI skills be **read into `/tmp`, distilled into a
spec-conformant primitive, and the source deleted** — the `npx` path is
treated as a T5 (unsafe-shell-install) supply-chain vector.

Between 2026-06-07 and 2026-06-09 the rule was exercised four times in
one working session (the `frontend-design`, `brainstorming`,
`product-brainstorming`, and `minimalist-ui` skills). Running the policy
as a repeatable procedure surfaced three gaps the one-line rule did not
cover, and one of them is a genuine tool defect:

1. **`phub audit` reported "1/1 artifacts clean" on a skill directory
   while the skill's `skill.sh` / `server.cjs` were never reviewed.**
   `phub audit` inventories *agent-context artifacts* and runs the Top 10
   over the text-scannable ones (ADR-0025); it does not — and does not
   claim to — review executable code. But it said nothing about the code
   it skipped, so "clean" read as "safe." That false comfort is the exact
   shape of a T5 miss.
2. **No pinned provenance.** Sources were cloned from a moving `HEAD`
   then deleted, leaving no reproducible reference — a contradiction of
   the project's content-addressing doctrine.
3. **"Disposition" (merge / new / reject) was implicit.** The most
   important decision in a consumption — whether to admit the skill at
   all — lived only in conversation. `minimalist-ui` was the first
   *reject*, which proved the step must be explicit (bloat-control +
   `feedback-extract-reusable`).

This is the same product frame as ADR-0030's AV-vendor parallel: ingest
an untrusted artifact → quarantine → scan → admit-or-reject → record. The
discipline already exists for policy false-positives (the FP-NNN ledger);
skill consumption deserves the equivalent.

## Decision

### 1. Consumption is a six-step procedure, not four.

Every `npx skills add …` request is served by this sequence; the source
is **never** installed via `npx`:

1. **Fetch, pinned** — `git clone` (shallow) into
   `/tmp/primitivehub-skills/`; record the commit SHA. Never the `npx`
   execution path.
2. **Quarantine** — treat the staged tree as untrusted; do not run any
   script it ships.
3. **Audit, whole-tree** — `phub audit <dir>` **plus** a manual review of
   every file `phub` did not classify (executables, auto-loaded
   instruction files). `phub audit` now emits an *uncovered-surface*
   warning (see §3) so this step cannot be skipped by accident.
4. **Disposition** — decide **merge** (fold signal into an existing
   primitive), **new** (author a new primitive), or **reject** (redundant
   or conflicting; admit nothing, or lift only named mechanisms). Default
   to merge-or-reject over new (bloat-control).
5. **Distill, don't copy** — translate the transferable signal into
   spec-conformant primitive(s), re-keyed to this codebase; record what
   landed where + the version bump.
6. **Delete + log** — remove the staged source; append a receipt to the
   ledger (§2). Deletion satisfies Hard-rule #6; the receipt preserves
   the audit trail without keeping the attack surface live.

### 2. The skill-consumption ledger (SK-NNN).

`docs/skill-consumption-ledger.md` is an **append-only** ledger mirroring
the FP-NNN format. One numbered `SK-NNN` entry per consumption, recording:
source URL + **pinned SHA**, requested skill, `phub audit` result, the
whole-tree finding, disposition, where the signal landed, and date. A
distilled primitive's frontmatter `author:` line cites its `SK-NNN`.

### 3. `phub audit` surfaces uncovered surface (tool change, shipped).

`phub audit` (TS CLI) now reports walked-but-unclassified **executable**
files (`.sh`, `.js`, `.cjs`, `.py`, …) as a non-failing
`WARN: uncovered surface` block, and qualifies the final line
(`… clean — but N uncovered files need separate review`). This does
**not** change the exit code (so existing CI gates / the `phub-scan`
action are unaffected) and introduces **no new detector**, so the
ADR-0023 Python↔TS parity rule is untouched — it is an orchestration /
reporting change in the audit kernel only. Implementation:
`packages/phub/src/audit/uncovered.ts` + reporter + a regression test.

### 4. The full `phub skill add` command is deferred (owner-gated).

A first-class `phub skill add <url>` that automates steps 1–3 + writes the
SK-NNN receipt is the intended end-state — it gives Hard-rule #6's named
enemy (`npx skills add`) a sanctioned, auditable replacement. It is **not**
built in this ADR: the `phub` CLI is part of the owner-gated public
distribution repo (`primitivehub/context-ci`, ADR-0045), and adding a
network-fetching subcommand is a load-bearing CLI scope decision that
waits for an explicit owner greenlight. Distillation stays human/agent
judgment regardless — a tool can fetch and scan, but it cannot author a
good primitive.

## Consequences

- **Positive:** "clean" can no longer be misread as "safe"; every
  consumption is reproducible (pinned SHA) and auditable (SK-NNN);
  "reject" is a first-class outcome that protects against primitive
  bloat; the discipline is enforced by a tool warning, not memory alone.
- **Cost:** each consumption now writes a ledger entry (cheap); the
  uncovered-surface warning adds output noise on repos with many scripts
  (acceptable — the warning is the point).
- **Non-goal:** `phub audit` is still not a code scanner / SAST. The
  warning points at the surface; reviewing it is a separate job.
- **Revisit when:** the owner greenlights `phub skill add` (promote §4
  to a follow-up ADR), or a future skill ships an executable that warrants
  actual code-scanning (a distinct detector family, its own ADR).

## Alternatives considered

- **Make `phub audit` fail (exit 1) on uncovered executables.** Rejected:
  it would break the `phub-scan` CI gate on any repo that legitimately
  ships scripts, and conflates "un-reviewed" with "malicious." A loud
  warning is the honest severity.
- **Keep the source instead of deleting it.** Rejected: Hard-rule #6
  treats the staged source as attack surface; the pinned SHA in the
  ledger makes it re-fetchable without keeping it live.
- **One primitive per source skill, always.** Rejected: forces bloat when
  skills overlap (two brainstorming skills → one primitive) or conflict
  (a light-editorial skill against our dark theme → reject). Disposition
  must be a judgment, not a default.
