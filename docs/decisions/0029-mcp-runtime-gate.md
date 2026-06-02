# ADR-0029: MCP runtime gate — `verify_before_load`

**Status:** Accepted
**Date:** 2026-06-02
**Related:** ADR-0018 (Context Policy Language), ADR-0020 (verify as
reference implementation), ADR-0023 (phub CLI + detector parity),
ADR-0025 (active surfaces + phub audit), ADR-0026 (phub.lock + drift),
ADR-0027 (phub watch), ADR-0030 (FP resolution + AV-vendor parallel),
ADR-0031 (mcp-server as transport),
`packages/phub/src/commands/verify-before-load.ts`,
`packages/mcp-server/src/tools/verify-before-load.ts`

## Context

The active-surfaces arc shipped four surfaces from ADR-0025:
- `phub audit` — point-in-time inventory + scan (ADR-0025)
- `phub.lock` — boot-time integrity baseline (ADR-0026)
- `phub watch` — run-time on-access guard (ADR-0027)
- `@primitivehub/mcp-server` — agent-runtime transport for the
  underlying primitives (ADR-0031: `verify_bundle`, `scan_text`,
  `audit_workspace`, `check_lock`)

What's missing: **a single MCP tool an agent can call before reading
a specific primitive that combines the lock check + scanner verdict +
optional bundle verification into one decision.** Today an agent
that wants the equivalent must call `check_lock` and `verify_bundle`
separately, parse both, and combine the decisions in prompt-engineered
logic. That's brittle (each agent reinvents the composition) and
wrong-shaped for the demo ("agent refuses to load unattested
context" should be one tool call, not three).

This ADR closes that gap. The composite tool name —
`verify_before_load` — was forward-referenced in ADR-0026 § 7 and
ADR-0030 § 3 as the HIPS / behavior-blocker row of the
AV-product-family map. The shape was sketched in ADR-0025 § "Future
surfaces."

## Decision

### 1. Ship `verify_before_load` as the fifth MCP tool

Input schema (v0.1):

| Field | Type | Required | Default |
|---|---|---|---|
| `path` | string | yes | — |
| `workspace_root` | string | no | server cwd |
| `policy_path` | string | no | auto-discover |
| `lock_path` | string | no | auto-discover |
| `require_attestation` | boolean | no | `false` |
| `bundle` | string \| object | no | (workspace gate only) |
| `level` | `"structural"` / `"policy"` / `"full"` | no | `"policy"` |

Output:

```jsonc
{
  "safe": false,
  "reasons": [
    { "code": "PATH_NOT_IN_LOCK", "message": "..." },
    { "code": "BUNDLE_DIGEST_MISMATCH", "message": "..." }
  ],
  "checks": {
    "workspace": { "root": "...", "relativePath": "...", "absolutePath": "..." },
    "lock": { "lockPath": "...", "lockExists": true, "specVersionMatch": true,
              "pathInLock": false, "pathDigestMatch": null, "pathAttestation": null },
    "artifact": { "discovered": true, "classification": "claude-md",
                  "digest": "...", "scanned": true, "flagged": false, "verdicts": [...] },
    "bundle": { "provided": true, "parsed": true, "valid": false,
                "level": "structural", "failureCodes": [...], "deferredSteps": [...] }
  }
}
```

`isError` on the MCP envelope mirrors `!safe`.

### 2. Refuses-by-default

Every check is concerning unless proven otherwise. The eight v0.1
refusal codes:

| Code | When |
|---|---|
| `LOCK_MISSING` | No `.primitivehub/phub.lock` under workspace root. |
| `LOCK_SPEC_VERSION_MISMATCH` | Lock pinned to a Top 10 spec version this runtime doesn't recognize. |
| `PATH_NOT_FOUND` | Target path doesn't exist on disk. |
| `PATH_UNCLASSIFIED` | Path exists but isn't a known agent-context artifact class (ADR-0025). |
| `PATH_NOT_IN_LOCK` | Path is in the working tree but the lock doesn't list it — operator hasn't sealed it. |
| `PATH_DIGEST_MISMATCH` | Path is in the lock but content has drifted. |
| `PATH_UNATTESTED` | `requireAttestation: true` and the lock entry's `attestation` is `"unattested"`. |
| `PATH_FLAGGED_BY_SCANNER` | The artifact's policy-adjusted verdicts include a fail-severity finding. |

Plus when `bundle` is provided:

| Code | When |
|---|---|
| `BUNDLE_PARSE_ERROR` | The `bundle` arg can't be JSON-parsed. |
| `BUNDLE_<verify-error-code>` | Every `VerificationErrorCode` from `@primitivehub/verify` is surfaced verbatim with a `BUNDLE_` prefix (`BUNDLE_DIGEST_MISMATCH`, `BUNDLE_SIGNATURE_VERIFICATION_DEFERRED`, etc.). |

Codes are stable across patch releases (same discipline as
`VerificationErrorCode` per ADR-0015). Agents branch on `code`, not
on `message`.

### 3. Trust-decision logic lives in `@primitivehub/phub`

Per ADR-0023 (detector parity, lockstep rule) and ADR-0031 (mcp-server
as transport, zero custom trust logic), the composite-gate logic
ships in `packages/phub/src/commands/verify-before-load.ts` exported
as `verifyBeforeLoad(opts)`. The MCP wrapper in
`packages/mcp-server/src/tools/verify-before-load.ts` is a thin async
adapter that:

1. Calls `verifyBeforeLoad` (synchronous; workspace + lock + scan)
2. Optionally calls `verifyBundle` (async; cryptographic checks)
3. Merges reasons + checks into the MCP envelope

If a non-MCP consumer wants the same gate (a custom GitHub Action,
a pre-commit hook, an Aider plugin), they import `verifyBeforeLoad`
from `@primitivehub/phub` and add the `verifyBundle` call themselves
in ~10 lines. The MCP server doesn't own the trust logic; it owns
the protocol.

### 4. The bundle parameter is OPTIONAL in v0.1

The common case is "I have a primitive on disk and want to know if
it's safe to load." That doesn't need a bundle — the lock + scanner
gate is enough.

The bundle case is "I'm about to fetch a primitive from a registry
and want to verify its Trust Bundle before reading the content." For
that path, the agent provides the bundle the registry returned and
the gate verifies it as part of the same call.

This keeps the v0.1 surface small. v0.2 may add `bundle_url` or
`registry_slug` to let the gate fetch the bundle itself, but that
adds HTTP + retry + auth concerns that don't belong in v0.1.

### 5. `requireAttestation` is OFF by default

The v0.1 lock writes `attestation: "unattested"` for every artifact
(no rekor:* or registry:* states exist yet — those land with
ADR-0028 `phub install`). If `requireAttestation` defaulted to `on`,
every v0.1 lock would fail the gate.

Setting it to `on` is meaningful only when the operator is
deliberately producing rekor:* / registry:* attestations. Default
off, opt-in for production.

## Alternatives considered

1. **Don't ship the composite; let agents call check_lock + verify_bundle
   themselves.** Rejected. The composition logic ("if drift OR scan-failed
   OR bundle-invalid → unsafe") is non-trivial and easy to get wrong in
   prompt-engineering. Centralizing it gets the correctness right once.

2. **Ship the composite IN `@primitivehub/mcp-server`** instead of phub.
   Rejected. Violates ADR-0031 § 2 rule #1 ("zero custom trust logic in
   MCP package"). The decision algorithm IS trust logic; it belongs in
   phub. The MCP server is a transport.

3. **Synchronous response only (no `bundle` arg).** Considered. Rejected
   because verifying a Trust Bundle is the cryptographic half of the
   trust story; an agent fetching from a registry should be able to do
   the workspace gate AND the bundle verification in one call.

4. **Refuse the call entirely when `requireAttestation: true` and the
   lock has unattested entries.** Considered. Decided to surface
   `PATH_UNATTESTED` as a normal refusal code instead. Symmetric with
   the other codes; the caller can override.

5. **Async per-check streaming** (emit lock-check, then scan-check,
   then bundle-check via MCP notifications). Rejected for v0.1.
   Adds protocol complexity for marginal benefit (all checks run in
   under 50ms typical).

6. **A `safe_level` enum** (`unsafe` / `safe-no-attestation` /
   `safe-with-attestation`) instead of boolean. Rejected. Two-state
   gate is the right shape for "I'm about to read this file"; the
   `requireAttestation` opt-in covers the gradient.

## Consequences

### Positive

- **One call, one decision.** Agents that previously needed to compose
  3+ tool calls + custom merge logic now make one.
- **The strategic demo is one MCP call.** "Claude / Cursor / Aider
  refuses to load unattested context" is now `verify_before_load` with
  the right inputs. The paper's `claude mcp add primitivehub` story
  has a concrete primitive to point at.
- **Trust logic stays centralized.** Future detectors (T3 / T4 /
  T6..T10) automatically gate-fail through `PATH_FLAGGED_BY_SCANNER`.
  Future lock attestation states (rekor:*, registry:*) compose with
  `requireAttestation`. Nothing in the MCP wrapper needs to change.
- **Stable error codes.** Branching on `code` instead of `message`
  works the same way the verify library's `VerificationErrorCode`
  does, and survives version bumps.
- **Non-MCP consumers get the same gate.** `verifyBeforeLoad` is a
  programmatic export of phub; a pre-commit hook or custom Action
  can use it directly.

### Negative

- **The composite gate runs `runAudit` on EVERY call** — even though
  the agent only cares about one path. v0.1 accepts this for
  simplicity; v0.2 candidate is a `runAuditForPath(root, targetPath)`
  fast-path that only walks the path's ancestors + applies the lock
  comparison to that single entry.
- **`bundle` provided as a JSON string is parsed twice on the wire**
  (once by JSON-RPC, once by the tool's `JSON.parse`). Negligible
  for v0.1; v0.2 may accept only pre-parsed objects.
- **`requireAttestation` is a foot-gun.** Setting it on a workspace
  without phub-install-emitted locks fails every call. Documented
  + the default is off + the README explains the gradient.

### Neutral

- **The MCP wrapper grows the tool count from 4 → 5.** Schema-stable
  per ADR-0031 § 2 rule #2 (additive). No existing tool changes.
- **The composite is the FIRST MCP tool that exposes a phub function
  with no corresponding CLI subcommand.** `phub verifyBeforeLoad`
  doesn't exist as a CLI command in v0.1 — only the programmatic
  export and the MCP tool. v0.2 may add a `phub gate <path>` CLI for
  pre-commit hook use cases.

## Implementation

`packages/phub/`:
- `src/commands/verify-before-load.ts` — `verifyBeforeLoad(opts)`,
  the decision algorithm + check payload assembly + stable error
  codes.
- `src/index.ts` — re-exports `verifyBeforeLoad`,
  `VerifyBeforeLoadOptions`, `VerifyBeforeLoadResult`,
  `VerifyBeforeLoadReason`, `VerifyBeforeLoadReasonCode`,
  `VerifyBeforeLoadChecks`.
- `test/verify-before-load.test.ts` — 11 cases covering every refusal
  code + happy path + nested-directory paths + the checks envelope.

`packages/mcp-server/`:
- `src/tools/verify-before-load.ts` — `VERIFY_BEFORE_LOAD_TOOL`
  manifest + `callVerifyBeforeLoad(rawArgs)` async wrapper.
- `src/server.ts` — register the tool + dispatch case.
- `src/index.ts` — re-export the tool + callable.
- `test/verify-before-load.test.ts` — 10 cases for argument
  validation, composite gate (no bundle), bundle integration
  (string + object inputs, parse errors, invalid bundles), and the
  checks envelope shape.
- `test/server.test.ts` — updated to assert 5 tools (was 4).

Total: ~600 lines of source + ~400 lines of tests. 21 new tests
across the two packages.

## What ships in subsequent PRs

- **ADR-0028 `phub install <slug@semver>`** — produces lock entries
  with `attestation: "registry:<slug>@<semver>"`. Once it lands,
  `requireAttestation: true` becomes a meaningful production flag
  (today it's a development opt-in only).
- **Fast-path `runAuditForPath(root, target)`** — v0.2 candidate to
  skip the full walker on every gate call.
- **`phub gate <path>` CLI subcommand** — exposes the same logic to
  pre-commit hooks and arbitrary scripts. Composes naturally with
  `phub watch` (the daemon could call the gate per fs-event instead
  of the full audit).
- **MCP notifications** — emit progress events ("lock check OK",
  "bundle verification in progress") for slow paths. v0.2.

## References

- `packages/phub/src/commands/verify-before-load.ts` — reference impl
- `packages/mcp-server/src/tools/verify-before-load.ts` — MCP wrapper
- ADR-0018 — Context Policy (consumed by the scanner step)
- ADR-0020 — verify as reference implementation
- ADR-0023 — phub CLI + detector parity
- ADR-0025 — active surfaces (the arc this ADR closes)
- ADR-0026 — phub.lock + drift (consumed by the lock step)
- ADR-0027 — phub watch (consumes verifyBeforeLoad in v0.2)
- ADR-0030 — FP resolution + AV-vendor parallel (HIPS / behavior-blocker row)
- ADR-0031 — mcp-server as transport (composition rules this ADR follows)
- `docs/execution-plan.md` Gate G-D — strategic context
