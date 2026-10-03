# PrimitiveHub — Session Spine (ecosystem map)

> Read this first, then `memory/*`, then the session ledger you are resuming.
> Last updated: 2026-10-02 · Repo branch of record: `launch/noindex-lift-go-live`
>
> **🟢 LIVE — post-launch.** PrimitiveHub launched **2026-07-22** (noindex lifted, commit `8c71e7d`);
> primitivehub.ai serves publicly (HTTP 200, Cloudflare, indexable). We are in **continuous
> development of a live product**, NOT pre-launch. Consequences: `scripts/check-pre-launch-posture.sh`
> is EXPECTED to "FAIL" now (public DNS/proxy/noindex-off) — run it in inverse mode. The "human-only
> boundary flips" (repo-public, npm, DNS, noindex) are DONE. Pre-launch memory files
> (`feedback_localhost_only`, `project_launch_posture`) are historically stale — verify before trusting.
> Every change must keep the regression gate green (`bench/scripts/gate.sh`, fixed 2026-10-02).
>
> **State 2026-10-02:** all prior-session uncommitted work committed per-cluster, branch
> reconciled with origin (merge `cfa83cb`) and pushed; working tree clean; **real gate GREEN**
> (no regression, Py↔TS parity). Historical transcript archived (redacted) on local `session-archive`
> (not pushed). See [TRIAGE-2026-10-02.md](TRIAGE-2026-10-02.md) for the full log.

PrimitiveHub = CyberOrca Labs' **Context Firewall for AI agents** (ADR-0047):
**scan** (/check) · **author-safe** (/Forge) · **block-at-load** (the phub / MCP / CI
runtime gate). NOT a registry/marketplace — that surface is deferred (dormant, flag-off,
code HELD). Work is split into **6 bounded-context sessions**; one owns one context;
cross-scope changes are logged + flagged, never edited silently.

## Sessions

| ID | Owns (real paths) | Charter (ADR-0047 firewall) |
|---|---|---|
| [phub-check-engine](phub-check-engine.md) | `apps/api/checks`, rules `CCI-*`, trust score | **Detectors** — the Top-10 engine; the moat's substance |
| [phub-corpus-eval](phub-corpus-eval.md) | `bench/`, `apps/web/content/primitives`, `paper/` | **Benchmark** — labeled adversarial corpus + measured precision/recall |
| [phub-cli](phub-cli.md) | `packages/phub`, `packages/mcp-server`, `actions/phub-scan` | **Runtime gate** — `verify-before-load` as the inline firewall (CLI/MCP/CI) |
| [phub-web](phub-web.md) | `apps/web` | **Funnel** — /check demo + /Forge IDE; firewall messaging |
| [phub-platform](phub-platform.md) | `compose*.yaml`, `infra/`, CI, pnpm | **Infra** — keep CI green + lean; dormant surfaces stay flagged |
| [phub-strategy](phub-strategy.md) | `docs/decisions/*`, positioning, vision | **Strategy** — no-code; owns ADR-0047 + the telemetry-flywheel plan |

## Next cycle (ADR-0047 firewall wedge) — one tab per row

| Session (tab) | Status | Next-cycle task | Gain |
|---|---|---|---|
| **phub-corpus-eval** | 🔴 spearhead | Public, reproducible **adversarial benchmark**: grow labeled corpus, per-detector precision/recall, "what we catch vs others" | **Detection credibility** — earns the "firewall" claim; the proof brand-incumbents can't fake |
| **phub-cli** | 🔴 spearhead | **One-line runtime gate**: `verify-before-load` as MCP middleware + CI action + CLI, inline blocking, crisp DX | **Distribution + stickiness** — the actual firewall; bottom-up dev adoption (Snyk playbook) |
| **phub-check-engine** | 🟠 active | Close FP/FN gaps; add attack classes; **/check telemetry → threat-intel loop** | **Detection quality + compounding moat** — fewer FPs = trust; flywheel replaces lost community |
| **phub-web** | 🟡 funnel | Hero → "firewall"; polish /check demo + /Forge live-DX | **Conversion** — top-of-funnel that feeds the gate |
| **phub-platform** | 🟢 steady | Hold CI green/lean; dormant registry/storage code stays flagged | **Velocity** — low maintenance |
| **phub-strategy** | 🟢 steady | Brand reframe; design the telemetry-flywheel + pricing | **Direction** |

## Dependency graph

```
phub-platform (S5) ── underlies everything
        │
        ▼
phub-check-engine (S2) ──verdict──▶ phub-web (S1)
        ▲                               ▲
        │                               │
phub-cli (S3) wraps engine     phub-corpus-eval (S4) feeds rules + demo data
        │
phub-strategy (S6) sets scope/priority for all (no code)
```

## Cross-session rule
A change touching another session's paths: add a row to that session's ledger
"Open items" with `[from: <your-id>]`, and flag it in your sprint summary. Do not edit
the other context's files.

## Non-negotiable constraints (apply to every session)
pnpm only · containerize · bind 127.0.0.1 only · no fake numbers (DemoDataBadge) ·
never delete HELD code · paper/public numbers = measured truth · no Claude attribution
(ownership = PrimitiveHub AI / CyberOrca Labs).

## ADR index (decisions of record)
0040 surface/anti-bloat · 0041 verdict+scoring engine · 0042 multi-session isolation ·
0043 external-skill consumption · 0044 async check pipeline · 0045 product-first launch ·
0046 self-hosted analytics · **0047 Context-Firewall scope (registry deferred) ← current north star**.
Full text: `../decisions/`.
