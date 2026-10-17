---
id: phub-cli
owns: [packages/phub, packages/mcp-server, actions/phub-scan, .github/workflows/phub-*]
depends_on: [phub-check-engine, phub-platform]
touches: [phub-web]
transcript: transcripts/phub-cli.jsonl
updated: 2026-10-02
---

## Charter
The `phub` developer CLI + the `phub-scan` GitHub Action — the primary hands-on product
surface. Wraps the check engine; ships under npm scope `@primitivehub`.

## Current state (2026-10-03)
- **`verify-before-load` is now the inline Context Firewall across all three transports:**
  - **MCP** — `verify_before_load` tool (was already wired; composes phub + verify).
  - **CLI** — NEW `phub verify-before-load <path...>` subcommand (`src/commands/verify-before-load-cli.ts`),
    crisp per-path verdict (SAFE / BLOCKED / UNSEALED), exit-code contract 0/1/2, `--json`,
    `--allow-unsealed`, `--require-attestation`. Help + reporter + docs shipped.
  - **CI** — NEW `mode: scan|gate` input on `actions/phub-scan`; `gate` runs the composite
    `verify-before-load` and fails on block-tier (tamper/drift/scanner). `scan` unchanged (default).
- **Low-FP contract:** each reason now carries a `tier` — `block` (tamper/drift/scanner/demanded-attestation)
  vs `posture` (unsealed). `safe` stays refuse-by-default (ADR-0029 intact; additive field only).
  `--allow-unsealed` downgrades posture-only failures; it NEVER rescues a block-tier signal (tested).
  New helper `hasBlockingReason()` exported from `@primitivehub/phub`.
- Verified E2E (CLI smoke + 11 new tests): phub 398/398, mcp-server 32/32, corpus gate GREEN (parity intact).
- `.github/workflows/phub-scan-demo.yml` gained a `gate` job (self-contained fixture → SAFE + BLOCKED asserts).
- Lock format + drift per ADR-0026; install per ADR-0028. Docs: docs/usage/03-phub-cli.md (updated).
- ✅ **SHIPPED: `@primitivehub/phub@0.1.1` published to npm (2026-10-05), `latest`.** `npx @primitivehub/phub
  verify-before-load --help` runs live from the registry. Committed on `launch/noindex-lift-go-live`
  (feat `88155fe`, changelog `f9d52b0`); published from branch `release/0.1.1` via the gated
  `phub-publish.yml` (human-run, LAUNCH-CONFIRMED).
- **Publish playbook scars (for mcp-server + future releases), all hit this cycle:**
  1. npm publish is OIDC-**trusted-publishing or token**; our workflow had neither wired → add a trusted
     publisher on npm (org/repo/workflow/env + **Allow npm publish**) OR wire `NODE_AUTH_TOKEN` from an
     `NPM_TOKEN` secret in the `launch` environment.
  2. GitHub **"Re-run jobs" replays the OLD commit** — always use **"Run workflow"** to pick up branch edits.
  3. A stray newline/char in the token → `not a legal HTTP header value`; the publish step now strips
     whitespace (`tr -d '[:space:]'`). Mint tokens clean (copy-button, verify `npm_`+alnum only).
  4. **Provenance requires a PUBLIC repo.** `DevXYZx/primitivehub` is private → `--provenance` throws E422.
     Disabled in BOTH places: workflow flag AND `packages/phub/package.json` `publishConfig.provenance:false`.
     Re-enable both when publishing from a public repo.

## Open items
- [x] Commit the verify-before-load cycle (phub CLI + action mode + docs + tests). DONE.
- [x] Publish `@primitivehub/phub@0.1.1` to npm. DONE 2026-10-05 (without provenance — see scar #4).
- [ ] **Publish `@primitivehub/mcp-server@0.1.1`** — now unblocked (phub@0.1.1 on npm). Prep release branch:
      flip deps (`@primitivehub/verify ^0.1.0`, `@primitivehub/phub ^0.1.1`) + regen lockfile; set
      `publishConfig.provenance:false`; same token/Run-workflow path as phub.
- [ ] **Cut Action tag `v0.1.1`** + bump README refs `@v0.1.0 → @v0.1.1` so `mode: gate` reaches consumers.
- [ ] Re-enable provenance (both spots) once there's a public source repo for the `@primitivehub` packages.
- [ ] Wire the `phub verify-before-load` "Try it now" block onto the site hero `[from: phub-cli → phub-web]`.
- [ ] Consider a scan→gate demo in `phub-scan-demo.yml` that also exercises the composite ACTION (not just CLI).
- [ ] After `pnpm -C packages/phub build`, re-run `pnpm install` in `packages/mcp-server` AND `bench/scripts`
      so their `file:` snapshots of phub pick up new dist files (bit me twice this cycle; fast to miss).
- [ ] `[from: phub-check-engine]` **FYI/ratify a cross-scope edit** — I edited
      `packages/phub/src/scanners/t5-unsafe-shell-install.ts` (your path) to keep Py↔TS parity green for the
      CCI-005 v0.2.8 FP fix: added a noun-modifier negative lookahead to the two verb-anchored patterns +
      bumped `detectorVersion` 0.2.7→0.2.8. Byte-parity mirror of the Python rule; owner authorized the dual
      edit. Rebuilt `packages/phub`; all 398 TS tests pass. No action needed unless you object to the mirror.

## Decisions / ADRs
ADR-0026 (lock format/drift), ADR-0028 (install).

## HELD / staged
- None introduced this cycle. (`--require-attestation` ships wired but inert until registry
  primitives carry `rekor:*` / `registry:*` attestations — registry surface stays deferred per ADR-0047.)

## Resume prompt
```
Role: lead eng for the phub-cli bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-cli.md first.
Scope: packages/phub + actions/phub-scan + .github/workflows/phub-*. Engine changes → log + flag.
Constraints: pnpm · containerize · 127.0.0.1 only · never delete HELD · no Claude attribution.
Task: <this sprint's goal>.
First action: restate current state, then plan + open-items priority before editing.
Every user-facing command ships with a copy-paste "Try it now" block. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🔴 spearhead

- **Task:** One-line verify-before-load GATE — MCP middleware + CI action + CLI, inline blocking, crisp low-FP verdicts, trivial install.
- **Gain:** Distribution + stickiness — the actual firewall, embedded where devs work.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
