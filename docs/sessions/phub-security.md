---
id: phub-security
owns: [SECURITY.md, SECURITY-BOUNTY.md, docs/threat-model.md, security ADRs, CI security config (dependabot/codeql/secret/container scan), /security-review cadence]
depends_on: []
touches: [all sessions — routes fixes to the owning context, never edits their code]
transcript: transcripts/phub-security.jsonl
updated: 2026-10-23
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
- ✗ **No dependency-audit in CI — CONFIRMED ABSENT (2026-10-23).** Grepped all 13
  workflows in `.github/workflows/`; zero `pnpm audit`/`npm audit`/`pip-audit`/`uv audit`/
  `osv-scanner` steps. Add + gate on high/critical.
- ✗ **Dependabot — CONFIRMED ABSENT (2026-10-23).** No `.github/dependabot.yml`|`.yaml`
  on disk. Enable (npm·pnpm, pip/uv, github-actions).
- ✗ **No container image scanning — CONFIRMED ABSENT (2026-10-23).** No trivy/grype/snyk/
  docker-scout in any workflow (the lone "trivy" grep hit was a prose comment in
  `scanner-bench.yml` about the Context CI *detection* scanners, not image scanning).
- ✗ **No CI secret-scanning gate — CONFIRMED ABSENT (2026-10-23) [new this cycle].** No
  gitleaks/trufflehog/secret-scan step in any workflow. Directly relevant to the live
  leaked-PAT P0: nothing in CI would catch the *next* secret before it lands. (The only
  `codeql` reference is a permissions comment in `phub-scan-demo.yml` for uploading phub's
  OWN scan SARIF — NOT CodeQL SAST on our code; consistent with SAST-not-enabled above.)
- ⚠ Threat-model leans to the *detection* domain; confirm coverage of our *own* stack (authentik
  [LIVE per phub-platform], tenant RLS, R2 creds, the dormant registry/storage attack surface).

## Open items (prioritized)
- [ ] **P0** Rotate the 3 leaked PATs + scrub the on-disk transcript (revoke = owner/human-only).
- [ ] **P0** Enable Code Scanning / CodeQL (SAST on TS + Python); unblocks phub-scan SARIF too.
- [ ] **P1** Add dep-audit to CI: `pnpm audit --prod` (web + each package), `uv`/pip-audit (apps/api); gate high/crit → route fixes to the owning session.
- [ ] **P1** Verify/enable Dependabot across npm, pip/uv, github-actions; triage its PRs.
- [ ] **P1** Container scan (trivy) on build-web + build-api images; gate fixable HIGH/CRIT → route to phub-platform.
- [ ] **P1** Add a CI secret-scanning gate (gitleaks/trufflehog) — own scope; prevents recurrence of the leaked-PAT P0. [confirmed absent 2026-10-23]
- [ ] **P2** CI job: `phub verify-before-load` on the repo's own AGENTS/CLAUDE context (dogfood the firewall).
- [ ] **P2** Threat-model refresh for our own stack; wire SECURITY.md disclosure SLA ↔ the bounty.
- [ ] **P1 `[from: phub-web]` 2026-10-17 — retire the bug-bounty programme from the canonical
      security docs.** Owner directive: "no bug bounty program here, this is a research initiative
      not an enterprise." The WEBSITE is already reconciled + live (phub-web removed the `/security`
      programme section, USD severity bands, cash CTAs, footer label; commit `2829aa1`). Your owned
      docs still advertise it: `SECURITY-BOUNTY.md` (whole file) + `SECURITY.md:14,23` (bounty column
      + "bounty … SECURITY-BOUNTY.md" line). Reconcile to coordinated-disclosure / public-ledger
      credit (no cash), matching the site. ALSO: this reverses **launch Gate G-G** ("Bug bounty
      announced…", `bf60972`) and `docs/launch/checklist.md:120` — needs a strategy call on whether
      G-G is dropped/reframed. phub-web did NOT edit these (your lane + launch-gate coupling).
- [ ] Routing log (finding → owning session): phub-web → phub-security (bounty-doc retirement, above).

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
  container scan + Dependabot + secret-scanning to CI, dogfood phub-on-self, refresh the own-stack
  threat model.
- **Gain:** Our own attack surface is continuously watched — the credibility floor for selling a
  security tool; "we practice what we scan."
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.

### How this session runs (verify-until-done loop)
This is a STANDING rib, not a one-shot. Each pass is a bounded loop:
**act → observe → correct → repeat, with a named exit condition.**
- **Cycle exit condition:** every advisory / posture gap touching our stack is triaged to a
  TERMINAL state — `confirmed-present` / `confirmed-absent` / `patched` / `not-applicable (reason)`
  / `accepted-risk (owner + expiry)`. Zero items left `unknown`. Stop the pass only then.
- **Per-cycle Definition of Done (gate top-down):** security (no detector/fix paywalled, no new
  secret/egress) → truth (every claim verified against current repo/CI, not memory) → spec/tenant
  → verified behavior (checks actually run, evidence pasted) → stated plainly (what passed/absent/
  deferred). The loop stops when this gate passes, not before.
- **Bound:** if a fix won't converge, surface it as a blocker with an owner — no silent
  accepted-risk, no infinite retry. Irreversible flips (rotate creds, enable features) are
  human-only: recommend + route, don't execute.

### Cycle log
- **2026-10-23 — read-only verify pass (general session, routed here).** Closed all four ⚠
  to-verify items → all CONFIRMED ABSENT with evidence (grepped 13 CI workflows + `.github/`):
  dep-audit, Dependabot, container scan, CodeQL/SAST. NEW finding: no CI secret-scanning gate
  (gitleaks/trufflehog) — added as P1, own-scope, mitigates the leaked-PAT P0 recurrence. No creds
  touched, no features flipped, no code edited (triage-only mandate held). P0s unchanged and still
  owner-gated. Exit condition met: zero items `unknown`.
