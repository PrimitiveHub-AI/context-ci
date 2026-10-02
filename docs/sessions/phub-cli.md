---
id: phub-cli
owns: [packages/phub, actions/phub-scan, .github/workflows/phub-*]
depends_on: [phub-check-engine, phub-platform]
touches: [phub-web]
transcript: transcripts/phub-cli.jsonl
updated: 2026-10-02
---

## Charter
The `phub` developer CLI + the `phub-scan` GitHub Action — the primary hands-on product
surface. Wraps the check engine; ships under npm scope `@primitivehub`.

## Current state (2026-10-02)
- CLI in `packages/phub`; GitHub Action in `actions/phub-scan` (README + action.yml dirty).
- Lock format + drift detection per ADR-0026; install path per ADR-0028; `.primitivehub/phub.lock` present.
- Publish + CI workflows exist: `.github/workflows/phub-publish.yml`, `phub-ci.yml`, `phub-scan-demo.yml`.
- Docs: docs/usage/03-phub-cli.md, docs/usage/05-phub-lock.md.

## Open items
- [ ] Verify `@primitivehub` publish readiness (dry-run the publish workflow).
- [ ] `phub-scan` action polish per dirty README/action.yml changes.
- [ ] CLI UX: "Try it now" copy-paste block for the site (coordinate with phub-web).

## Decisions / ADRs
ADR-0026 (lock format/drift), ADR-0028 (install).

## HELD / staged
(staged CLI commands / flags — list before close)

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
