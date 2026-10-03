# 0047 — Product scope: Context Firewall (/check + /Forge + runtime gate); registry deferred

Status: Accepted — 2026-10-03
Supersedes framing in: 0045 (product-first launch), the parked reputation-layer fork

## Context

PrimitiveHub's strategic position is now explicit: a **modern antivirus / firewall for
the *context* of AI agents** — not a marketplace of skills. The website offers exactly
two surfaces, and the real enforcement lives off-web:

- **/check** — scan pasted / fetched AI-context (AGENTS.md, CLAUDE.md, skills) against the
  Context CI Top-10; return a verdict. Ephemeral (input stashed in cache, scanned async);
  **touches no object storage, no tenant**.
- **/Forge** — client-side authoring IDE with live Context-CI feedback as you type.
  v1 persists to `localStorage` + Download/export; **no account, no server-side storage**.
- **Runtime gate (the actual "firewall")** — `phub verify-before-load`, the MCP server,
  and the GitHub Action. This is the enforcement point: it blocks poisoned context *at the
  moment the agent loads it*. The website is top-of-funnel; the gate is the product.

## Decision

Ship the firewall triad above. **Defer (keep dormant, flag-off, NOT delete)** the entire
registry / marketplace / community-contribution stack:

- registry publish (`upload_primitive_version`), seed catalog, discovery/install
- **object storage (Cloudflare R2 / MinIO)** — only ever the registry/publish blob tier
- accounts / orgs / multi-tenancy / Postgres RLS
- Sigstore keyless signing (publish-time), Trust-Bundle compose/install
- contributors / governance, /validation pipeline surface

These are already gated in `apps/web/lib/flags.ts` (`publish/registry/auth/signing/bundles/
contributors/contextCi = false`). Code stays HELD (per the no-delete-held-code discipline);
flags remain the single on-switch if any surface is ever revived.

## Consequences

- **Object storage leaves the critical path.** /check is ephemeral; /Forge is client-side.
  Nothing in the shipped product writes blobs. R2 is not wired in prod; MinIO is relevant
  only to a future enterprise self-host of a *revived* registry — not now.
- **CI gates only the live surface.** `build-api` pytest excludes the deferred-surface
  modules (registry/storage/orgs/RLS/signing/bundles/contributors/validation/trust-bundle)
  via an env-gated `collect_ignore` in `apps/api/tests/conftest.py`
  (`PRIMITIVEHUB_CI_LIVE_ONLY=1`). Tests are **kept and still run locally** with storage up;
  they're deselected in CI because they test a surface we are not shipping. Reversible by
  dropping the env var.
- **The moat is detection quality + runtime-gate distribution + /check telemetry** — not
  network effects. Invest there (detectors, measured-truth corpus/eval, the gate's DX).
- **Liability shed:** scanning the user's own context ≠ hosting/endorsing third-party
  content. The parked reputation-layer liability question is moot under this scope.

## Follow-ups
- Reframe site hero + brand around "firewall"; make the runtime gate first-class.
- Build the anonymized /check-telemetry → threat-intel pipeline (replaces the lost
  community sample stream).
