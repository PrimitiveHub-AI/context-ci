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

PrimitiveHub = CyberOrca Labs' "GitHub Enterprise for AI Context Primitives".
Work is split into **6 bounded-context sessions**. One session owns one context; a
change needed outside your scope is logged here and flagged — never cross over silently.

## Sessions

| ID | Owns (real paths) | Charter (1 line) |
|---|---|---|
| [phub-web](phub-web.md) | `apps/web` | Category-creator marketing + product UI |
| [phub-check-engine](phub-check-engine.md) | `apps/api/checks`, rules `CCI-*`, trust score, verdict cache | The core `/check` verdict engine |
| [phub-cli](phub-cli.md) | `packages/phub`, `actions/phub-scan`, `.github/workflows/phub-*` | `phub` CLI + GitHub Action, `@primitivehub` publish |
| [phub-corpus-eval](phub-corpus-eval.md) | `apps/web/content/primitives`, `bench/`, `paper/` | Primitive corpus + measured-truth evaluation |
| [phub-platform](phub-platform.md) | `compose*.yaml`, `infra/`, `deploy/`, CI, pnpm workspace | Docker/nginx/deploy topology, preview workflow |
| [phub-strategy](phub-strategy.md) | `docs/positioning.md`, `docs/vision.md`, `docs/decisions/*` | Positioning, launch posture, reputation-layer call |

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
0046 self-hosted analytics. Full text: `../decisions/`.
