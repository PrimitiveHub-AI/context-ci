# Security

PrimitiveHub is the Context Firewall for AI agents. Reporting a missed
attack shape, a false positive that hurts a real primitive, or a
genuine vulnerability in our infrastructure all matter. This file
documents how we'd like to hear from you, and how we respond.

## TL;DR

| You found | Send it to | Track at |
|---|---|---|
| A missed attack the corpus should catch (false negative) | Open a PR adding a sample + manifest entry | [`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md) |
| A real primitive being flagged that shouldn't be (false positive) | Open a PR with a reproducer | [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md) |
| A vulnerability in PrimitiveHub itself (infra, signing, RLS, etc.) | Email `security@primitivehub.ai` (PGP below) | Private until fixed; bounty per [`SECURITY-BOUNTY.md`](./SECURITY-BOUNTY.md) |
| You're not sure | Email `security@primitivehub.ai` and we'll triage | — |

If you can't tell whether your finding is a false-negative report, a
false-positive report, or a vulnerability — send it to
`security@primitivehub.ai` and we'll route it. We will not penalize a
mis-categorized report.

**Bug bounty programme:** scope, severity bands, response timelines, and
safe harbour are documented in [`SECURITY-BOUNTY.md`](./SECURITY-BOUNTY.md).
Pre-launch reports are gratefully accepted; payouts queue and turn on at
launch (Gate G-G).

## Why this file exists

PrimitiveHub is "agent-context AV plus registry"
([ADR-0030](./docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md)).
The classical AV-vendor playbook has a public lane for "report a missed
sample" (the FN submission portal) and a public lane for "report a
false positive" (the dispute portal). We carry both lanes from day one:

- **FN submissions** become numbered entries in
  [`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md)
  (FN-001, FN-002, …). Each entry classifies into one of four
  resolution paths: detector tightening, corpus relabel, policy
  carve-out, or spec gap. The corpus regression gate
  ([ADR-0037](./docs/decisions/0037-corpus-as-steering-wheel.md))
  enforces the closure measurement.
- **FP submissions** become numbered entries in
  [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md)
  (FP-001, FP-002, …) — the equal-and-opposite ledger, same four-path
  discipline.
- **Vulnerability reports** follow standard responsible-disclosure: we
  triage, fix, credit (if desired), and write a public post-mortem
  under [`docs/bugs.md`](./docs/bugs.md) once a fix has shipped.

## Scope

In scope for security@primitivehub.ai:

- The PrimitiveHub registry web app, API, and worker.
- The `@primitivehub/phub` CLI and the audit / lock / watch / install /
  MCP gate surfaces.
- The Trust Bundle signing, verification, and attestation paths.
- The Context CI scanners themselves (logic bugs, panics, regex
  catastrophic backtracking).
- Anything that bypasses tenant isolation (RLS, IDOR, cross-org reads).

In scope for the FN / FP ledgers (PR-based, public):

- The Context CI Top 10 detectors and the corpus they're measured on.

Out of scope (please don't send these as security reports):

- Aesthetic critiques of the UI or copy — use a regular GitHub issue.
- Performance complaints about local dev experience.
- Feature requests, naming debates, roadmap arguments.

## Reporting a vulnerability

**Email:** `security@primitivehub.ai`
**PGP fingerprint:** see <https://primitivehub.ai/.well-known/security.txt>
(published with the public launch — pre-launch, request the key by
email and we'll send it inline).

Please include:

1. A short description of what you found.
2. The component (web / API / CLI / scanner / MCP gate / signing).
3. A reproducer or proof-of-concept if you can share one.
4. Whether you'd like to be credited in the post-mortem.

We aim to acknowledge within **3 business days** and to ship a fix
within **30 days** for severity ≥ medium. We will keep you in the loop
on the timeline if either window is at risk.

## Reporting a missed attack (false negative)

If `phub audit` / `phub scan` / the Context CI pipeline let an attack
through, the fix is to add it to the corpus and let the gate enforce
detection. Open a PR with:

1. A new sample file under
   `bench/corpus/samples/cci-<NNN>-<family>/adversarial-NNN-<slug>.md`.
2. A new entry in `bench/corpus/manifest.yaml` (see the schema in
   [`docs/corpus-v0.1.md`](./docs/corpus-v0.1.md) § "Manifest schema").
3. A short note in the PR description naming which detector should
   catch this and why.

A maintainer will run `bench/scripts/gate.sh`; if the new sample is
genuinely a missed attack, the gate will fail (recall drop) and the
detector ratchet PR follows. See
[`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md)
§1 for the four resolution paths — please classify your submission
before proposing a fix.

## Reporting a false positive

If a real primitive is being flagged that shouldn't be, the cleanest
report is a minimal reproducer:

1. The primitive content (markdown).
2. The verdict output (`phub audit <file>` or `phub scan <file>`).
3. Why this should pass (which AV product-family slot — vendor doc,
   defender prose, license metadata, etc.).

Open it as a PR adding the reproducer to
`bench/corpus/samples/cci-<NNN>-<family>/benign-NNN-<slug>.md` and a
manifest entry with `label: benign`, `expected_verdict: PASS`. The
gate will tell us if the current detector fires on it (FP) or already
passes (no detector change needed; close the PR).

See
[`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md)
§1 for the four resolution paths — please classify your submission
before proposing a fix.

## What we will not do

- We will not silently accept allow-list entries in
  `.primitivehub/policy.yaml` without a matching `FP-NNN` ledger entry
  in the same commit. This is enforced socially right now; will be
  CI-enforced in a future PR. See [Hard rule 8 in
  CLAUDE.md](./CLAUDE.md) for the rationale.
- We will not roll back a detector ratchet to bypass an FP without an
  ADR-level decision. The corpus is the steering wheel
  ([ADR-0037](./docs/decisions/0037-corpus-as-steering-wheel.md));
  silent detector relaxations defeat its purpose.
- We will not publicly disclose a vulnerability before a fix ships,
  unless the reporter asks us to.

## Acknowledgements

Reporters who contribute corpus samples, FP reproducers, or
infrastructure security findings will be credited in:

- The numbered ledger entry (`FN-NNN` / `FP-NNN`), with attribution
  field.
- `docs/bugs.md` for infrastructure incidents (post-mortem, after the
  fix lands).
- The arXiv paper acknowledgments section, for substantive
  contributions to the corpus or methodology.

Thank you for helping make agent-context safer to consume.
