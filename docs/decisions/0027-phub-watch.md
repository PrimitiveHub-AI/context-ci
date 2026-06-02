# ADR-0027: `phub watch` — active runtime guardian

**Status:** Accepted
**Date:** 2026-06-02
**Related:** ADR-0023 (phub CLI + detector parity), ADR-0025 (active
posture + phub audit), ADR-0026 (phub.lock + drift), ADR-0030 (FP
resolution + AV-vendor parallel), `packages/phub/`

## Context

ADR-0025 named the active-surfaces arc: `phub audit` (point-in-time),
`phub.lock` (boot-time integrity, ADR-0026), `phub watch` (run-time),
`phub install` (safe-install, ADR-0028 planned), MCP runtime gate
(ADR-0029 planned). The first two shipped. This ADR locks the third.

The threat phub watch addresses is the **same** attacker the audit
command addresses — an artifact dropped into the working tree that
the operator hasn't yet noticed (a `.cursorrules` from a Twitter
copy-paste, a `.claude/skills/foo.md` from a contractor, a nested
`AGENTS.md` under `tools/`). Audit catches them at CI time; watch
catches them as they appear, before they reach the agent's read
window. The cost asymmetry of "agent loads an attack primitive
during a multi-hour task" justifies a daemon.

`phub.lock` provides the baseline the watcher diffs against. Without
a lock, watch can still scan + flag; with a lock, watch also detects
drift in real time.

## Decision

### 1. Ship `phub watch [dir]` as the third active surface

Two modes:

- **Daemon (default)** — perform an initial `runAudit` to establish
  state, then watch the tree for fs events. Each debounced event
  triggers a re-audit. Emit per-event NDJSON to stdout (with
  `--json`) or human-readable lines. Exit on SIGINT / SIGTERM.
- **`--once`** — perform the initial audit + emit + exit. Same shape
  as `phub audit` with the watch CLI surface, for tests and CI
  smoke-runs.

### 2. Zero parallel scanning / classification / policy logic

Per ADR-0023's detector-parity rule and ADR-0025's classifier rule,
`phub watch` MUST NOT reimplement what `phub audit` already does.
The watcher reuses:

- `audit/classifier.ts` for path → classification
- `audit/walker.ts` for tree traversal
- `audit/digest.ts` for content hashing
- `commands/audit.ts::runAudit` for the whole scan + policy pipeline

Watch's only new code is:

- `audit/watcher.ts` — a zero-dep `fs.watch` wrapper with
  per-path debouncing.
- `commands/watch.ts` — the daemon glue (event handler, ndjson
  emitter, signal handling, `--once` short-circuit).

Total new logic ≈ 250 lines. Behavior on artifact classification +
detection + policy is provably identical to `phub audit`.

### 3. Zero runtime deps

The watch surface uses Node's built-in `fs.watch({ recursive:
true })`. No chokidar, no node-watch, no inotify-tools. This is the
same discipline as the rest of phub:

- macOS — FSEvents via libuv.
- Windows — ReadDirectoryChangesW via libuv.
- Linux — libuv recursive watch (Node ≥ 20.6; older Node falls back
  to non-recursive watch with a `warning` event).

The platform-specific quirks chokidar handles (editor save-and-
replace producing N events; symlink loops; rate limits) are real
but small enough to handle locally:

- **Save-and-replace** — handled by the per-path debounce (default
  200ms). N rapid events on the same path coalesce into a single
  emit.
- **Symlink loops** — the audit walker already skips symlinks
  (ADR-0025's discipline preserved).
- **Rate limits** — bounded by `--max-files` + `--max-depth` on the
  re-audit (same caps as `phub audit`).

If chokidar's quirks become load-bearing in v0.2 (e.g. atomic-write
detection), the watcher module is small enough to swap in 50 lines.

### 4. NDJSON over stdout in daemon mode

The daemon emits one JSON object per line on stdout. Each line is
a complete `WatchEvent`:

```json
{"kind":"started","timestamp":"...","payload":{...}}
{"kind":"ready","timestamp":"...","payload":{"debounceMs":200,"quarantine":false}}
{"kind":"fs-event","timestamp":"...","payload":{"path":"...","rawKind":"change"}}
{"kind":"scanned","timestamp":"...","payload":{"flaggedCount":1,"totalFindings":1,"flagged":[...]}}
{"kind":"shutdown","timestamp":"...","payload":{"signal":"SIGINT","exitCode":1}}
```

Consumers can `tail -f | jq` the stream. SARIF is deliberately NOT
supported in daemon mode — SARIF is a single document and
"streaming SARIF" would require non-standard delimiting. `--once`
mode could support SARIF in v0.2 if there's demand.

### 5. Quarantine deferred to v0.2

A `--quarantine` flag is accepted in v0.1 but its semantics are
documentary only — the daemon emits a marker but does NOT move
files. v0.2 introduces real quarantine after a separate ADR locks
the file-move design:

- Where do moved files go? (`.phub/quarantine/` default; configurable.)
- How are they restored? (`phub quarantine restore <path>`.)
- What metadata is recorded? (Original path, original digest, why
  quarantined, when, by which detector.)
- What about renames during quarantine? (TBD — the v0.1 ADR doesn't
  commit.)

Moving files is destructive. Releasing real quarantine in v0.1
without that design lock-in would create the same allow-list rot
ADR-0030 warns against, but applied to moves: "I quarantined that
file three months ago — was it a real attack or did I forget?"

### 6. Exit code reflects the worst observed finding

Daemon mode's exit code on `SIGTERM` / `--max-runtime-sec` is:

- `0` — every scanned re-audit was clean.
- `1` — at least one re-audit returned a policy-rejected verdict at
  some point during the daemon's lifetime.
- `2` — usage error / unreadable root / invalid policy.

The exit code accumulates monotonically — a `1` once observed
cannot revert to `0` even if a later edit fixes the issue. The
daemon's run is treated as a "did anything dirty happen during this
window?" question, not a "is the tree currently clean?" question.

`--max-runtime-sec` is a test/CI helper. Production daemons usually
omit it and rely on SIGINT/SIGTERM.

## Alternatives considered

1. **Use `chokidar`** for the watcher backend. Rejected. Adds a
   real runtime dep + transitive deps; the platform quirks it
   handles are well-bounded by the debouncer + audit caps. Cost
   of the in-house wrapper is ~150 lines, audit surface near zero.

2. **Polling-based watcher** (re-walk every N seconds). Rejected.
   Wasteful on large trees; misses the urgency that justifies
   shipping watch in the first place (catch new artifacts before
   the agent reads them, not after a 30-second poll window).

3. **Daemon ships v0.1 quarantine.** Rejected. File-move destruction
   without a restore protocol is a new attack surface (operator
   error wipes work). Defer + document.

4. **Per-event scan instead of full re-audit.** Considered. v0.1
   chose full re-audit for simplicity + provability ("watch
   behavior = audit behavior on each event"). v0.2 may incrementally
   classify only the changed path + its affected lock entries. The
   bounds (`--max-files`, `--max-depth`) make full re-audit
   acceptable in v0.1.

5. **Drop `--once` mode (just use `phub audit`).** Considered.
   Keeping `--once` lets the CLI present a single ergonomic
   contract (`phub watch` with one flag vs. two different commands
   with similar output). Cost: 5 lines of code.

6. **SARIF in daemon mode via delimited stream.** Rejected for
   v0.1. SARIF tools expect a single document; emitting one per
   scan with a custom delimiter would require every consumer to
   know about the delimiter. NDJSON's "one event per line" is the
   standard streaming pattern.

## Consequences

### Positive

- **The active-surfaces arc has its third surface.** Audit (point-
  in-time) → lock (boot-time) → **watch (run-time)**. AV-product-
  family map's "on-access guard" row (ADR-0030 § 3) is shipped.
- **NDJSON makes integration trivial.** Any tool that can read a
  pipe can integrate (Datadog log shipper, Vector, in-house
  monitoring, a Slack notifier as a 30-line script).
- **Zero deps preserved.** phub's runtime-dep surface stays at
  `yaml` only.
- **`--once` is the smoke-test friendly entry point.** Tests +
  CI scripts that want "audit shape via watch CLI" get it.
- **Subprocess daemon is testable.** The vitest harness spawns the
  daemon, writes a file, observes the events. Bounded by
  `--max-runtime-sec`. No flakiness; runs in ~3 seconds.

### Negative

- **Old Linux nodes** (< 20.6) fall back to non-recursive watch.
  The user sees a `warning` event but no errors. v0.2 may detect
  the fallback and refuse to start without `--allow-degraded`.
- **Full re-audit per event** is more work than incremental
  classification. Bounded by audit caps; v0.2 candidate for
  incrementalization if it becomes a hotspot.
- **`--quarantine` accepted but inert.** A user who passes the flag
  expecting v0.2 semantics gets the v0.1 documentary marker
  instead. README + CHANGELOG + `phub help watch` document this
  explicitly to avoid surprise.
- **Daemon exit code is monotonic.** "It was dirty once" sticks for
  the rest of the run. Right for CI smoke (any flag = fail); may be
  surprising for long-running dev daemons (a fix doesn't restore
  exit 0). Documented in the help text.

### Neutral

- **The watcher module is general-purpose.** A future ADR could
  reuse `startWatcher` from other parts of phub (e.g. a Forge
  preview that hot-reloads). The interface is intentionally clean
  (root + debounceMs + onEvent + onError); the watcher doesn't know
  about classification or scanning.

## Implementation

`packages/phub/`:
- `src/audit/watcher.ts` — `startWatcher(root, opts) → Watcher`
  with `stop()` + `pending()`.
- `src/commands/watch.ts` — `watchCommand(rootArg, opts)` for CLI
  dispatch; `runDaemon(root, opts, auditOpts)` for the daemon loop.
- `src/cli.ts` — flag spec entries for `--once`, `--debounce`,
  `--quarantine`, `--max-runtime-sec`; `case "watch"` dispatch.
- `src/index.ts` — `watchCommand`, `WatchOptions`, `startWatcher`,
  `Watcher`, `WatcherEvent`, `WatcherOptions` exports.
- `test/watch.test.ts` — 8 cases:
  - `--once` clean tree → exit 0 + structured event
  - `--once` dirty tree → exit 1 + flagged in payload
  - human output shape
  - exit 2 on non-existent root
  - debouncer coalesces rapid same-path events
  - `stop()` clears pending timers
  - daemon subprocess: write file → scanned event → exit 1
  - daemon subprocess: --max-runtime-sec quiet exit 0
- 159 + 8 = 167 phub tests passing after this PR.

## What ships in subsequent PRs

- **ADR-0028 — `phub install <slug@semver>`** safe-install. Pulls
  from registry, verifies bundle, records the install under the
  lock's `attestation` field.
- **ADR-0029 — MCP runtime gate (`verify_before_load`)** combines
  `check_lock` + `verify_bundle` for agent-runtime refusal of
  unattested content.
- **Quarantine v0.2** — separate ADR for file-move semantics +
  restore protocol + metadata format.
- **Incremental watch** — v0.2 candidate; classify changed path
  only, update lock entry in place, skip the full re-audit.
- **SARIF in `--once` mode** — if there's demand; v0.1 supports
  `--json` only.
- **`phub quarantine list` + `restore`** — when real quarantine
  lands.

## References

- `packages/phub/src/audit/watcher.ts` — the watcher
- `packages/phub/src/commands/watch.ts` — the command
- `packages/phub/test/watch.test.ts` — the conformance
- ADR-0023 — phub CLI + detector parity
- ADR-0025 — active surfaces + phub audit (the arc this ADR closes a row of)
- ADR-0026 — phub.lock + drift detection (provides the baseline)
- ADR-0030 — FP resolution + AV-vendor parallel (on-access guard row of § 3)
- `docs/usage/02-phub-cli.md` § watch — user-facing reference
