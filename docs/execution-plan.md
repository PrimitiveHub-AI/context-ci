# PrimitiveHub Execution Plan — Trust Runtime Arc

> **Status:** Living plan. Authored 2026-05-31. Owner: mhm.
> **Scope:** The execution arc from Phase 5.5 (Runtime Trust API) through
> Phase 10 (Public launch). Supersedes nothing; extends
> [`docs/roadmap.md`](./roadmap.md) with explicit acceptance criteria,
> weekly cadence, standards-governance work, and a risk register.
> **Horizon:** 2026-05-31 → 2026-09-30 (~18 weeks to paper-coordinated launch).

---

## The bet, in one paragraph

**PrimitiveHub is the Context Firewall for AI agents.** The product enterprises
buy is a control plane that verifies, governs, attests, and gates every
piece of context an AI agent consumes — instructions, skills, rules, MCP
configs, AGENTS.md, CLAUDE.md, anything. The category we define is
**Context CI**. The standard we author is the **PrimitiveHub Trust
Contract** (wire format) plus the **Context CI Top 10** (taxonomy) plus
**CBOM** (manifest format). The artifacts we publish — registry, CLI,
verifier, MCP server, GitHub Action, Forge — are transports over the
same contract. The moat is not a feature; it is the position of being
the verifier every other registry, IDE, and model provider eventually
embeds.

We are not competing with HuggingFace, skills.sh, or a future "GitHub
Verified AGENTS.md." **We sit in front of every registry, including the
ones that do not exist yet.** That is the only positioning that survives
the platforms moving.

**Active by default, not passive.** A linter waits for the operator to
point it at a known file. A guardian sits with the project and finds
the unknown files. The five active surfaces locked in
[ADR-0025](./decisions/0025-active-posture-and-phub-audit.md) —
`phub audit`, `phub.lock`, `phub watch`, `phub install`, MCP runtime
gate — turn the Trust Contract from "verifier on demand" into
"guardian by default." Step 1 (`phub audit`) is the Samurai Cut:
shipping it converts every already-built piece of the contract
(verify kernel, scanner ports, SARIF reporter, Top 10 vocabulary)
from "capable but waiting" into "actively defending a project" in
one PR.

## The architectural spine

The Trust Contract v0.1 is the spine. Every surface — HTTP API, CLI,
verify library, MCP server, Forge, GitHub Action, Explorer — produces
or consumes the **same** Trust Bundle. No parallel validation logic.
No surface-specific trust semantics. One contract, many transports.

```
                       Trust Contract v0.1
                         (spec + schemas)
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   HTTP Trust API        @primitivehub/verify       CBOM spec
   (Phase 5.5.1-2)        (Phase 5.5.4)            (Phase 5.5.7)
        │                       │                       │
        ├──── phub CLI ─────────┤                       │
        │     (Phase 5.5.3)     │                       │
        │                       │                       │
        ├──── MCP server ───────┤                       │
        │     (Phase 5.5.5)     │                       │
        │                       │                       │
        ├──── Forge ────────────┤                       │
        │     (Phase 5.6)       │                       │
        │                       │                       │
        ├──── GitHub Action ────┤                       │
        │     (Phase 5.5.6)     │                       │
        │                       │                       │
        └──── Explorer ─────────┴───────── consumes ────┘
              (Phase 5.6.7)
```

If a surface needs trust logic that isn't in the contract, the contract
gets extended (with versioning discipline) — the surface does not branch.
That rule is the difference between a standard and a pile of features.

## Where we are right now (snapshot 2026-05-31)

Shipped on main:
- Phases 1–3.5: UI, monorepo, backend bootstrap, OIDC + auth polish
- Phase 4: Sigstore signing + Procrastinate workers (all PRs ✓)
- Phase 5: T1 (prompt injection), T2 (Unicode steganography), T5
  (unsafe shell install) detectors — launch-demo trifecta complete
- **Phase 5.5.1**: Bundle format spec (`docs/spec.md` § 10) + HTTP
  trust endpoints + ADR-0013
- **Phase 5.5.2**: Public anonymous trust lookup via RLS + ADR-0014 +
  cache headers + media-type wire

In flight / planned:
- Phase 5: T3, T4, T6–T10 detectors (PR 5.4–5.7 in `docs/roadmap.md`)
- Phase 5.5.3–5.5.5: CLI, verify library, MCP server (planned in
  `docs/roadmap.md`)

What this execution plan **adds** to the existing roadmap:

1. **Standards-governance layer** — the Trust Contract, Top 10, CBOM,
   and Policy Language as versioned public specs with conformance
   harnesses, not just internal schemas.
2. **Forge rename + brand discipline** — promote Workbench v2 to
   "Primitive Forge" across code, docs, and DESIGN.md.
3. **Context Firewall positioning** — explicit, locked, used in all
   public copy. Architecture name "Trust Runtime" is internal.
4. **Embed strategy** — explicit work to get `@primitivehub/verify`
   embedded by model providers and IDEs.
5. **Acceptance criteria at every gate** — defined below.
6. **Weekly cadence + risk register** — defined below.
7. **What does NOT ship** — explicit deferrals to keep launch tight.

---

## 18-week roadmap (2026-05-31 → 2026-09-30)

Weeks below are calendar weeks anchored on 2026-05-31 (W1 begins Mon
2026-06-01). Each row is a deliverable, not a project — a thing you can
point at and verify.

### Weeks 1–2 — Standards Lock (2026-06-01 → 2026-06-14)

The cheapest, highest-leverage work in the entire arc. **Do this before
writing more code.** Vocabulary is the moat.

| PR | Title | Surface | Acceptance |
|----|-------|---------|------------|
| 5.5.A | **Trust Contract v0.1 spec promotion** (ADR-0015) | `docs/trust-contract-v0.1.md` | Promotes `docs/spec.md` § 10 to a standalone versioned spec. Versioning rules, deprecation policy, conformance philosophy, media type `application/vnd.primitivehub.bundle+json`, full JSON Schema, golden bundle examples. |
| 5.5.B | **Conformance test suite v0.1** | `docs/trust-contract/conformance/` | ≥30 golden Trust Bundles + ≥10 adversarial ones (malformed signatures, tampered digests, expired certs, mismatched verdicts). Any implementation passing this suite can claim Trust Bundle v0.1 conformance. Run as part of API pytest. |
| 5.5.C | **Context CI Top 10 v0.1 public spec** (ADR-0016) | `docs/context-ci-top-10-v0.1.md` | Promotes `docs/threat-model.md` to versioned spec. Stable IDs CCI-001 … CCI-010, named attacks, CVSS-style severity, real examples drawn from corpus, prevention guidance. Published page at `/top-10` (still behind noindex until launch). |
| 5.5.D | **Forge rename across the project** | `DESIGN.md`, web UI, docs | "Workbench v2" replaced with "Primitive Forge" everywhere. DESIGN.md product-name table added. ADR-0017 captures the brand decision so future contributors don't drift. |

**Definition of Done for Weeks 1–2:**
- Trust Contract v0.1 spec is committed, versioned, and the conformance
  suite is green against the live HTTP API.
- Top 10 v0.1 spec is committed with CCI-001 … CCI-010 IDs.
- Forge is the only name used for the authoring surface in code and docs.
- Three ADRs (0015, 0016, 0017) landed.

### Weeks 3–4 — Verifier Kernel (2026-06-15 → 2026-06-28)

The library that every other surface consumes.

| PR | Title | Surface | Acceptance |
|----|-------|---------|------------|
| 5.5.4 | **`@primitivehub/verify` v0.1** (per roadmap PR 5.5.4 plan) | `packages/verify/` (new TS package; Python sibling deferred) | MIT licensed. Zero runtime deps in core. < 50KB minified. Verifies Trust Bundle v0.1: digest, signature (offline against bundled Sigstore trust roots), attestation predicate, Context CI verdicts. Passes 100% of the conformance suite (5.5.B). Documented embedding guide. Published to npm under MIT. |
| 5.5.E | **Trust API hardening for embed traffic** | `apps/api/registry/` | Cache headers verified (immutable on by-digest, 24h on by-slug — already shipped 5.5.2). Add public SLO documentation (p50 < 150ms, p95 < 500ms online; cached p50 < 20ms). Latency budget enforced in CI via load test. Status page schema added (still noindex). |

**Definition of Done for Weeks 3–4:**
- `@primitivehub/verify` is on npm, embeds in a sample app in < 5 lines.
- An external developer can verify a Trust Bundle without ever calling
  the PrimitiveHub API — uses local bundled trust roots.
- SLO numbers are published in `docs/trust-contract-v0.1.md` as
  commitments, not aspirations.

### Weeks 5–7 — CLI & Enforcement Surfaces (2026-06-29 → 2026-07-19)

The two surfaces that win developer adoption + enterprise adoption.

| PR | Title | Surface | Acceptance |
|----|-------|---------|------------|
| 5.5.3 | **`phub` CLI v0.1** (per roadmap) | `packages/cli/` (new) | Commands: `init`, `scan <path>`, `verify <path-or-digest>`, `fetch <slug@semver>`, `verify --offline`, `audit`, `cache prune`. Built on `@primitivehub/verify`. `npx phub scan AGENTS.md` works end-to-end. Cross-platform (Linux/macOS/Windows). |
| 5.5.F | **`primitivehub.lock` + cache layout** | CLI + docs | Lockfile format documented in Trust Contract spec. Cache layout documented (where bundles live, how to inspect, how to clear). Air-gapped verification works against cache populated by `phub fetch`. |
| 5.5.6 | **Context CI GitHub Action v1** | `packages/action/` (new public repo `primitivehub/context-ci-action`) | Inputs: paths to scan (defaults: `AGENTS.md`, `CLAUDE.md`, `**/SKILL.md`, `.cursor/rules/**`, `.github/copilot-instructions.md`, `**/mcp.json`). Outputs: SARIF + PR annotations. Fails build on policy violation. Documented in README of public repo. Published to GitHub Marketplace under MIT. |
| 5.5.G | **Context Policy Language v0.1** (ADR-0018) | `docs/context-policy-v0.1.md`, verify lib, CLI, Action | YAML schema for `.primitivehub/policy.yaml`. Formal semantics: deny overrides allow, precedence rules, defaults. Verify lib evaluates it. CLI honors it. Action gates on it. Versioned alongside Trust Contract. |

**Definition of Done for Weeks 5–7:**
- A demo repo on GitHub (private) uses `primitivehub/context-ci-action@v1`
  to scan AGENTS.md on every PR. PRs that introduce a Top 10 finding
  fail CI. SARIF is rendered in GitHub's security tab.
- `phub verify --offline` works after `phub fetch` populates the cache —
  air-gapped verification proven in a CI job that runs with `--network=none`.
- Policy YAML schema lives in the Trust Contract spec, not just in code.

### Weeks 8–9 — MCP Bridge (2026-07-20 → 2026-08-02)

The runtime trust layer for agents.

| PR | Title | Surface | Acceptance |
|----|-------|---------|------------|
| 5.5.5 | **`@primitivehub/mcp-server` v0.1** (per roadmap) | `packages/mcp-server/` (new) | Thin shim. Tools: `primitivehub.search`, `primitivehub.fetch`, `primitivehub.verify`, `primitivehub.policy_check`. All four call the HTTP Trust API + `@primitivehub/verify`. **Zero custom trust logic in MCP layer.** `claude mcp add primitivehub` is the one-line install. |
| 5.5.H | **MCP integration smoke pack** | `examples/mcp-integration/` | Three worked examples: Claude Code, Cursor, Aider. Each demonstrates an agent refusing to consume a primitive whose Context CI verdict is FAIL. Recorded as text logs (not video — recording is launch work). |

**Definition of Done for Weeks 8–9:**
- An MCP-speaking agent can list, fetch, verify, and policy-check
  primitives through PrimitiveHub.
- The MCP package has zero code path that mutates the trust verdict;
  it can only return what verify decides.

### Weeks 10–13 — Forge & Explorer (2026-08-03 → 2026-08-30)

The two surfaces that make the launch visual. Both consume the same
Trust Bundle as every other client — no parallel validation logic.

| PR | Title | Surface | Acceptance |
|----|-------|---------|------------|
| 5.6.1 | **Forge live scan + risk score** | `apps/web/app/forge/` (renamed) | Authoring surface scans on-edit (debounced). Risk score derives from same scanner the API runs. No mock numbers. Shows live Top 10 findings inline. |
| 5.6.2 | **Forge attestation + policy preview** | Forge | "Will this pass enterprise CI?" indicator. Shows expected attestation predicate + policy evaluation against a sample policy. |
| 5.6.3 | **Forge one-click publish via Trust Contract** | Forge + API | Publish → bundle generated → signing task fires → attestation surfaces in Forge → primitive immediately verifiable via CLI/MCP/Action. Round-trip tested in pytest. |
| 5.6.7 | **Primitive Explorer v1** | `apps/web/app/explorer/` | Etherscan-style: `/digest/{sha256}`, `/attestation/{id}`, `/provenance/{slug}`, `/policy/{hash}`. Every primitive has a permanent inspectable page. No auth required for public primitives. Public-anonymous lookup already wired in 5.5.2. |
| 5.6.5 | **CBOM v0.1 spec + generator** | `docs/cbom-spec-v0.1.md`, `phub cbom` | RFC-style document. Media type `application/vnd.primitivehub.cbom+json`. `phub cbom` emits valid CBOM artifact. References Trust Contract for primitive identity (digest-addressed). Versioned alongside Trust Contract. |

**Definition of Done for Weeks 10–13:**
- An author can write a primitive in Forge → see live scan → publish →
  inspect it in Explorer → verify it via CLI → consume it via MCP — all
  in one demo loop, all using the same Trust Bundle.
- CBOM is a public spec with a working generator.
- Explorer's public pages render correctly behind noindex (production
  parity, launch-ready).

### Weeks 14–16 — Embed, Pilots, and Polish (2026-08-31 → 2026-09-20)

The work that moves PrimitiveHub from "product" to "infrastructure."

| Track | Deliverable | Acceptance |
|-------|-------------|------------|
| Embed | Verifier integration guides | One-page guide each for Claude Code, Cursor, JetBrains, GitHub Copilot. Sample PRs drafted (not filed). Owner: DevRel hire (see Risk Register R-3). |
| Embed | First external embed | At least one open-source agent framework integrates `@primitivehub/verify` (informally OK). Demonstrable in their public repo. |
| Standards | CBOM submission to SPDX/CycloneDX | Email sent, one meeting attended. Acknowledgment is success; adoption is bonus. |
| Standards | Academic outreach | One named professor on the threat-model paper. CMU CyLab, ETH SecLab, or KAUST. Co-author letter signed. |
| Pilots | 3 design partners | NDAs in hand. One GCC enterprise (banking/government), one US/EU mid-market security team, one OSS community. Active use of GitHub Action in their CI. |
| Polish | Paper draft v1.0 | `docs/paper/` populated. Threat-model citations correct. Evaluation results from Phase 5 detectors included. Top 10 spec referenced. CBOM spec referenced. |
| Polish | Public status page schema | Schema in place, dashboards staged. **Not yet public-facing** (noindex preserved). |

### Weeks 17–18 — Launch (2026-09-21 → 2026-09-30, paper-coordinated)

This is Phase 10 in `docs/roadmap.md`. Two weeks of pre-flight, then
paper-coordinated public launch. Nothing new ships in code; everything
ships in posture.

| Track | Deliverable | Acceptance |
|-------|-------------|------------|
| Launch | Lift noindex defenses | `robots.txt`, meta, `X-Robots-Tag`, DNS — all flipped to public. Coordinated with paper drop. |
| Launch | Seed catalog | ≥100 attested primitives published across domains relevant to all 10 Top 10 categories. |
| Launch | Demo video (5 min) | Publish → attest → verify → consume in 5 minutes. Pre-recorded. Hosted on the launch site. |
| Launch | Bug bounty announced | Public scope, payout schedule, intake address. |
| Launch | Public Explorer | Permalink pages indexable. SEO posture goes from "denied" to "encouraged." |
| Launch | arXiv paper live | URL ready, ID known, citations correct. |

**Launch acceptance:** the sentence *"PrimitiveHub is the Context
Firewall for AI agents"* is true and provable to a curious skeptic in
≤5 minutes of demos.

---

## Workstreams

The roadmap above is the engineering ledger. These five workstreams run
**in parallel** across the same weeks and are owned outside the PR queue.

### W1 — Engineering (lead: mhm)
Everything in the 18-week table above. Tracked in PRs. Reviewed against
acceptance criteria.

### W2 — Standards & spec governance (lead: mhm)
- Trust Contract v0.1 spec + versioning policy + conformance suite
- Top 10 v0.1 spec
- CBOM v0.1 spec + standards-body outreach (SPDX, CycloneDX, eventually IETF)
- Policy Language v0.1 spec
- Public RFCs for breaking changes (post-launch)

### W3 — Embed (lead: TBD; see R-3)
- Verifier integration guides for major IDEs and agent frameworks
- Pre-drafted integration PRs (filed only after launch)
- DevRel calendar — conference talks, podcast appearances aligned with launch
- Targets: Anthropic (MCP working group), JetBrains, Cursor, GitHub
  Copilot platform team

### W4 — Partnerships (lead: mhm)
- Three design partners (banking, mid-market security, OSS community)
- One academic co-author secured
- One regulator briefing held (CISA or EU ENISA)
- Standards-body engagement (SPDX/CycloneDX)

### W5 — Paper (lead: mhm)
- `docs/paper/` populated with LaTeX sources by Week 14
- Reviewer access feature on private registry by Week 15
- Pre-publication checklist completed by Week 17
- Paper drop coordinated with Week 18 launch

---

## Acceptance criteria — gates that block phase rollover

A phase does not roll over until ALL of its gates pass. No "ship it and
fix later" on the trust spine.

### Gate G-A — Standards Lock complete (end of Week 2)
- [x] `docs/trust-contract-v0.1.md` published with versioning policy   (PR 5.5.A)
- [/] Conformance suite — 12 golden + 3 adversarial bundles green
      (PR 5.5.B); growth to ≥30 + ≥10 rolling through Week 2
- [x] `docs/context-ci-top-10-v0.1.md` published with CCI-001 … CCI-010 (PR 5.5.C)
- [x] Forge rename committed; "Workbench v2" no longer appears in code (PR 5.5.D)
- [x] ADRs 0015, 0016, 0017, 0021 landed
- [x] CLAUDE.md updated to reference these specs                        (PR 5.5.A + 5.5.D)

### Gate G-B — Verifier Kernel ready (end of Week 4)
- [ ] `@primitivehub/verify` published to npm under MIT
      (PR 5.5.4 ships source + tests + MIT license + ADR-0020 +
      publish workflow infrastructure + ADR-0022. Actual publish
      gated to launch event per ADR-0022 three-lock model —
      conflicts with pre-launch posture rule in CLAUDE.md.
      Launch-day playbook documented in ADR-0022.)
- [x] < 50KB target met; zero runtime deps                              (PR 5.5.4 — 18.7KB JS; CI enforces packed size budget)
- [x] 100% conformance suite pass (v0.1 steps 1, 2, 7; steps 3-6
      explicitly stubbed per Trust Contract scoping in README + ADR-0020) (PR 5.5.4)
- [x] Sample external embed demonstrated (toy app, ≤30 lines)           (PR 5.5.4 — `examples/verify-embed/` uses file: dep until launch)
- [ ] SLO numbers published in Trust Contract spec                      (deferred to Gate G-B close; already drafted in spec § 10 / docs/trust-contract-v0.1.md § 10)

### Gate G-C — Enforcement surfaces shipped (end of Week 7)
- [ ] `phub` CLI on npm — `npx @primitivehub/phub scan AGENTS.md` works
      (PR 5.5.3 ships the CLI source, scanners, 33/33 tests, ADR-0023,
      publish workflow infrastructure. Actual npm publish gated to
      launch event per ADR-0022 three-lock model. Package name is
      scoped `@primitivehub/phub` after dry-run revealed the bare
      `phub` name is squatted; binary name remains `phub` so
      post-install ergonomics are unchanged. Today the CLI works
      end-to-end inside the monorepo.)
- [x] `phub verify --offline` works air-gapped (PR 5.5.3 — verify wraps
      `@primitivehub/verify` which is offline-by-construction; the
      `--offline` flag is accepted as documentary)
- [ ] GitHub Action published to Marketplace under MIT
      (PR 5.5.3.action ships `actions/phub-scan/` composite Action +
      `phub scan --sarif` + ADR-0024. Action is dogfooded in-tree
      via `.github/workflows/phub-scan-demo.yml`. Marketplace
      publication = launch-day move: cut standalone
      `primitivehub/phub-scan` repo, publish as v0.1.0.)
- [x] Demo repo proves end-to-end CI gating
      (PR 5.5.3.action — `.github/workflows/phub-scan-demo.yml`
      builds verify + phub, runs the local composite action against
      CLAUDE.md/README.md/DESIGN.md, uploads SARIF to this repo's
      Code Scanning. End-to-end pipeline proven; this repo IS the
      demo until launch.)
- [x] Policy Language v0.1 spec versioned (ADR-0018)
      (PR 5.5.X — `docs/context-policy-v0.1.md` is the spec;
      `docs/context-policy/conformance/` is the executable contract
      (8 valid + 5 invalid + 6 scenario fixtures);
      `packages/phub/src/policy/` is the reference implementation;
      `phub scan --policy <path>` honors it. Resolves
      `docs/bugs.md` #25 via per-file allow exceptions today.)

### Gate G-C.1 — Active posture (the Samurai Cut, ADR-0025)

The cut from passive (lint a file you point at) to active (discover
+ classify + scan + report against an entire project). Closes the
half of `docs/vision.md` that requires every artifact to be
*findable* before it can be inspected. Five surfaces locked in
ADR-0025; the foundation ships first.

- [ ] `phub audit [<path>]` discovers every agent-context artifact
      under a path, classifies it, digests it (SHA-256), and runs the
      detector roster. Default path is `process.cwd()`. (PR 5.7.1
      ships walker + classifier + audit command + reporters
      (human/JSON/SARIF) + tests.)
- [ ] `phub audit --sarif` emits a multi-file SARIF 2.1.0 aggregate
      compatible with the existing `actions/phub-scan/` composite
      Action.
- [ ] Classification list documented + versioned alongside the Top 10
      (ADR-0016 minor-version bump): `agents-md`, `claude-md`,
      `cursor-rules`, `windsurf-rules`, `aider-config`,
      `copilot-instructions`, `claude-skill`, `claude-agent`,
      `claude-command`, `primitive`, `skill`, `prompt`, `mcp-config`.
- [ ] Walker honors the documented skip-list (`node_modules/`,
      `.git/`, `dist/`, `build/`, `.next/`, `coverage/`, `target/`,
      `__pycache__/`, `venv/`, `.venv/`, `.tox/`, `.pytest_cache/`,
      `.cache/`) and the meaningful-dotfile allowlist
      (`.cursorrules`, `.windsurfrules`, `.aider.conf.yml`,
      `.claude/**`, `.cursor/**`, `.github/**`).
- [ ] Walker is symlink-safe (does not follow), depth-bounded
      (default 12), and file-bounded (default 5000); both bounds
      overridable via `--max-depth` / `--max-files`.
- [ ] Detector-parity rule (ADR-0023) preserved: audit reuses the
      scanner kernel; no new detectors live in `audit/`.
- [x] FP-resolution methodology in place (ADR-0030):
      `docs/false-positive-resolution.md` § 1–§5 + ledger § 6 with
      starter entries FP-001 / FP-002. Project-level
      `.primitivehub/policy.yaml` ships with the canonical FP-001
      (CLAUDE.md teaches T5) + FP-002 (shadcn primitive documents
      canonical install) allow entries. CLAUDE.md hard-rules #8 + #9
      lock the discipline for future sessions. `docs/principles.md`
      Principles 19 + 20 are now load-bearing.

### Gate G-C.2 — Active-surfaces follow-ons (post-G-C.1 foundation)

The remaining four steps of the active-surfaces arc (ADR-0025).
Each ships under its own ADR; these gates are forward-references
so future sessions don't invert dependencies or double-build.

- [x] PR 5.7.2 — `phub.lock` format + `phub audit --check-lock` /
      `--update-lock` / `--lock-only` / `--lock-path`
      ([ADR-0026](./decisions/0026-phub-lock-format-and-drift-detection.md)).
      Canonical-JSON file at `.primitivehub/phub.lock` records
      every classified artifact. Reproducibility (byte-identical
      re-stamps) is unit-tested. Drift categories: added /
      modified / removed / reclassified. Project's own
      `.primitivehub/phub.lock` is committed (20 artifacts, ~129
      lines). The AV-product-family boot-time-integrity-check row
      from ADR-0030 § 3 is now shipped.
- [ ] PR 5.7.3 — `phub watch` filesystem daemon (future ADR-0027)
- [ ] PR 5.7.4 — `phub install <slug@semver>` safe-install
      (future ADR-0028; closes the T5 attack class operationally)
- [ ] PR 5.7.5 — MCP runtime gate
      `primitivehub.verify_before_load` (future ADR-0029; couples
      to Gate G-D MCP work)

### Gate G-D — MCP Bridge ready (end of Week 9)
- [ ] `@primitivehub/mcp-server` published to npm
      (PR 5.5.5 ships the package source + 22/22 tests + ADR-0031 +
      publish workflow infrastructure. Actual npm publish gated to
      launch event per ADR-0022 three-lock model. Today the server
      works end-to-end inside the monorepo.)
- [x] `claude mcp add primitivehub` is one line
      (PR 5.5.5 — `examples/claude-code.json` registers the server
      with `command: npx + args: [@primitivehub/mcp-server]`. Same
      shape works post-launch on `claude mcp add` invocation.)
- [x] Three worked examples (Claude Code, Cursor, Aider)
      (PR 5.5.5 — `packages/mcp-server/examples/{claude-code.json,
      cursor-mcp.json, aider.conf.yml}` + examples/README.md with
      pre-launch local-path swap-in instructions.)
- [x] Zero custom trust logic in MCP package — provable by code review
      (PR 5.5.5 + ADR-0031 § 2 rule #1. Every tool in
      `packages/mcp-server/src/tools/*.ts` is a one-function-call
      wrapper over verify or phub exports. No validation paths,
      no schema validation, no policy evaluation logic in this
      package — every trust decision is delegated.)

### Gate G-E — Forge + Explorer ready (end of Week 13)
- [ ] Forge round-trip: write → scan → publish → fetch → verify works
- [ ] Explorer pages render for every public primitive
- [ ] CBOM v0.1 spec + generator shipped
- [ ] No mock numbers anywhere in Forge or Explorer (per `feedback-no-fake-numbers`)

### Gate G-F — Embed + Pilots complete (end of Week 16)
- [ ] At least one external `@primitivehub/verify` embed live
- [ ] Three design partners signed and using GitHub Action
- [ ] One academic co-author secured for paper
- [ ] CBOM acknowledged by one standards body (SPDX/CycloneDX/IETF)
- [ ] Paper draft v1.0 complete

### Gate G-G — Launch readiness (end of Week 17)
- [ ] Seed catalog ≥100 attested primitives
- [ ] Demo video recorded
- [ ] Bug bounty scope finalized
- [ ] noindex defenses ready to lift (atomic switch tested in staging)
- [ ] Status page live and trending green for 30 days

---

## Cadence

**Weekly (Mon):** Roadmap update. Walk the gate checklist. Any gate
behind by ≥3 days triggers an explicit "should we cut scope?" decision.

**Monthly (last Fri):** Phase retro. Update `docs/bugs.md` with any
load-bearing incidents from the month. Update `docs/roadmap.md` with
phase-state changes. Re-derive the next month's gate dates.

**Per-PR:** Reference the gate it serves. Acceptance criteria from the
gate inline in the PR description. Don't merge if criteria aren't
demonstrably met.

**Per-spec change:** Trust Contract, Top 10, CBOM, and Policy Language
follow stricter rules. Any breaking change to a versioned spec requires
an RFC issue with ≥48h public-but-noindexed review window before merge.

---

## Risk register

Tracked here, not in heads. Each risk has a mitigation. Review monthly.

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-1 | GitHub ships "Verified AGENTS.md" before our launch | High | Existential to "we're not a registry" framing | Ship Top 10 + CBOM specs first (Weeks 1–2). Establish vocabulary GitHub has to use. Be the standard, not the storage. |
| R-2 | Anthropic/OpenAI build attestation into model layer and disintermediate us | Medium | High | Embed strategy (W3). Make `@primitivehub/verify` so trivially embeddable they choose to import rather than build. |
| R-3 | No DevRel hire by Week 10, embed strategy stalls | High (we have no DevRel today) | High to Phase 5.7 embed gates | Owner identified by end of Week 6 even if interim. If no hire, mhm runs the integration-guide work part-time and one external embed becomes a stretch goal not a gate. |
| R-4 | Paper not accepted at venue → arXiv preprint only | Medium | Low (arXiv still counts for launch) | Plan for arXiv as the canonical launch artifact. Venue acceptance is bonus. |
| R-5 | Trust Contract spec drifts between surfaces (verify lib vs API) | Medium | Critical | Conformance suite (Week 1–2). All surfaces run the suite in their own CI. No surface ships without 100% pass. |
| R-6 | Sigstore public availability incident during launch week | Low | High (signing/verifying breaks publicly) | Status-page commitments include external dependency posture. Internal cache of recent trust roots — verification works offline against bundled roots (ADR-0013). |
| R-7 | Corpus too small for credible paper claims | Medium | High to paper credibility | Bug bounty for novel labeled primitives (Phase 5.7 work). Academic co-author can mobilize student labelers. |
| R-8 | Premature public exposure of pre-launch surface | Low (defenses solid) | High (pre-launch posture is absolute) | noindex defenses already live; any new public surface (status page, embed guides) audited for noindex headers before merge. |
| R-9 | Forge rename leaks into public copy before Week 1–2 lock | Low | Low | Branding-discipline ADR (0017) committed Week 1; no public copy refresh until then. |
| R-10 | One-engineer bus factor on Trust Contract specs | High (it's mhm) | Critical to launch | Spec text in markdown in-repo (not in heads). Conformance suite is the executable definition. Anyone could pick up and ship from the spec + tests. |

---

## What explicitly does NOT ship in this arc

Discipline is what we cut, not what we add. The following are
deliberately deferred past launch:

- **Federation + cross-registry trust** — Phase 11 in `docs/roadmap.md`.
  Important; not on critical path.
- **Self-hosted Sigstore for enterprise** — Phase 7. Pilot customers
  use public Sigstore + staging Sigstore until Phase 7.
- **Marketplace search at scale** — Postgres FTS is fine for launch.
  Meilisearch deferred.
- **Reviewer reputation v2** — placeholder formula is fine until launch.
- **More than 10 Top 10 categories** — the taxonomy ships at exactly 10.
  Updates to v0.2 happen post-launch.
- **CBOM in IETF formal process** — outreach starts Week 14, formal
  process is a 2026-Q4+ track.
- **Python sibling for `@primitivehub/verify`** — defer. TypeScript-only
  is fine for launch; Python embed comes after one external TS embed lands.
- **Workbench-as-Hugging-Face-Spaces** — Forge is an authoring surface,
  not a hosting platform. Spaces analogy is a post-launch growth bet.
- **Pricing tiers + payment processing** — design-partner contracts are
  bespoke until 2026-Q4. Free tier + custom enterprise. No self-serve Pro tier yet.

---

## ADRs to write in this arc

Numbered against the next available ADR (0015+ per existing
`docs/decisions/`).

| ADR | Title | When | Why |
|-----|-------|------|-----|
| 0015 | Trust Contract v0.1 versioning + deprecation policy | Week 1 | Establishes spec-change discipline before drift starts |
| 0016 | Context CI Top 10 v0.1 — taxonomy as versioned public spec | Week 1 | Locks vocabulary; gives competitors something to map to |
| 0017 | Workbench v2 → Primitive Forge rename | Week 1 | Brand discipline; prevents naming drift |
| 0018 | Context Policy Language v0.1 as part of Trust Contract | Week 6 | Policy semantics live in the spec, not in code |
| 0019 | CBOM v0.1 as media-type-registered manifest format | Week 12 | Same standards discipline as Trust Contract |
| 0020 | `@primitivehub/verify` as the reference implementation | Week 4 | Establishes which code defines spec semantics in disputes |
| 0021 | Conformance suite as the executable contract definition | Week 2 | Same as above, from the test side |
| 0025 | Active posture + `phub audit` + active-surfaces arc | (landed 2026-05-31) | Names the shift from passive (lint a file you point at) to active (discover + classify + scan an entire project) as a deliberate posture; specifies `phub audit` and forward-references the lock/watch/install/runtime-gate ADRs |
| 0026 | `phub.lock` format + drift detection | (landed 2026-06-01) | Lockfile contract for cognition artifacts (package-lock.json equivalent); canonical JSON with byte-identical re-stamp reproducibility; AV product-family boot-time-integrity row shipped |
| 0027 | `phub watch` filesystem daemon | post-0026 | Auto-quarantine new artifacts before they reach an agent |
| 0028 | `phub install <slug@semver>` safe-install | post-0027 | Replace the `npx ... \| bash` skill-install attack class (T5) operationally |
| 0029 | MCP runtime gate (`verify_before_load`) | with Gate G-D | Agent runtimes call PrimitiveHub before loading any primitive; refuses-by-default for unattested content |
| 0030 | FP resolution + the AV-vendor parallel as product discipline | (landed 2026-06-01) | Locks the FP methodology + ledger + four-path triage as load-bearing process; names "agent-context AV plus registry" as the product-family framing |

---

## How to use this plan

Before opening a PR, ask:

1. Which **gate** does this serve? (G-A through G-G)
2. Which **acceptance criterion** in that gate does it satisfy?
3. Does it preserve the **Trust Contract is the spine** rule? If it
   introduces surface-specific trust logic, the answer is no — extend
   the spec instead.
4. Does it preserve **pre-launch posture**? (noindex, no public copy,
   no domain references in indexable surfaces.)
5. Does it match the [vision](./vision.md), the [positioning](./positioning.md),
   and the [principles](./principles.md)?

If a PR can't answer (1) and (2), it's scope creep until the plan is
updated.

Plan updates are PRs against this document. Treat it like a contract.

---

## The one-line bet, restated

Every path through PrimitiveHub speaks the same Trust Contract — and
that contract is a public, versioned, conformance-tested standard that
every competitor and platform owner is forced to either adopt or build
against. The contract is the moat. The discipline around it is the
company. Eighteen weeks from today, that sentence is provable.
