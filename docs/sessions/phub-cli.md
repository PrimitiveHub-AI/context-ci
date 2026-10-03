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
- ⚠️ Not committed yet — working tree changes staged for review; publish of phub/mcp still gated (ADR-0022).

## Open items
- [ ] Commit the verify-before-load cycle (phub CLI + action mode + docs + tests) — awaiting go-ahead.
- [ ] Verify `@primitivehub` publish readiness (dry-run the publish workflow).
- [ ] Wire the `phub verify-before-load` "Try it now" block onto the site hero `[from: phub-cli → phub-web]`.
- [ ] Consider a scan→gate demo in `phub-scan-demo.yml` that also exercises the composite ACTION (not just CLI).
- [ ] After `pnpm -C packages/phub build`, re-run `pnpm install` in `packages/mcp-server` AND `bench/scripts`
      so their `file:` snapshots of phub pick up new dist files (bit me twice this cycle; fast to miss).

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
