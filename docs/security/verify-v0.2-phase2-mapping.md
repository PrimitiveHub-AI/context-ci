# verify v0.2 Phase 2 — Trust Bundle → Sigstore-bundle mapping (design)

**Status:** design note, resolves spec §2 "first design task" + open-question #3.
**Scope:** `packages/verify/` Phase 2. **Prereq:** owner ratifies the sigstore-js
dependency (spec open-question #1) before any code here is written.
**Reference:** [verify-v0.2-spec.md](./verify-v0.2-spec.md).

## Why this note exists

sigstore-js (`@sigstore/verify`) verifies a **Sigstore bundle** — a single
protobuf object (`@sigstore/bundle`, media type
`application/vnd.dev.sigstore.bundle+json;version=0.3`) that carries the DSSE
envelope, the verification material (cert chain / public key), and the
transparency-log entries together. Our `TrustBundleAttestation` carries the
**same material decomposed into separate fields**. Phase 2 must map one onto the
other *before* writing any crypto, so the crypto step is "hand sigstore-js a
bundle and read its verdict", not "re-derive Sigstore's object model inline".

## Field mapping

| Our field (`TrustBundleAttestation`) | Sigstore bundle location | Notes |
|---|---|---|
| `statementB64` | `dsseEnvelope.payload` (base64), `payloadType = "application/vnd.in-toto+json"` | The in-toto Statement bytes the signature is over. Phase 1 already decodes + binds this (R09/R10). |
| `signatureB64` | `dsseEnvelope.signatures[0].sig` (base64) | Raw signature over the DSSE PAE of the Statement. **See PAE gotcha below.** |
| `certChainPem` | `verificationMaterial.x509CertificateChain.certificates[]` (DER, base64) | PEM → strip headers → DER → base64 per cert. Leaf first. |
| `rekorLogId` | `verificationMaterial.tlogEntries[0].logId.keyId` | Base64 of the log's key id. |
| `rekorLogIndex` | `verificationMaterial.tlogEntries[0].logIndex` | Decimal string. |
| `rekorInclusionProofJson` | `verificationMaterial.tlogEntries[0].inclusionProof` | JSON → protobuf: `logIndex`, `rootHash`, `treeSize`, `hashes[]`, `checkpoint.envelope`. |
| *(derived)* bundle timestamp | `verificationMaterial.tlogEntries[0].integratedTime` | Epoch seconds → feeds `checkFreshness()` (anti-replay, Phase 3). |

`predicateType` / `predicate` are **not** part of the Sigstore bundle — they live
inside the Statement payload and are already validated by Phase 1
(`verifyStatementBinding`). No mapping needed.

## Known gotchas (decide before coding)

1. **DSSE PAE.** A DSSE signature is over the Pre-Authentication Encoding
   `PAE(payloadType, payload)`, *not* over the raw Statement bytes. If our
   `signatureB64` was produced over the PAE (it should be — that's how the issuer
   signs), the DSSE envelope reconstruction is lossless. **Verify against a real
   issued bundle first**; if our signer signed raw Statement bytes instead, the
   bundle is malformed and Phase 2 must reject it (not paper over it).
2. **Single tlog entry assumption.** The table assumes `tlogEntries[0]`. Our
   format carries exactly one Rekor entry; assert `length === 1` and reject
   otherwise rather than silently taking the first.
3. **Cert chain completeness.** sigstore-js wants the leaf; intermediates may be
   implied by the trust root. If `certChainPem` is leaf-only, rely on the pinned
   Fulcio intermediates from the trust root; if it carries intermediates, pass
   them through. Don't let a bundle inject its own root (TRUST_ROOT handling in
   `signer-policy.ts` already refuses half-pinned custom roots).
4. **Bundle media-type / version.** Target `v0.3`. Pin the version we construct
   so a sigstore-js major bump is a deliberate migration, not a silent drift.

## Fallback — sub-primitives if the mapping is lossy

If any field can't be reconstructed into a faithful `@sigstore/bundle` (e.g. the
PAE gotcha turns out real, or our Rekor proof JSON lacks the checkpoint), do
**not** force it. Fall back to the `@sigstore/verify` sub-primitives per step:

- signature + DSSE → `@sigstore/verify` `Verifier` over a hand-built envelope,
  or raw `crypto.verify` with the leaf public key (last resort, documented).
- cert chain + identity → `@sigstore/verify` cert utilities; extract issuer
  (OID `1.3.6.1.4.1.57264.1.1`) + SAN from the leaf → `matchesSigner()`.
- Rekor inclusion → `@sigstore/verify` tlog checker against the pinned log keys.

The decision rule: **prefer the whole-bundle path** (one audited verifier, fewer
seams); drop to sub-primitives only for a field that genuinely won't map, and
record which fields took the fallback in the CHANGELOG.

## What's already built (dep-free, landed in Phase 2 prep)

The **trust decisions** that sit *after* the crypto are already implemented and
tested in [`signer-policy.ts`](../../packages/verify/src/signer-policy.ts):

- `validateSignerPolicy()` — fail-closed shape check (no signers ⇒ refuse;
  half-pinned root ⇒ reject; bad freshness window ⇒ reject).
- `matchesSigner({issuer, san}, policy)` — the approved-signer bar. Phase 2's
  cert step extracts `{issuer, san}` from the leaf and calls this.
- `checkFreshness(bundleEpochSec, nowEpochSec, maxAgeSec)` — anti-replay. Phase 3
  reads `integratedTime` and calls this.

So Phase 2's remaining work is purely: **add the dep → build this mapping →
extract `{issuer, san}` + `integratedTime` → call the existing decisions.** The
negative-test matrix skeleton (the exit gate) is stubbed in
[`test/signer-policy.test.ts`](../../packages/verify/test/signer-policy.test.ts)
as `it.todo`.
