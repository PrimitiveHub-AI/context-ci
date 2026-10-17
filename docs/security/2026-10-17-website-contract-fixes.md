# Website security-contract fixes — handoff (2026-10-17 cross-surface audit)

**Owner:** whoever holds `apps/web` (the website is a separate deploy surface).
**Author:** phub-cli lead. I am **not** editing `apps/web` directly (concurrent
work in flight); this is corrected copy to apply.

## Why this exists

The 2026-10-17 cross-surface audit found the **packages are hardened** (0.1.4 +
the 0.1.5 SNAP-01 fix) but the **website overclaims the security contract and
teaches unsafe patterns**. The code fixes don't help if the customer-facing docs
describe guarantees the installable release doesn't deliver. Priority: these are
truth/security-contract issues — fix before further launch promotion.

Ground truth of the shipped release (source of every claim below):
- **Inspection** — schema + content-digest + Context CI policy — **implemented & enforced** at CLI / CI / MCP.
- **Authentication** — Sigstore signature + Fulcio cert chain + Rekor inclusion — **stubbed in v0.1** (lands v0.2). `authenticated` is always `false`; therefore `valid = inspected && authenticated` is **always false** today.
- **Detectors** — all **10** (CCI-001…010) implemented, Python↔TS parity, conformance-tested. Only the **CCI-001/002/005 trifecta** is validated against the adversarial corpus; the other seven are conformance-tested with corpus hardening on the roadmap.
- **MCP** — **5** tools; `verify_before_load` is **advisory** (the agent calls it; not a host-enforced read gate) and `require_attestation` defaults **false**.

## The one artifact to add: a versioned capability matrix (fixes LIVE-03)

Replace the Trust Contract page's "consumers refuse unless digest + signature +
attestation + provenance all verify" + the Sigstore-success screenshot with this,
generated from the tested release — never hand-written:

| Check | v0.1 status | Where |
|---|---|---|
| Schema / structure | ✅ implemented · enforced | CLI · CI · MCP |
| Content digest (T9 tamper) | ✅ implemented · enforced | CLI · CI · MCP |
| Context CI Top 10 policy | ✅ implemented · enforced (10 detectors) | CLI · CI · MCP |
| Lock drift / seal | ✅ implemented · enforced | CLI · CI · MCP |
| Sigstore signature | ⏳ **planned (v0.2)** — stubbed | — |
| Fulcio cert chain / signer identity | ⏳ **planned (v0.2)** — stubbed | — |
| Rekor inclusion proof | ⏳ **planned (v0.2)** — stubbed | — |
| Host-enforced read gate | ⏳ **planned** — MCP tool is advisory today | — |

Columns the audit explicitly asked for: **implemented / enforced / advisory /
planned**. Do not render a successful Fulcio/Rekor verification as a property of
the installable release. A `policy`-level pass proves **inspection**, not an
**authenticated signer**.

## Per-page fixes

### `/docs/verify-library` — LIVE-01 (critical: teaches trusting unauthenticated content)
The "30-line embed" ends `if (!result.valid) throw; signedContent(); // Safe to consume`.
Problem: a reader treats `valid` as the trust gate, and the "safe to consume"
comment implies authentication. Replace with the corrected snippet (already live
in the package + public READMEs):

```ts
const result = await verifyBundle(JSON.parse(bundleJson), { level: "policy" });
if (!result.valid) throw new Error(`untrusted: ${result.failures[0]?.code ?? "unverified"}`);
// v0.1 note: `valid` requires BOTH inspection AND cryptographic authentication;
// the crypto is stubbed until v0.2, so `valid` is always false today —
// fail-closed by design. Do NOT fall back to `result.inspected` to "make it
// pass": that consumes content that was never cryptographically authenticated.
```
Add a separate `inspectUntrustedBundle()` path for the "I only want structural
inspection, and I accept it is unauthenticated" use case — clearly labelled.

### `/docs/trust-contract` — LIVE-03 (high: contract stronger than verifier)
Swap the "all four verify" prose + Sigstore screenshot for the capability matrix
above. State the version it reflects. Keep the CLI/Action forms consistent with
`/docs/github-action` (`files:`, not `paths:`) and the real `phub verify` surface.

### Homepage — PH-20261017-11 (high: "every byte" + Sigstore-success vignette)
The homepage says it **verifies every context byte before agents read it** and
shows a **successful Sigstore/Rekor** verification in an install vignette. Both
overclaim the installable release: the MCP gate is advisory (not an on-access
"every byte" interposition), and Sigstore/Rekor are stubbed (v0.2). Replace with
the capability matrix language and, for the "every byte" line, say what is true:
*"inspects every discovered agent-context artifact (lock + Top 10) — advisory;
host-enforced on-access gating and cryptographic authentication land in v0.2."*
Do not render a passing Sigstore/Rekor result as a current capability.

### `/docs/mcp-server` — LIVE-02 (high: advisory presented as mandatory)
Align with the (now corrected) README: `verify_before_load` is **advisory** — the
agent invokes it; it is **not** a host-enforced read gate, and `require_attestation`
defaults **false**. Surface guarantee levels as **integrity-only** vs
**authenticated**, and don't imply registering the server interposes on agent
file reads. (The README's "refuses unattested context by default" overclaim is
fixed in `ca16487`.)

### `/docs/getting-started` + homepage + `/top-10` — LIVE-05 (medium: denominator drift)
- getting-started says **3 detectors / 4 MCP tools** → correct to **10 detectors / 5 MCP tools**.
- homepage "10/10 · macro-F1 0.991" vs `/top-10` "9/10 at F1 0.991": pick **one**
  sourced claim and repeat it verbatim everywhere. Honest denominator:
  **"10/10 detectors implemented (Python↔TS parity, conformance-tested); macro-F1
  0.991 measured on the \<N\>-detector corpus-validated subset."** Pin `<N>` and the
  corpus from the tested eval artifact (the eval owner has the number) — do not
  present a subset metric as an all-10 score.
- npm search index showing older versions is **cosmetic lag**, not drift:
  `@primitivehub/phub@0.1.4` (and 0.1.5 once published) are live and install; I
  verified a clean-room install end-to-end.

### `/security` → `/status` — LIVE-06 (informational)
`/status` is a "Planned · live backend" placeholder but `/security` links to it as
the operational-status source. Either ship the status backend or soften the
`/security` wording so it doesn't imply active monitoring.

## Not covered here (separate tracks)
- Live `/check` + Forge dynamic tests (SSRF, decompression, XSS, headers, rate
  limits): need a **staging test host** with network — infra, not docs.
- npm provenance / SLSA attestation + per-package tarball SHA pinning: publish-infra.
- Real Sigstore verification + signer-identity pinning (the audit's "authenticated
  provenance" bar): the **v0.2 verify** work (also covers red-team R09/R10).
- **PH-20261017-06 (release-eng) — internal deps resolve published versions.**
  The monorepo is per-package (file: deps, local linking) so same-package dev
  tests *do* use local code, but the release/distribution manifests use
  `^x.y.z`, so testing from a release tree resolves the *published* dependency
  (mcp@0.1.5 was validated against local phub@0.1.6 on `launch`, then publish
  order is phub→mcp). Proper fix: convert to a single pnpm workspace with
  `workspace:^` internal deps (pnpm rewrites to `^version` at publish), add a
  `pnpm -r build/test` gate, and record a GitHub-SHA ↔ npm-tarball-SHA512
  provenance manifest. Larger change — owner/release-eng track, not a patch.
