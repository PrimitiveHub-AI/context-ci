# `@primitivehub/verify` — embeddable verifier

> [← back to index](./README.md) · prev: [MCP server](./06-mcp-server.md) · next: [Recipes →](./08-recipes.md)

**Source:** [`packages/verify/`](../../packages/verify/)
**ADR:** [ADR-0020](../decisions/0020-verify-as-reference-implementation.md)
**Spec:** [Trust Contract v0.1](../trust-contract-v0.1.md)

The reference verifier for Trust Contract v0.1, packaged as a
zero-dep Node + browser library. < 50KB minified. Use this when you
need to verify a Trust Bundle programmatically — from a Node service,
a browser app, an Electron client, or an inline test.

The `phub verify` CLI subcommand and the MCP `verify_bundle` tool
both wrap this library. If you only need verification at the
command line, see [phub CLI § verify](./02-phub-cli.md#verify);
if you need it from agent code, see [MCP server](./06-mcp-server.md);
this page covers direct programmatic use.

---

## Table of contents

- [Install](#install)
- [30-line embed](#30-line-embed)
- [The API surface](#the-api-surface)
- [Verification levels](#verification-levels)
- [Policy options](#policy-options)
- [Error codes](#error-codes)
- [Known limitations](#known-limitations)
- [TypeScript types](#typescript-types)

---

## Install

```bash
pnpm add @primitivehub/verify
# or
npm install @primitivehub/verify
```

Requires Node ≥ 20 (uses built-in Web Crypto `subtle.digest`). Works
in modern browsers without polyfill.

Pre-launch via monorepo: build `packages/verify/` and import via
`file:../verify` (the [embed example](../../examples/verify-embed/)
shows this pattern).

---

## 30-line embed

```ts
import { verifyBundle } from "@primitivehub/verify"

// Consume ONLY a cryptographically authenticated bundle.
//
// `result.valid` is NOT a trust decision. At the `structural` / `policy`
// levels it can be `true` while authenticating NOTHING: it only confirms the
// bundle is self-consistent (its content matches the digest the *same bundle*
// supplies) and that the bundle's *own* self-reported policy verdicts pass.
// An attacker who controls bundle delivery can forge all of that. The trust
// gate is `result.authenticated`.
async function consumeIfTrusted(bundleJson: string, signedContent: () => void) {
  const bundle = JSON.parse(bundleJson)

  const result = await verifyBundle(bundle, { level: "full" })

  if (!result.authenticated) {
    // v0.1: the Sigstore signature, Fulcio cert chain, and Rekor inclusion
    // proof are STUBBED (they land in verify v0.2), so `authenticated` is
    // `false` for every bundle today — this ALWAYS throws, by design. Fail
    // closed. Do NOT fall back to `result.valid` or `result.inspected` to
    // "make it pass": that consumes content that was never authenticated.
    const deferred = result.deferredSteps?.length
      ? ` (deferred: ${result.deferredSteps.join(", ")})`
      : ""
    throw new Error(`untrusted: not cryptographically authenticated${deferred}`)
  }

  // Authenticated end-to-end. Safe to consume the primitive.
  signedContent()
}
```

If you only want structural + policy **inspection** and you explicitly accept
that the content is **not** cryptographically authenticated, name it so — and
never use this path to gate loading untrusted content:

```ts
// Inspection only. `result.valid` here means "self-consistent + self-reported
// policy passed", NOT "authenticated". Returns the full result for display.
async function inspectUntrustedBundle(bundleJson: string) {
  return verifyBundle(JSON.parse(bundleJson), { level: "policy" })
}
```

Branch on `result.failures[i].code`, not on `result.failures[i].message` —
the codes are stable across patch releases per [ADR-0015](../decisions/0015-trust-contract-versioning.md);
messages may improve.

---

## The API surface

```ts
import {
  // Main entry:
  verifyBundle,

  // Types:
  type TrustBundle,
  type TrustBundleSubject,
  type TrustBundleContent,
  type TrustBundleAttestation,
  type VerifyOptions,
  type VerificationResult,
  type VerificationLevel,
  type VerificationFailure,
  type VerificationErrorCode,
  VerificationError,

  // Policy helpers (lower-level; usually called via verifyBundle):
  evaluatePolicy,
  extractValidation,
  type PolicyOpts,
  type PredicateVerdict,
  type Severity,
} from "@primitivehub/verify"
```

`verifyBundle(bundle, opts) → Promise<VerificationResult>` is the
single entry point most callers need.

---

## Verification levels

```ts
await verifyBundle(bundle, { level: "structural" })  // steps 1+2
await verifyBundle(bundle, { level: "policy" })      // steps 1+2+7 (default)
await verifyBundle(bundle, { level: "full" })        // steps 1-7 (steps 3-6 stubbed)
```

| Level | Steps | What it catches |
|---|---|---|
| `structural` | 1, 2 | Schema violations, content-digest tampering (T9), malformed bundles |
| `policy` (default) | 1, 2, 7 | + Context CI verdict policy (default: any `fail` severity rejects) |
| `full` | 1-7 | + Sigstore signature, cert chain, Rekor inclusion proof — **v0.1 stubs these** |

Steps in the Trust Contract verification procedure:

1. Schema validation (Trust Contract v0.1 schema).
2. Content-digest verification (`sha256(content) == subject.contentDigest`).
3. in-toto Statement parse (stubbed).
4. Signature verification (stubbed).
5. Certificate chain walk (stubbed).
6. Rekor inclusion proof (stubbed).
7. Context CI policy evaluation (Top 10 verdict severity check).

---

## Policy options

Default policy: any predicate verdict with `severity === "fail"`
rejects the bundle. Override:

```ts
// Strict — treat warning verdicts as fail too:
await verifyBundle(bundle, {
  level: "policy",
  policy: { strict: true },
})

// Allow a specific detector OR CCI ID to FAIL without rejecting:
await verifyBundle(bundle, {
  level: "policy",
  policy: { allowFailFor: ["t5.unsafe_shell_install", "CCI-005"] },
})
```

For the full YAML-configured policy file (`.primitivehub/policy.yaml`),
prefer the `phub` CLI or MCP server — those load the file and apply
it. The library accepts an in-memory `policy` object for cases where
you've already parsed it yourself or want to construct it
dynamically.

---

## Error codes

Stable across patch releases per [ADR-0015](../decisions/0015-trust-contract-versioning.md).
Branch on these codes, not on `message`:

| Code | Step | Meaning |
|---|---|---|
| `SCHEMA_INVALID` | 1 | Bundle fails Trust Contract v0.1 JSON Schema. |
| `UNKNOWN_BUNDLE_VERSION` | 1 | `bundleVersion` is not `"0.1"`. |
| `UNKNOWN_BACKEND` | 1 | `attestation.backendName` is not in the known-backend enum. |
| `DIGEST_MISMATCH` | 2 | sha256 of `content.bytesB64` does not match `subject.contentDigest`. |
| `STATEMENT_PARSE_DEFERRED` | 3 | in-toto Statement protobuf decoder stub. |
| `SIGNATURE_VERIFICATION_DEFERRED` | 4 | ECDSA-P256 signature verification stub. |
| `CERT_CHAIN_VERIFICATION_DEFERRED` | 5 | Cert-chain walk stub. |
| `REKOR_INCLUSION_PROOF_DEFERRED` | 6 | Merkle inclusion proof stub. |
| `POLICY_REJECTED` | 7 | Predicate has a non-allowed FAIL verdict (per policy). |

The `*_DEFERRED` codes are only returned when `level: "full"` is
requested. `structural` and `policy` levels never see them.

---

## Known limitations

Verification steps 3-6 are **stubbed** in v0.1. Calling with
`level: "full"` returns `valid: false` and `failures` containing the
`*_DEFERRED` codes. The library's `deferredSteps` field lists which
steps are stubbed:

```ts
const result = await verifyBundle(bundle, { level: "full" })
console.log(result.deferredSteps)
// → ["statement", "signature", "cert", "rekor"]
```

v0.2 will reintroduce these:

- in-toto Statement protobuf decoding (binds signature to subject digest).
- ECDSA-P256 signature verification via Web Crypto.
- Cert-chain walk against bundled Sigstore trust roots (public + staging).
- Rekor Merkle inclusion proof verification (offline; bundle carries the proof).

Until v0.2: `structural` + `policy` levels are fully implemented
and load-bearing. The cryptographic claims of who-signed-what are
NOT yet checked by this library; the producing PrimitiveHub instance
DOES enforce them end-to-end via its server-side code path, so the
trust chain is intact when you trust the issuer.

---

## TypeScript types

```ts
interface TrustBundle {
  bundleVersion: "0.1"
  schemaUri: string
  subject: TrustBundleSubject
  content: TrustBundleContent
  attestation: TrustBundleAttestation
  detailUrl?: string
}

interface VerificationResult {
  valid: boolean
  failures: VerificationFailure[]
  deferredSteps: string[]
  level: VerificationLevel
}

interface VerificationFailure {
  code: VerificationErrorCode
  message: string
  path?: string
}

type VerificationLevel = "structural" | "policy" | "full"

type VerificationErrorCode =
  | "SCHEMA_INVALID"
  | "UNKNOWN_BUNDLE_VERSION"
  | "UNKNOWN_BACKEND"
  | "DIGEST_MISMATCH"
  | "STATEMENT_PARSE_DEFERRED"
  | "SIGNATURE_VERIFICATION_DEFERRED"
  | "CERT_CHAIN_VERIFICATION_DEFERRED"
  | "REKOR_INCLUSION_PROOF_DEFERRED"
  | "POLICY_REJECTED"
```

---

## See also

- [`packages/verify/README.md`](../../packages/verify/README.md) — package overview
- [`packages/verify/CHANGELOG.md`](../../packages/verify/CHANGELOG.md) — release notes
- [`examples/verify-embed/`](../../examples/verify-embed/) — 30-line embed demo
- [Trust Contract v0.1 spec](../trust-contract-v0.1.md) — the wire format
- [ADR-0020 — verify as reference implementation](../decisions/0020-verify-as-reference-implementation.md)
- [ADR-0015 — Trust Contract versioning](../decisions/0015-trust-contract-versioning.md)
- [ADR-0021 — conformance suite as executable contract](../decisions/0021-conformance-suite-as-executable-contract.md)
