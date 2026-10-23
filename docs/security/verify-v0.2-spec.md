# @primitivehub/verify v0.2 — real cryptographic authentication (spec)

**Status:** proposal, for verify-owner ratification before implementation.
**Author:** phub-cli lead. **Scope:** `packages/verify/` only.
**Closes:** the deferred crypto steps (`statement`/`signature`/`cert`/`rekor`),
red-team R09/R10, audit PH-08 (crypto unimplemented) and PH-09 (advisory gate),
and makes `--require-attestation` a real check instead of a lock-label check.

## 1. Where we are

`verifyBundle(bundle, { level })` already runs **inspection** (schema + content
digest + Context CI policy) and fails closed. The `full` level *declares* four
steps and stubs them, so `authenticated` — and therefore `valid = inspected &&
authenticated` — is **always false**. That fail-closed posture is correct and
must be preserved until v0.2 genuinely authenticates.

Critically, the bundle format **already carries every field** v0.2 needs
(`TrustBundleAttestation` in `src/types.ts`):

| Field | v0.2 use |
|---|---|
| `statementB64` | in-toto Statement v1 bytes the signature is over |
| `predicateType` + `predicate` | Context CI Attestation predicate |
| `signatureB64` | raw signature over the Statement bytes |
| `certChainPem` | Fulcio leaf (+ chain) — signer identity + key |
| `rekorLogIndex` / `rekorLogId` / `rekorInclusionProofJson` | transparency-log inclusion |

So v0.2 is **verifying material that already exists**, not a format change.

## 2. Engine decision — adopt `sigstore` (sigstore-js)

Do **not** hand-roll Sigstore verification. Use the official, audited
[`sigstore`](https://github.com/sigstore/sigstore-js) libraries
(`@sigstore/verify`, `@sigstore/bundle`, `@sigstore/tuf`) for signature + Fulcio
chain + Rekor inclusion + trust-root management. Hand-rolled crypto is the wrong
risk for a security product, and every auditor asked for conformance-tested
verification.

**First design task (Phase 2):** our attestation fields are decomposed, while
sigstore-js verifies a Sigstore *bundle*. Map `{statementB64, signatureB64,
certChainPem, rekor*}` → a Sigstore protobuf bundle (`@sigstore/bundle`) and feed
it to `@sigstore/verify`. If the mapping is lossy, fall back to the `@sigstore/*`
sub-primitives per step. Decide + document the mapping before writing crypto.

Dependency note: `@primitivehub/verify` advertises "zero runtime dependencies,
<20KB". v0.2 breaks that — call it out in the README and gate the crypto path so
inspection-only consumers can still tree-shake. (Alternative considered: a
`@primitivehub/verify-sigstore` companion package that keeps the kernel dep-free.
Owner's call — noted as an open question.)

## 3. Verification model (the four steps, mapped)

Run at `level: "full"`, in order, fail-closed at the first failure:

1. **statement** (R09/R10) — decode `statementB64` → in-toto Statement v1.
   Validate `predicateType` against an allow-list. **Bind the subject**: the
   Statement's `subject[].digest.sha256` MUST equal the bundle's content digest
   (`content` → the same digest inspection already computed). This is R10 — a
   signature over *some other* subject must not authenticate *this* content.
2. **signature** — verify `signatureB64` over the Statement bytes using the
   public key in the `certChainPem` leaf.
3. **cert** — verify `certChainPem` chains to the pinned Fulcio root; check the
   validity window; extract the **signer identity** (OIDC issuer + SAN).
4. **rekor** — verify `rekorInclusionProofJson` against the log
   (`rekorLogId`/`rekorLogIndex`) and the signed checkpoint; **anti-replay**:
   reject bundles older than a configurable freshness window.

`authenticated = true` **only** when all four pass **and** the signer-identity
policy (§4) is satisfied. Then `valid = inspected && authenticated` can finally
be true. Any failure → `authenticated=false`, structured `failures[]`, fail-closed.

## 4. Signer-identity policy (the "approved signer" bar)

Authentication without an identity allow-list is theatre — a valid Sigstore
signature from *any* identity would pass. Add to the policy surface:

```ts
interface VerifyPolicy {
  // existing: strict, allowFailFor …
  signers?: Array<{ issuer: string; san: string | RegExp }>  // OIDC issuer + SAN allow-list
  trustRoot?: "public-good" | { fulcioRootsPem: string; rekorKeysPem: string }  // pinning
  maxBundleAgeSec?: number  // anti-replay freshness window
}
```

Default (no `signers`): **refuse** — v0.2 must not authenticate an arbitrary
signer silently. The CLI/MCP surface a clear "no approved signers configured".

## 5. Phased rollout (each phase ships + stays fail-closed)

- **Phase 1 — statement/predicate binding (R09/R10).** No external deps. Decode
  + validate the Statement, enforce subject-digest binding + `predicateType`
  allow-list. Flip the `statement` step from stub to real; `authenticated` stays
  false (signature/cert/rekor still deferred). **Exit:** a Statement whose
  subject digest ≠ content digest fails with a distinct code; valid binding
  passes the statement step; negative tests green.
- **Phase 2 — signature + Fulcio cert (PH-08).** Introduce sigstore-js + the
  bundle mapping; verify signature + chain; enforce `policy.signers` + trust-root
  pinning. **Exit:** forged signer / wrong issuer-SAN / expired cert / swapped
  root all fail; an independently-produced valid bundle passes steps 1–3.
- **Phase 3 — Rekor inclusion + anti-replay.** **Exit:** corrupted inclusion
  proof / tampered checkpoint / stale bundle all fail.
- **Phase 4 — flip + harden.** Set `authenticated=true`/`valid=true` only on
  full pass; ship the complete negative matrix (§6) + the positive fixture; add
  a conformance test. **Exit:** the whole matrix green; `valid=true` reachable
  exactly once (the signed positive fixture).

## 6. Negative-test matrix (Phase 4 gate)

Each must yield `authenticated=false` with a specific `failures[].code`:
forged signer key · swapped DSSE/Statement payload · wrong OIDC issuer · wrong
SAN · expired Fulcio cert · swapped/poisoned trust root · Rekor leaf-hash
mismatch · Rekor inclusion-proof corruption · tampered checkpoint/SET · stale
bundle (> `maxBundleAgeSec`) · subject-digest ≠ content-digest (R10) ·
unknown `predicateType` · malformed JSON / invalid UTF-8 / duplicate keys ·
cross-signer policy (valid signer, not in `signers`). Plus **one** independently
constructed *positive* bundle that returns `authenticated=true`.

## 7. Downstream contract (after v0.2 authenticates)

- `phub install` / `verify-before-load --require-attestation`: today these check
  a lock *label* (R01). Once verify authenticates, route them through
  `verifyBundle(level:"full")` + `policy.signers` so the flag means a **verified
  signer**, not a string.
- MCP `verify_before_load`: stays advisory (host must mediate reads — PH-09), but
  `require_attestation:true` becomes a real crypto gate with a signer policy.
- README/docs: update the capability matrix (website + package) as steps flip
  from "planned" to "implemented/enforced", generated from the tested release.

## 8. Process gates (per phase)

- **Loop engineering:** each phase has the named exit condition above — no phase
  merges until its negative tests are green (not "should work").
- **Definition of Done:** security (fail-closed preserved) → truth (reproduced
  positive + negatives) → spec (this doc, updated) → verified (conformance +
  matrix) → stated (CHANGELOG + capability matrix). Velocity never skips a gate.

## Open questions for the owner

1. Dep-weight: break the zero-dep kernel, or split a `verify-sigstore` companion?
2. Trust root: bundle the Sigstore public-good roots, or require explicit pinning?
3. Is the current `TrustBundleAttestation` field set sufficient, or do we need a
   native Sigstore-bundle field to avoid the mapping in §2?
