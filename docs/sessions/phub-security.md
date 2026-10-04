---
id: phub-security
owns: [SECURITY.md, SECURITY-BOUNTY.md, docs/threat-model.md, security ADRs, CI security config (dependabot/codeql/secret/container scan), /security-review cadence]
depends_on: []
touches: [all sessions — routes fixes to the owning context, never edits their code]
transcript: transcripts/phub-security.jsonl
updated: 2026-10-03
---

## Charter
**Product security — is PrimitiveHub *itself* secure?** Own the attack surface of our own code,
dependencies, build, and supply chain. For a firewall/AV product this is existential: a CVE in
the security tool is a credibility-ending event. **Reviewer/triage mandate, NOT code-ownership** —
find → triage → prioritize → **route each fix to the owning bounded-context session** (log it in
that ledger; never edit its code). Dogfood: run `phub verify-before-load` on our own repo.

This is the *own-attack-surface* session. The *detection domain* (what attacks we catch — Top-10 /
CCI-* / adversarial corpus) is NOT here; it lives in phub-check-engine + phub-corpus-eval.

## Scope (owned)
- `SECURITY.md`, `SECURITY-BOUNTY.md`, `docs/threat-model.md`, security ADRs
- CI security config: Dependabot, CodeQL/SAST, secret-scanning, container-image scanning
- Supply-chain posture: npm publish provenance, SHA-pinned Actions, lockfile integrity
- The `/security-review` cadence + triage/routing of findings
NOT owned: feature code in `apps/*`, `packages/*` — findings are routed to their sessions.

## Current state (2026-10-03) — ✓ verified · ⚠ to-verify
**Strengths**
- ✓ GitHub Actions **SHA-pinned** (e.g. `codeql-action@b7351df…`, `setup-node@49933ea…`).
- ✓ npm publish **gated + OIDC provenance** (`id-token: write`; workflow_dispatch + `LAUNCH-CONFIRMED`
  + `environment: launch` reviewer; ADR-0022).
- ✓ `default_workflow_permissions = read` (least-privilege default; confirmed via API).
- ✓ Localhost-only bind posture (127.0.0.1) across compose port specs.
- ✓ `SECURITY.md`, `SECURITY-BOUNTY.md`, `docs/threat-model.md` present.
- ✓ Partial dogfooding: `phub-scan-demo` scans CLAUDE.md / README / DESIGN.

**Gaps / live findings**
- 🔴 **Secret hygiene (ACTIVE):** 3 GitHub PATs were pasted into chat + persisted to session
  transcripts — `ghp_Uf7A…`, `ghp_RePoS…`, `ghp_1LIV…`. **Rotate/revoke all three** (owner).
  The raw transcript `~/.claude/projects/-srv-primitivehub-app/*.jsonl` still holds the first token
  in cleartext; the archived copy on branch `session-archive` is redacted. Scrub/quarantine.
- 🔴 **Code Scanning / SAST not enabled** (confirmed via API: "Code scanning is not enabled").
  No CodeQL over our own TS/Python. Enabling it also unblocks the phub-scan SARIF upload.
- ⚠ **No dependency-audit in CI** — no `pnpm audit` / `uv`/`pip-audit` step seen in build-web /
  build-api / package CIs. Add + gate on high/critical.
- ⚠ **Dependabot** not verified (`.github/dependabot.yml`?). Confirm/enable (npm·pnpm, pip/uv, actions).
- ⚠ **No container image scanning** (trivy/grype) on web/api images.
- ⚠ Threat-model leans to the *detection* domain; confirm coverage of our *own* stack (authentik
  [LIVE per phub-platform], tenant RLS, R2 creds, the dormant registry/storage attack surface).

## Open items (prioritized)
- [ ] **P0** Rotate the 3 leaked PATs + scrub the on-disk transcript (revoke = owner/human-only).
- [ ] **P0** Enable Code Scanning / CodeQL (SAST on TS + Python); unblocks phub-scan SARIF too.
- [ ] **P1** Add dep-audit to CI: `pnpm audit --prod` (web + each package), `uv`/pip-audit (apps/api); gate high/crit → route fixes to the owning session.
- [ ] **P1** Verify/enable Dependabot across npm, pip/uv, github-actions; triage its PRs.
- [ ] **P1** Container scan (trivy) on build-web + build-api images; gate fixable HIGH/CRIT → route to phub-platform.
- [ ] **P2** CI job: `phub verify-before-load` on the repo's own AGENTS/CLAUDE context (dogfood the firewall).
- [ ] **P2** Threat-model refresh for our own stack; wire SECURITY.md disclosure SLA ↔ the bounty.
- [ ] Routing log (finding → owning session): _none yet._

## Decisions / ADRs
ADR-0022 (three-lock publish), ADR-0047 (scope — dormant surfaces still carry attack surface), SECURITY.md.

## HELD / staged
(none)

## Resume prompt
```
Role: product-security lead for PrimitiveHub — a Context Firewall for AI agents (ADR-0047).
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-security.md before anything.
Mandate: REVIEW/TRIAGE only — find, prioritize, and ROUTE fixes to the owning session's ledger;
never edit another session's code. Own: SECURITY.md, SECURITY-BOUNTY.md, docs/threat-model.md,
security ADRs, and CI security config (Dependabot/CodeQL/secret/container scan).
Constraints: measured-truth severity (no inflated CVSS) · never delete HELD · no Claude attribution ·
irreversible flips (enabling features, rotating prod creds) are human-only — recommend, don't execute.
Task: <this sprint's goal>.
First action: restate current posture (strengths + live findings) from the ledger, then give a
prioritized P0→P2 plan before changing anything. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🟠 active (credibility floor for a security vendor)
- **Task:** Stand up the AppSec baseline — rotate leaked PATs, enable CodeQL/SAST, add dep-audit +
  container scan + Dependabot to CI, dogfood phub-on-self, refresh the own-stack threat model.
- **Gain:** Our own attack surface is continuously watched — the credibility floor for selling a
  security tool; "we practice what we scan."
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
