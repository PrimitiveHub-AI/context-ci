---
id: phub-web
owns: [apps/web]
depends_on: [phub-platform]
touches: [phub-check-engine, phub-corpus-eval]
transcript: transcripts/phub-web.jsonl
updated: 2026-10-17
---

## Charter
Make primitivehub.ai the elite category-creator surface — marketing + product UI that
presents `/check` and the `phub` CLI as a new category, not a v0 SaaS toy.

## Current state (2026-10-03)
- **Topology correction (supersedes the 2026-10-02 note):** `127.0.0.1:3000` now runs the
  **prod build** image behind Cloudflare+nginx — editing the tree no longer hot-reloads to
  prod; deploy is a real `scripts/deploy.sh` step (see `memory/project_deploy_topology`).
  Preview = `primitivehub-web-preview-1` on `127.0.0.1:3100` (`pnpm dev`, live `./apps/web`
  bind-mount via `compose.preview.yaml`, off-nginx, hits the real API) — already up; this IS
  the charter's "2nd loopback port", no worktree needed for it.
- `apps/web` tree was **clean** at session start — the old "check-showcase under active edit
  (dirty tree)" note was stale (that work had been committed).
- ADR-0047 funnel polish sprint completed this session (previewed on :3100; not yet deployed).
  See "Session log — 2026-10-03" below.

## Open items
- [x] Kill "AI-designed kiddy" empty space; tighten visual density. — appears addressed:
      Forge's 4 sparse cards → one tabbed inspector; trust-runtime pillar cards carry
      accent/depth. Re-audit `threat-verified-section` + `cli-roadmap` next pass (not deep-read).
- [x] Wire live `/check` demo on landing (consume engine output, not mocked). — `CheckShowcase`
      is live against `/api/v1/check` POST+poll with DemoDataBadge warm-start.
- [x] Credibility pass (no unlabeled numbers — DemoDataBadge / EvaluationLink). — in place.
- [ ] **P3 deeper hero reframe** — 3-beat scan/author-safe/block triad replacing the 6-verb
      credibility strip. Deferred to phub-strategy's brand pass; only the subhead clause landed.
- [ ] **P4 detector-count** — `/check` page + OG image hardcode "10 detectors" while the hero
      derives it live from `loadLatestEvaluation()`. Left as-is: "Top 10" is definitional, and
      `/check` is a client component that can't reach the server-only loader cleanly. Revisit
      only if the taxonomy size ever changes.
- [x] **Anonymous-public /check + /Forge (retire login) `[from: phub-platform]`** — RATIFIED
      (owner 2026-10-17: "we stopped the login and registration component"). Verified already
      consistent: `lib/flags.ts` `auth:false` (no env override), so navbar/user-menu/OrgPicker
      render anonymous site-wide. No copy change needed. RESIDUAL: `/auth/{login,callback,logout}`
      routes + `components/user-menu.tsx` remain in-tree (flag-gated dead) — leave as HELD; a
      retirement pass (route removal) is a separate task, not done here.
- [ ] **Stale eval artifact `[→ phub-corpus-eval]`** — `apps/web/lib/evaluation.data.json` is
      `measured_at:2026-06-07` (manifest 0.2) while `bench/baseline/2026-10-03-*.json` exists.
      Refresh the embedded artifact and pin the canonical adversarial-vs-conformance denominator
      (adversarial corpus = CCI-001/002/005 trifecta, 15 samples per bench/README + ADR-0032; the
      embedded 99-sample in-sample set scores all 10). Web now says "in-sample macro-F1" honestly;
      corpus-eval owns the refresh.

## Decisions / ADRs
ADR-0040 (surface/anti-bloat), ADR-0045 (product-first launch), ADR-0047 (Context-Firewall scope).

## HELD / staged
- `/auth/{login,callback,logout}` + `components/user-menu.tsx` + `OrgPicker` — flag-gated dead
  (`lib/flags.ts auth:false`). Login/registration was stopped (owner 2026-10-17); code kept, not
  deleted. Retire in a dedicated pass if the owner wants the routes gone.

## Session log — 2026-10-17 (security-contract TRUTH pass — handoff `docs/security/2026-10-17-website-contract-fixes.md`)
Priority: security > truth (over velocity/taste). The website overclaimed the v0.1 security
contract; corrected on preview (:3100). Verified ground truth from source first — did NOT paste
the handoff's copy on trust.

**Verified in source (phub-cli/mcp/verify packages, read-only):** Sigstore sig/Fulcio/Rekor are
STUBBED → `authenticated`/`valid`-as-trust is `false` for every bundle until v0.2 (fail-closed,
`packages/phub/src/trust/authentication.ts`); MCP `verify_before_load` is ADVISORY + `require_attestation`
default `false`; 5 MCP tools; 10 detectors (CCI-001…010).

**Fixed (exhaustive, per owner's scope decision):**
- LIVE-01 (critical) `docs/usage/08-verify-library.md` — the 30-line embed gated on `!result.valid`
  + "safe to consume", which is EXPLOITABLE (at `policy` level `valid` can be true on a forged,
  self-consistent bundle). Rewrote to gate on `result.authenticated` (always false in v0.1 → always
  throws, fail-closed) + added a labelled `inspectUntrustedBundle()` path.
- LIVE-03 `docs/usage/02-trust-contract.md` — added a version-stamped v0.1 capability matrix
  (implemented/enforced vs planned-v0.2); killed "refuses unless all four verify" prose; replaced the
  fabricated `phub verify` Sigstore-OK output with the honest fail-closed output; `paths:`→`files:`;
  MCP line → advisory.
- PH-11 homepage — `hero.tsx` ("every byte…before the agent reads it" → "inspect discovered
  artifacts…before you ship them to an agent"; fixed my own 10-07 "block-at-load in MCP" → advisory);
  `layout.tsx` meta ×3; `opengraph-image.tsx`; `threat-verified-section.tsx` CONTROLS (Sigstore/Rekor
  present-tense → v0.2); `cli-roadmap.tsx` (fabricated "Sigstore (Fulcio+Rekor) OK" → deferred/fail-closed;
  "On-access guard"→"File-change watch"; MCP "receives no bytes"→"advisory").
- LIVE-02 `07-mcp-server.md` — advisory callout + `require_attestation:false`; stale "4 tools"→5.
- LIVE-05 counts — `01-getting-started.md` (tools 4→5, detectors 3/3→10/10), `09-recipes.md`,
  `10-troubleshooting.md`; F1 qualifier on `hero.tsx` + `top-10/page.tsx` → "in-sample macro-F1"
  (keeps sourced 0.991, drops the all-10-adversarial implication).
- LIVE-06 `security/page.tsx` — `/status` reworded (planned, backend not live).
- `/registry` — Sigstore signing → planned-v0.2 + "registry not yet live" (flag-off anyway).
- `/validation` — LEFT: already DemoDataBadge + "Planned · live pipeline" + "when v1 ships".

**Gate:** `pnpm -C apps/web typecheck` clean; 12 routes 200 on :3100, no error markers.
**DEPLOYED to prod 2026-10-17** via `scripts/deploy.sh local --build` (owner-run): web image
rebuilt (docs staged in), prod stack healthy, `smoke-prod.sh` PASS on the live edge, api/worker
untouched. Content verified through Cloudflare (cf-cache-status DYNAMIC): hero "inspect…" live &
"every byte" gone; `/docs/trust-contract` capability matrix live & "all four" gone;
`/docs/verify-library` gates on `authenticated`. Commits `bd22b74` (polish) + `2f20f25` (truth).
Not pushed to origin yet.

**Cross-session flags raised:**
- → **phub-cli:** ~~their LIVE-01 corrected snippet still gates on `!result.valid` — STILL
  EXPLOITABLE~~ **RESOLVED 2026-10-17 (phub-cli):** aligned `packages/verify/README.md` +
  `scripts/public-repo/README.md` to gate on `result.authenticated` — all four teaching surfaces
  (our `docs/usage/08`, both READMEs) now teach one gate. They confirmed our `docs/usage/08` +
  `02-trust-contract` correct/clean. Their README changes ride the next verify release + public-repo
  sync to npm/public (doc-only, low urgency).
- → **phub-corpus-eval:** refresh the stale embedded eval artifact + pin canonical denominator (see Open items).
- → **phub-platform/strategy:** `/auth` route retirement (login stopped) — HELD, needs a deliberate pass.

## Session log — 2026-10-03 (audit-first polish sprint, previewed on :3100)
Deep-read hero, /check (page/form/verdict/showcase), /Forge (page/editor/side-panel/trust-panel),
trust-runtime. Shipped to **preview only** (prod unchanged until `scripts/deploy.sh`):

## Session log — 2026-10-03 (audit-first polish sprint, previewed on :3100)
Deep-read hero, /check (page/form/verdict/showcase), /Forge (page/editor/side-panel/trust-panel),
trust-runtime. Shipped to **preview only** (prod unchanged until `scripts/deploy.sh`):
- **P1** Forge "Agents" tab was static (hardcoded 6-agent const) while its copy claimed it
  reflected `compatible_agents` frontmatter — a live-DX + truthfulness defect. Now derived
  live from the parsed editor frontmatter (`fmAgents`), prettifies known slugs, shows a
  "none declared" hint, truthful copy. → `app/forge/page.tsx`, `components/forge/forge-side-panel.tsx`.
- **P2** `/check` seeded a dead `https://github.com/owner/repo` as the textarea *value* →
  a first-time visitor's first click scanned a nonexistent repo and errored. Now starts empty
  (rich placeholder + idle verdict panel). → `app/check/page.tsx`.
- **P3** hero subhead now names the three firewall motions (scan `/check` · author-safe
  `/Forge` · block-at-load CI/MCP/CLI). Headline + live-metrics pill + pillar strip unchanged.
  → `components/landing/hero.tsx`.
- **P5** hero `CheckShowcase` submits on ⌘/Ctrl+Enter (parity with the `/check` form).
  → `components/landing/check-showcase.tsx`.

Gate: `pnpm -C apps/web typecheck` clean; `/`, `/check`, `/forge` → 200 on :3100, no error markers.
Cross-scope: **none edited.** Engine/corpus/cli had pre-existing uncommitted work in their own
paths — left untouched. Deploy to prod + `scripts/smoke-prod.sh` is a separate, human-gated step.

## Resume prompt
```
Role: lead PM/eng for the phub-web bounded context of PrimitiveHub.
Read docs/sessions/SPINE.md, docs/sessions/memory/*, docs/sessions/phub-web.md first.
Scope: you own apps/web only. Engine/corpus changes → log in their ledger + flag, don't cross.
Constraints: pnpm · containerize · 127.0.0.1 only · no fake numbers · never delete HELD · no Claude attribution.
Task: <this sprint's goal>.
First action: restate current state from the ledger, then give me the plan + open-items priority
before touching code. Preview on a 2nd loopback port; show me before production. Update this ledger at close.
```

## Next cycle (ADR-0047) — 🟡 funnel

- **Task:** Reframe hero to 'Context Firewall'; polish public /check demo + /Forge live-as-you-type DX.
- **Gain:** Conversion — a top-of-funnel that routes users to the gate.
- Full plan + sequencing: `SPINE.md` → "Next cycle" table. Paste-prompt: `HOWTO.md`.
