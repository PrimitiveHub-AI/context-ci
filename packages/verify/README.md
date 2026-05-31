# @primitivehub/verify

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Offline-first verifier for PrimitiveHub Trust Bundles.** Zero runtime
deps. Conformant to [Trust Contract
v0.1](https://primitivehub.ai/docs/trust-contract-v0.1.md) (`docs/`
in this repo).

This library is the **reference implementation** for the
TypeScript/JavaScript side of the Trust Contract per
[ADR-0020](../../docs/decisions/0020-verify-as-reference-implementation.md).
When the spec text and this library's behavior disagree on the
v0.1-implemented steps, the [conformance suite](../../docs/trust-contract/conformance/)
is the arbiter (per [ADR-0021](../../docs/decisions/0021-conformance-suite-as-executable-contract.md)).

## Install

```bash
npm install @primitivehub/verify
# or
pnpm add @primitivehub/verify
```

Requires Node ≥ 20 (uses built-in Web Crypto). Works in modern
browsers without polyfill.

## Embed in 30 lines

```ts
import { verifyBundle } from "@primitivehub/verify"

// You got a Trust Bundle from somewhere — your registry, a CDN, an MCP
// server, an agent. Parse it and verify before consuming the primitive.
async function consumeIfTrusted(bundleJson: string, signedContent: () => void) {
  const bundle = JSON.parse(bundleJson)

  const result = await verifyBundle(bundle, { level: "policy" })

  if (!result.valid) {
    // result.failures is structured — branch on `code`, NOT on `message`.
    for (const f of result.failures) {
      console.error(`[${f.code}] ${f.message} (at ${f.path ?? "<top>"})`)
    }
    throw new Error(`Trust Bundle rejected: ${result.failures[0]?.code}`)
  }

  // The bundle's content hash, schema, and Context CI policy all checked out.
  // Safe to consume the primitive.
  signedContent()
}
```

## Verification levels

```ts
await verifyBundle(bundle, { level: "structural" })  // steps 1+2
await verifyBundle(bundle, { level: "policy" })      // steps 1+2+7 (default)
await verifyBundle(bundle, { level: "full" })        // steps 1-7 (steps 3-6 stubbed in v0.1)
```

| Level | Steps | What it catches |
|---|---|---|
| `structural` | 1, 2 | Schema violations, content-digest tampering (T9), malformed bundles |
| `policy` (default) | 1, 2, 7 | + Context CI verdict policy (default: any `fail` severity rejects) |
| `full` | 1-7 | + Sigstore signature, cert chain, Rekor inclusion proof — **v0.1 stubs these** |

## Policy options

Default policy: any verdict with `severity === "fail"` rejects the
bundle. Override with `policy: { strict, allowFailFor }`:

```ts
// Strict — treat `warn` as `fail` too:
await verifyBundle(bundle, { level: "policy", policy: { strict: true } })

// Allow a specific detector or CCI ID to FAIL without rejecting the bundle:
await verifyBundle(bundle, {
  level: "policy",
  policy: { allowFailFor: ["t5.unsafe_shell_install", "CCI-005"] },
})
```

The formal [Context Policy Language v0.1
spec](../../docs/context-policy-v0.1.md) (Phase 5.5 Week 6) will
formalize the YAML schema this object mirrors.

## Known limitations of v0.1

Verification steps 3-6 (in-toto Statement parse + signature
verification + cert chain walk + Rekor Merkle inclusion proof) are
**stubbed** in v0.1 and return `*_DEFERRED` failures when `level:
"full"` is requested. The structural + policy paths are fully
implemented and load-bearing.

The v0.2 roadmap reintroduces:

- in-toto Statement protobuf decoding (binds the signature to the
  subject digest)
- ECDSA-P256 signature verification via Web Crypto
- Cert chain walk against bundled Sigstore trust roots
  (public + staging)
- Rekor Merkle inclusion proof verification (offline; the bundle
  carries the proof per Trust Contract § 5.4)

Until then: structural + policy verification is enough for the
"is this bundle malformed or rejected by Context CI?" gate.
The cryptographic claims of who-signed-what are not yet checked by
this library; the producing PrimitiveHub instance does enforce them
end-to-end, so the trust chain is intact when you trust the issuer.

## Conformance

This library passes every test in the [Trust Contract v0.1 conformance
suite](../../docs/trust-contract/conformance/) for the v0.1-implemented
verification steps. Run the suite locally:

```bash
pnpm test
```

The vitest harness reads the same canonical JSON fixtures the
Python pytest harness validates. If both green, the two
implementations agree.

## API surface

```ts
export { verifyBundle, type VerifyOptions, type VerificationResult, type VerificationLevel }
export { type TrustBundle, type TrustBundleSubject, type TrustBundleContent, type TrustBundleAttestation }
export { type VerificationError, type VerificationFailure, type VerificationErrorCode }
export { evaluatePolicy, extractValidation, type PolicyOpts, type PredicateVerdict, type Severity }
```

## Versioning

This library tracks the Trust Contract spec version. `0.1.x` of this
library is conformant to Trust Contract v0.1. Breaking changes to the
spec follow [ADR-0015](../../docs/decisions/0015-trust-contract-versioning.md)
(SemVer + RFC + 12-month deprecation window); breaking changes to
this library's API follow the same SemVer discipline.

## License

MIT. See [LICENSE](./LICENSE).

## References

- [Trust Contract v0.1 spec](../../docs/trust-contract-v0.1.md)
- [Conformance suite](../../docs/trust-contract/conformance/)
- [Context CI Top 10 v0.1](../../docs/context-ci-top-10-v0.1.md)
- [ADR-0020 — verify as reference implementation](../../docs/decisions/0020-verify-as-reference-implementation.md)
- [ADR-0015 — Trust Contract versioning](../../docs/decisions/0015-trust-contract-versioning.md)
- [ADR-0021 — Conformance suite as executable contract](../../docs/decisions/0021-conformance-suite-as-executable-contract.md)
