# verify-embed-example

30-line external embedding demonstration for
[`@primitivehub/verify`](../../packages/verify/). Sample app for the
Gate G-B "Sample external embed demonstrated" acceptance item.

## Pre-launch posture

Per [ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md),
`@primitivehub/verify` is NOT yet on npm. This example uses a
`file:../../packages/verify` dependency so it can run inside the
monorepo today and demonstrate the integration shape an external
embedder will use post-launch.

On the launch-day playbook, the `dependencies` block here flips
in one line:

```diff
-    "@primitivehub/verify": "file:../../packages/verify"
+    "@primitivehub/verify": "^0.1.0"
```

The rest of the example is unchanged — that swap is the entire
integration story for end users.

## Run it

The verify library must be built first (the `file:` dep points at the
package's `dist/`):

```bash
# In packages/verify/:
pnpm install && pnpm build

# In examples/verify-embed/:
pnpm install

# Verify a valid bundle from the canonical conformance suite (exit 0):
pnpm verify ../../docs/trust-contract/conformance/valid/01-minimal-valid.json
# → Trust Bundle verified: minimal-primitive@0.1.0
#     subject.contentDigest: sha256:10af9d6bbf...
#     attestation.backend:   noop

# Verify an adversarial fixture — exits 1 with DIGEST_MISMATCH:
pnpm verify ../../docs/trust-contract/conformance/invalid/01-digest-mismatch.json
# → Trust Bundle rejected (1 failure(s)):
#     [DIGEST_MISMATCH] content sha256 does not match subject.contentDigest …
```

## What the example proves

- The public API surface (`verifyBundle`, the failure-code enum, the
  types) is enough to embed verification in a third-party Node app.
- The library works on Node ≥20 without polyfills or runtime deps
  (Web Crypto `subtle.digest` is built-in).
- The structured `result.failures` array is consumable by branching on
  `code` — the failure codes are part of the public API surface and
  are stable across patch releases per ADR-0015.

## What this example deliberately does NOT do

- Network fetch. The bundle is loaded from disk so the example is
  reproducible and works air-gapped (Gate G-C ambition: this same
  shape works as `phub verify --offline`).
- Show step 3-6 verification. v0.1 stubs those; running with
  `level: "full"` would surface `*_DEFERRED` failures and exit 1.
  See `packages/verify/README.md` "Known limitations of v0.1".
- Show MCP integration. That's PR 5.5.5 (Gate G-D) territory.
