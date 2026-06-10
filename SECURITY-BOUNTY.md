# PrimitiveHub Security Bug Bounty

> **Status:** Pre-launch staging. The scope, severity bands, and
> response process below are final and will not change between now
> and launch. **Reward payouts and the public intake address turn
> on at launch (Gate G-G).** Pre-launch reports are gratefully
> accepted via the same address; we credit reporters in the public
> ledger at the time we ship the fix.

PrimitiveHub ships a security product. The bounty exists for one
reason: to make finding and reporting a real vulnerability in our
infrastructure cheaper for you than exploiting it. We pay for
findings that protect the verifier kernel, the registry, the trust
chain, and the operational surfaces every consumer rides.

This document is the canonical scope. The TL;DR-style triage in
[`SECURITY.md`](./SECURITY.md) routes you to the right lane;
[`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md)
and [`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md)
cover the AV-vendor-style detector dispute lanes. This file is
specifically the **vulnerability lane** — the equivalent of an AV
vendor's "compromise the scanning engine itself" report.

## 1. Where to report

| You found | Lane | Reward |
|---|---|---|
| A vulnerability in PrimitiveHub infrastructure (signing, RLS, API, worker, registry, CLI, MCP server, GitHub Action, verify kernel) | **Bounty (this document)** — email `security@primitivehub.ai` (PGP below) | Yes, per § 4 |
| A missed attack the corpus should catch (false negative) | [`docs/false-negative-resolution.md`](./docs/false-negative-resolution.md) — open a PR with a sample + manifest entry | Credit in the FN ledger; no cash bounty |
| A legitimate primitive being flagged (false positive) | [`docs/false-positive-resolution.md`](./docs/false-positive-resolution.md) — open a PR with a reproducer | Credit in the FP ledger; no cash bounty |
| You can't tell which lane | Email `security@primitivehub.ai`; we route. **We will not penalize a mis-categorized report.** | Routed appropriately |

The cash bounty is exclusively for the vulnerability lane. The
detector dispute lanes have their own credit currency (numbered
ledger entries, public co-authorship on the closure post-mortem)
because finding a missed attack class is a research contribution,
not an infrastructure compromise.

## 2. In scope

The following surfaces are in scope for this bounty:

### Cryptographic and trust chain

- The `@primitivehub/verify` kernel — anything that breaks the
  Trust Contract guarantee (digest match, Sigstore signature
  validation, Rekor inclusion proof, in-toto Statement parsing,
  attestation predicate evaluation, policy enforcement)
- Trust Bundle parsing — schema confusion, length-prefix bugs,
  canonicalisation mismatches, polyglot bundles
- The Sigstore integration glue — anything that lets a forged or
  expired Fulcio cert pass verification, anything that lets a
  Rekor entry be substituted

### Web app (registry + Forge + /check)

- Authentication and authorisation — anything that lets one
  organisation read or write another's data
- Row-Level Security bypass — anything that lets a queryset
  resolve a record outside the requesting organisation
- IDOR, SSRF, XSS, CSRF, SQL injection, prototype pollution, SSTI
- Session fixation / hijacking — including Authentik OIDC issues
- Cross-tenant cache poisoning or content confusion

### CLI, GitHub Action, MCP server

- Path traversal in `phub install` writer-safety rules
- Symlink and TOCTOU bugs in `phub audit` / `phub watch`
- Bundle confusion — getting the CLI to install a bundle it should
  have refused
- MCP runtime gate bypass — getting `verify_before_load` to return
  ok=true for a bundle that should fail one of the seven stable
  refusal codes
- GitHub Action token escalation or workflow exfiltration

### Scanner kernel correctness (security-critical only)

- A detector that returns `pass` on a sample documented as
  adversarial in the corpus — and the cause is a kernel bug, not
  a corpus labelling dispute (those go to the FN lane)
- A detector that crashes or hangs on a crafted input under any
  documented resource limit

### Infrastructure

- Container escape from any PrimitiveHub-operated service
- Privilege escalation within any service or worker
- Sensitive data exposure in logs, error responses, or backups
- Anything that lets an unauthenticated client mutate the registry

## 3. Out of scope

Reports in the following categories do not qualify for cash
bounty. Several of them are still welcome via the appropriate
lane below.

- **Corpus dispute** — disagreement with the labelling of a
  specific sample. Route: open a PR against
  `bench/corpus/manifest.yaml` and link to the
  [false-negative](./docs/false-negative-resolution.md) /
  [false-positive](./docs/false-positive-resolution.md) ledger.
- **Detector heuristic dispute** — disagreement with a detector's
  precision / recall trade. Route: open an FN or FP ledger entry;
  precision and recall changes ride through the ratchet
  discipline in [ADR-0037](./docs/decisions/0037-corpus-as-steering-wheel.md).
- **Spec disagreement** — disagreement with the Top 10 taxonomy,
  the Trust Contract field semantics, or any other versioned spec.
  Route: open a `doctrine-rfc` issue per
  [ADR-0019](./docs/decisions/0019-doctrine-versioning-policy.md).
- **Third-party vulnerabilities you discovered through us** — we
  do not pay for issues whose root cause is in Sigstore, GitHub,
  npm, Authentik, Postgres, Procrastinate, or Valkey. We do credit
  reporters who discover them via PrimitiveHub use.
- **Findings that require physical access, social engineering, or
  compromise of a PrimitiveHub maintainer's personal account.**
- **Best-practice recommendations** without a demonstrable
  exploit (e.g. "you should add this HTTP header"). We welcome
  these as PRs.
- **DoS via volume.** We rate-limit. A submission that says
  "I can submit 10,000 /check requests per second" is not a
  vulnerability; we'd like you to slow down. A submission that
  says "I crashed your worker with this one input" is a
  vulnerability.
- **Self-XSS, missing security headers without a paired exploit,
  CSV injection, clickjacking on pages that do not perform
  privileged actions.**
- **Tab-nabbing, login / logout CSRF, lack of email verification
  rate-limiting** unless paired with a concrete account-takeover
  chain.
- **Open redirects** without a paired session, token, or
  credential exposure.
- **Issues in code that explicitly states "demo data," "sample,"
  or carries `<DemoDataBadge>` / `<PlannedBadge>`** — these
  surfaces do not ship to production users.

If a report sits between in-scope and out-of-scope, email us
anyway. The triage decision is on us, not on you.

## 4. Severity and rewards

We use the following bands. Payout windows are intentional —
they leave room for exceptional impact within a band. Exact
amount is calibrated to demonstrable impact, exploitability, and
quality of report.

> **Pre-launch:** payouts queue. We credit pre-launch reporters
> in the public closure ledger at the time the fix ships, and
> issue the reward at launch alongside the public bounty
> programme. Pre-launch reporters are eligible for retroactive
> payout under the same bands.

| Severity | Band (USD) | Example |
|---|---|---|
| **Critical** | $3,000 – $10,000 | Verifier kernel accepts a forged Sigstore signature; cross-tenant RLS bypass on a published primitive; remote code execution on any PrimitiveHub-operated service; bypass of `verify_before_load` returning `ok=true` for any tampered bundle. |
| **High** | $1,000 – $3,000 | Authenticated cross-organisation IDOR; full Rekor inclusion check bypass; `phub install` writes a file outside the install target; CI secret exfiltration via the GitHub Action. |
| **Medium** | $300 – $1,000 | Authenticated information disclosure across organisations; stored XSS in primitive content rendering; CSRF on a state-changing endpoint with limited scope; bypassing rate limits on `/check`. |
| **Low** | $100 – $300 | Unauthenticated information disclosure (low-sensitivity); reflected XSS without authenticated impact; missing security header paired with a demonstrable narrow exploit. |
| **Documentation / hardening** | $0 – $100 | Substantive doc errors that mislead operators about security guarantees; subtle hardening improvements that prevent a documented future class of bug. |

A single report describing **multiple distinct vulnerabilities**
is rewarded as the sum of per-vulnerability bands (within reason —
we will not pay 200 × $100 for the same input-validation gap
discovered in 200 endpoints).

## 5. How to report

Send a single email to `security@primitivehub.ai`. Subject prefix
your subject line with `[bounty]` so the routing is automatic.

Include:

1. **One-line summary** of the finding.
2. **Affected component(s)** — registry web app, CLI, MCP server,
   verify kernel, etc.
3. **Severity self-assessment** (we re-classify; this helps us
   triage).
4. **Steps to reproduce** — exact, deterministic, copy-pastable.
   Include any payloads. If the bug is in a deployed service,
   note the service URL and the time of your test so we can
   correlate logs.
5. **Impact statement** — what an attacker accomplishes.
6. **Suggested fix or mitigation** (optional but appreciated).
7. **Your preferred credit** — full name + handle + URL, or
   anonymous, or pseudonymous. We will not credit you without
   your explicit consent.

PGP key fingerprint and email are documented in
[`SECURITY.md`](./SECURITY.md) § "Encrypted reporting." Use it if
the report includes a working exploit chain or sensitive
artefacts.

## 6. Response process and timelines

| Stage | Target | What happens |
|---|---|---|
| **Acknowledge receipt** | ≤ 24 hours | A human (not an autoresponder) replies with a tracking ID. |
| **Triage decision** | ≤ 72 hours | We confirm scope and severity band, or explain why a report falls out of scope. If we need more reproduction information, the clock pauses. |
| **Public-disclosure window** | 90 days from triage | We work to fix and roll out. We coordinate disclosure timing with the reporter. The window can extend by mutual agreement (e.g. for cryptographic findings that need a coordinated Sigstore release). |
| **Fix shipped** | When ready | We notify the reporter at shipment. The reward (if any) is paid within 30 days of shipment, post-launch. |
| **Public post-mortem** | ≤ 30 days after fix | Written up in [`docs/bugs.md`](./docs/bugs.md) with the reporter's preferred credit. The post-mortem includes: root cause, scope of impact, fix, regression test added, and the discipline change that prevents the class. |

## 7. Safe harbour

PrimitiveHub will not pursue civil action or initiate criminal
complaint against researchers who follow this policy in good
faith. Specifically:

- We authorise security research that targets the surfaces
  enumerated in § 2 above.
- Stay within the rate limits documented at the affected surface
  (or contact us in advance if you need a higher rate for testing).
- Do not exfiltrate data beyond what is necessary to demonstrate
  the vulnerability; redact and discard anything else.
- Do not access, modify, or destroy data belonging to other
  organisations or users.
- Report promptly; do not embargo for extended periods, and do
  not disclose publicly before the coordinated window closes.
- Do not exploit findings beyond demonstration. A demonstration
  that uses a test account or a controlled corpus sample is
  always preferable to one that touches a real organisation's
  data.

If a researcher follows this policy and inadvertently violates a
US federal computer-fraud law (CFAA), the EU equivalent, or a
similar statute in their jurisdiction, we will not initiate legal
action and will, if asked, support good-faith research in any
proceeding.

If you cannot tell whether a test you want to run falls inside
the safe harbour, ask first. We answer fast.

## 8. Acknowledgements

The PrimitiveHub Hall of Fame lives at
[`docs/security-hall-of-fame.md`](./docs/security-hall-of-fame.md)
(coming with launch). Reporters credited there have shipped a
material security improvement to PrimitiveHub. Inclusion requires
the reporter's explicit consent and a closed-and-shipped fix.

Pre-launch reporters: thank you. Your finding rides into the
public hall of fame at launch alongside the post-mortem and the
retroactive payout.

## 9. Programme governance

This document is the public, version-controlled bounty programme.
Changes to scope, severity bands, or payout windows are PRs
against this file and reviewed against
[ADR-0019](./docs/decisions/0019-doctrine-versioning-policy.md)
(doctrine versioning). Breaking changes — narrowing scope,
lowering bands, weakening safe harbour — require a 60-day notice
period in which the previous version remains in effect for any
report filed during that window.

The owner of this programme is the PrimitiveHub security lead.
Pre-launch that role sits with `mhm@cyberorca.sa`. Post-launch the
owner is whoever signs the public-disclosure post-mortems.

## 10. Frequently asked

**"Can I report a vulnerability anonymously?"**
Yes. Tor / Mullvad email accounts are fine. You will not receive
the reward unless you can later prove ownership of the report.

**"Do you pay in cryptocurrency?"**
On request, yes — within the same USD band. We default to bank
transfer.

**"Can I publish a write-up?"**
Yes, once the coordinated-disclosure window has closed and the
fix has shipped. We ask that you cite this document.

**"What if Sigstore goes down during the disclosure window?"**
Then the disclosure window extends until verification is back to
baseline. See [`docs/trust-contract.md`](./docs/usage/02-trust-contract.md)
for the verifier's behaviour under the dependency.

**"My report sits between in-scope and out-of-scope."**
Send it. We triage. We will not penalise a mis-categorised
report.

---

**Programme version:** v0.1
**Last reviewed:** 2026-06-10
**Effective:** Pre-launch staging; payouts turn on at Gate G-G (launch).
