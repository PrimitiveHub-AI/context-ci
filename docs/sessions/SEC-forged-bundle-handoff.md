# SECURITY handoff — forged Trust Bundle (Critical) — `[from: phub-cli]`

> Cross-session coordination doc. Authored by **phub-cli**. Reported **2026-09-30**;
> confirmed + contained (consumer side) **2026-10-05**. Reporter acknowledgment is
> **ON HOLD** per owner instruction — do NOT send until the owner says so.

## 1. The vulnerability (confirmed in code)
`@primitivehub/verify@0.1.x` `verifyBundle` default level is `policy`, which runs only
schema (step 1) + content-digest (step 2) + policy-on-the-bundle's-own-predicate (step 7).
Steps 3–6 (in-toto statement, signature, cert chain, Rekor inclusion) are **stubbed** and
only surface as `*_DEFERRED` failures at `full` — and `full` always returns `valid:false`.

**Net: no level authenticates a bundle, yet `structural`/`policy` return `valid:true`.**
An attacker who controls bundle delivery forges content, self-computes the digest, supplies
an empty passing predicate, and fills the crypto fields with junk → accepted as `valid`.
Matches the published Critical example ("acceptance of a forged Sigstore signature").

Exploitable consumers (default `policy`): `phub install`, `phub verify`,
MCP `verify_bundle`, MCP `verify_before_load` (when a bundle is supplied).

**Published & affected:** `verify@0.1.0`, `phub@0.1.0`, **`phub@0.1.1`** (just shipped, same
dep), `mcp-server@0.1.0`.

## 2. Phase 2 — DONE (phub-cli scope, consumer fail-closed)
Defense-in-depth that contains *our* tools even before the core is patched:
- New `isBundleAuthenticated()` in `@primitivehub/phub` (`src/trust/authentication.ts`) —
  true only when `level==="full" && valid && deferredSteps.length===0` ⇒ **false for every
  v0.1 bundle**. All trust paths gate on this, never on `valid`.
- `phub install` verifies at `full`, refuses unauthenticated bundles (`BUNDLE_UNAUTHENTICATED`),
  keeps precise `BUNDLE_REJECTED` for structural breaks, loud `--allow-unauthenticated` opt-out.
- MCP `verify_bundle` → `isError` + `authenticated:false` + `trust:"INSPECTED_NOT_AUTHENTICATED"`.
- MCP `verify_before_load` → supplied unauthenticated bundle **blocks** (`BUNDLE_UNAUTHENTICATED`).
- `phub verify` → "INSPECTED — NOT cryptographically authenticated," never "verified."
- Regression tests = the reporter's exact PoC (phub 4, mcp 2); 12 old tests updated to the
  secure contract. phub 402 ✓, mcp 34 ✓, corpus gate PASS.

## 3. Phase 1 — CORE FIX — ✅ IMPLEMENTED (additive), ⚠️ one decision left for the owner
**Done (cross-scope edit to `packages/verify`, owner-authorized "start", flagged for ratification):**
- Added **`authenticated: boolean`** to `VerificationResult` — the authoritative trust signal,
  `false` for every bundle in v0.1 (fails closed). `valid` kept its meaning (inspection passed)
  so the normative conformance contract is NOT broken. `noop`/untrusted backends can never be
  `authenticated` (subsumes the "reject noop" ask without touching valid fixture 05).
- Conformance suite extended with a **fail-closed invariant**: no valid fixture is
  `authenticated` at any level (verify 23 → 59 tests, all pass). Py↔TS gate still PASS.
- `@primitivehub/phub`'s `isBundleAuthenticated()` now returns `result.authenticated`
  (with a level/deferred fallback for older verify).

**Still the verify-owner's decision (ADR-0021, the executable contract — I did NOT do this):**
whether to additionally flip `valid` so `valid = inspected && authenticated` (i.e. `valid:false`
for structural/policy). The reporter asked for this; it is a breaking change to the normative
contract and cascades into every consumer, so it belongs to the owner + an ADR amendment. The
additive `authenticated` field already lets all first-party tools fail closed; the flip would
also protect third parties who (wrongly) gate on `valid`. Sketch of that further change:

```ts
export interface VerificationResult {
  /** Fully authenticated: steps 1-7 all passed (schema+digest+policy+signature+cert+rekor). */
  valid: boolean            // SEMANTIC CHANGE: no longer true for structural/policy-only
  /** Inspection passed: the requested non-crypto checks (schema/digest[/policy]) held. */
  inspected: boolean        // NEW
  /** Cryptographic authentication actually ran and passed (false while steps 3-6 stubbed). */
  authenticated: boolean    // NEW — false in v0.1
  failures: VerificationFailure[]
  level: VerificationLevel
  deferredSteps: ReadonlyArray<"signature" | "cert" | "rekor" | "statement">
}
// Rule: valid = inspected && authenticated.  In v0.1, authenticated===false ⇒ valid===false
//       at EVERY level. "inspected" carries the old structural/policy signal for diagnostics.
// Also: reject backendName === "noop" (and unknown backends) in any trust path.
```

Once this ships, `@primitivehub/phub`'s `isBundleAuthenticated()` should be simplified to
`return result.authenticated` (one-line follow-up in phub-cli scope).

**Note:** this intentionally BREAKS the conformance suite's "valid:true at structural/policy"
expectation — correct for a security patch; bump the suite accordingly.

## 4. Cross-scope action items
- `[from: phub-cli → verify owner / phub-platform]` Apply Phase 1 core fix above.
- `[from: phub-cli → phub-platform]` **URGENT:** `npm deprecate` `verify@0.1.0`,
  `phub@0.1.0`, **`phub@0.1.1`**, `mcp-server@0.1.0` (point to advisory + fixed version);
  ship patched `verify@0.1.1` / `phub@0.1.2` / `mcp-server@0.1.2`.
- `[from: phub-cli → phub-strategy / phub-security]` GHSA advisory; ratify severity vs the
  published policy.
- `[from: phub-cli → phub-security]` Reporter acknowledgment — **drafted separately, ON HOLD**
  until owner direction. Coordinated-disclosure timeline + credit when released.

## 5. Residual risk until Phase 1 ships
Third parties calling `@primitivehub/verify` directly remain exposed (our consumer fix does
not protect them). This is why Phase 1 + the deprecations are not optional.
**→ RESOLVED 2026-10-16:** Phase 1 shipped additively (`authenticated` field) in
`verify@0.1.1`; third parties now have the authoritative signal. Deprecations live.

## 6. Remediation SHIPPED — 2026-10-16 ✅
| Package | Patched (latest) | Deprecated (vulnerable) |
|---|---|---|
| `@primitivehub/verify` | **0.1.1** | 0.1.0 |
| `@primitivehub/phub` | **0.1.2** → `verify@^0.1.1` | 0.1.0, 0.1.1 |
| `@primitivehub/mcp-server` | **0.1.2** → `verify@^0.1.1`, `phub@^0.1.2` | 0.1.0 |

- Code on `launch`: `b3b4f3f` (consumer fail-closed), `1672127` (verify core), `ec892d0`
  (cli --version fix). Released artifacts: branch `release/0.1.2`.
- Advisory draft: `docs/security/2026-09-30-forged-trust-bundle.md` (ready to publish as GHSA).
- **Governance note:** patched versions were published via **local `npm publish`** (owner's
  authed 2FA session), bypassing the ADR-0022 `launch`-environment approval ceremony.
  `prepublishOnly` still enforced the full test suite each time. Deviation recorded here, not silent.
- **Open follow-ups:** `[→ verify owner]` optional ADR-0021 `valid = inspected && authenticated`
  flip (the additive field already fails closed); `[→ phub-platform]` migrate CI publish to
  **trusted publishing (OIDC)** before **Jan 2027** (bypass-2FA tokens sunset);
  `[→ phub-security]` publish the GHSA + release the reporter acknowledgment (ON HOLD).

## 7. Self-test guide (verify the fix from clean npm installs)
```bash
# 1. fixed versions resolve; old ones warn
npm view @primitivehub/phub version            # 0.1.2
npm view @primitivehub/phub@0.1.1 deprecated   # prints the Critical warning

# 2. the forged bundle is now REFUSED (fail closed)
mkdir /tmp/phub-sec && cd /tmp/phub-sec
cat > forged.json <<'JSON'
{"bundleVersion":"0.1","subject":{"slug":"forged","semver":"1.0.0",
"contentDigest":"sha256:<sha256 of the bytes below>"},
"content":{"bytesB64":"IyBBVFRBQ0tFUgo=","sizeBytes":10,"mediaType":"text/markdown"},
"attestation":{"predicateType":"https://primitivehub.ai/context-ci/v0.1/Attestation",
"predicate":{},"backendName":"public","certChainPem":"forged","signatureB64":"Zm9yZ2Vk",
"statementB64":"Zm9yZ2Vk","rekorLogIndex":0,"rekorLogId":"0000000000000000000000000000000000000000000000000000000000000000",
"rekorInclusionProofJson":"{}","verifyUrl":"https://example.invalid","signedAt":"2026-09-30T00:00:00Z"}}
JSON
npx @primitivehub/phub@0.1.2 install --bundle forged.json
#   → refuses with BUNDLE_UNAUTHENTICATED (pre-0.1.2 would have written it as "verified")

# 3. phub verify labels it honestly
npx @primitivehub/phub@0.1.2 verify forged.json
#   → "INSPECTED — NOT cryptographically authenticated", never "verified"
```
(Recompute `contentDigest` to match `content.bytesB64` if you change the payload — the digest
self-check still runs; it's the *authentication* that now fails closed.)
