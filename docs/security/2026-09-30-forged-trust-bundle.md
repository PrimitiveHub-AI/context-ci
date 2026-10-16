# Security Advisory — Forged Trust Bundles accepted at default verification

> **Draft GHSA** — ready to publish at `github.com/DevXYZx/primitivehub/security/advisories`.
> Reported **2026-09-30** (private disclosure). Remediated + published **2026-10-16**.
> Reporter credit: **PENDING** (acknowledgment on hold per owner).

## Summary
`@primitivehub/verify`'s `verifyBundle` returned `valid: true` at its default
`policy` level while performing **no cryptographic authentication** — it only
checked that the bundle was self-consistent (content matched the digest the
*same bundle* supplied) and that the bundle's *own* self-reported policy
verdicts passed. Steps 3–6 (in-toto statement, signature, certificate chain,
Rekor inclusion) were stubbed. An attacker who controls bundle delivery
(registry response, bundle URL, CDN object) could forge arbitrary content,
self-compute its digest, supply an empty passing predicate, and fill the
cryptographic fields with fabricated data — and the bundle was accepted as
valid. This defeats the authentication/provenance guarantee a Trust Bundle is
supposed to provide.

## Severity
**Critical.** Matches the published "acceptance of a forged Sigstore signature"
example. Proposed CVSS 3.1 vector (strategy to ratify):
`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N` — authentication bypass leading
to attacker-controlled agent-context content being trusted and loaded/installed.
**CWE-347** (Improper Verification of Cryptographic Signature), **CWE-345**
(Insufficient Verification of Data Authenticity).

## Affected packages (npm)
| Package | Affected | Patched |
|---|---|---|
| `@primitivehub/verify` | `< 0.1.1` (i.e. `0.1.0`) | **`0.1.1`** |
| `@primitivehub/phub` | `< 0.1.2` (`0.1.0`, `0.1.1`) | **`0.1.2`** |
| `@primitivehub/mcp-server` | `< 0.1.2` (`0.1.0`) | **`0.1.2`** |

Exploitable entry points (all defaulted to `policy`): `phub install`,
`phub verify`, MCP `verify_bundle`, MCP `verify_before_load` (with a bundle).
All affected versions are **deprecated** on npm.

## Proof of concept
A forged bundle — attacker content, a self-computed digest, empty predicate,
fabricated crypto fields — returns `{ valid: true }` at default level on
`@primitivehub/verify@0.1.0`. Full PoC is the regression test shipped with the
fix: `packages/phub/test/security-forged-bundle.test.ts`.

## Remediation
**Upgrade:** `@primitivehub/verify@>=0.1.1`, `@primitivehub/phub@>=0.1.2`,
`@primitivehub/mcp-server@>=0.1.2`.

The fix makes the library **fail closed**:
- `verifyBundle` now returns an authoritative **`authenticated: boolean`**,
  `false` for every bundle until real Sigstore crypto lands (v0.2). A trust
  decision MUST gate on `authenticated`, never on `valid` (which means
  "inspected", not "authentic").
- `phub install` refuses unauthenticated bundles (`BUNDLE_UNAUTHENTICATED`);
  explicit `--allow-unauthenticated` is the only, dev-only override.
- MCP `verify_bundle` / `verify_before_load` fail closed on unauthenticated
  bundles.

## Timeline
- **2026-09-30** — private report received.
- **2026-10-16** — consumer fail-closed + verify `authenticated` field shipped;
  all 4 vulnerable versions deprecated; `verify@0.1.1` / `phub@0.1.2` /
  `mcp-server@0.1.2` published.

## Credit
Reserved for the reporter — to be added when the acknowledgment is released.
