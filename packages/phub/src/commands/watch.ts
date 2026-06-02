/**
 * `phub watch` — active filesystem guardian.
 *
 * Per ADR-0027 the watcher's job is to react to filesystem events on
 * agent-context artifacts the same way `phub audit` reacts to a
 * point-in-time inventory. Same classifier, same detectors, same
 * policy, same lock comparison — different trigger (fs.watch event
 * vs. CLI invocation).
 *
 * Two modes:
 *   - `--once`            Run a single audit + emit + exit. Useful for
 *                         tests and CI dry-runs.
 *   - default (daemon)    Run the audit once, then watch for changes
 *                         and re-evaluate per change. Emits NDJSON
 *                         events on stdout. Exits on SIGINT / SIGTERM.
 *
 * Quarantine semantics are deferred to v0.2 (file moves are
 * destructive and need their own design). v0.1 emits events; the
 * operator wires the destructive action.
 */

import { existsSync, statSync } from "node:fs"
import { resolve } from "node:path"

import { type AuditResult, runAudit } from "./audit.js"
import { Severity } from "../scanners/types.js"
import { startWatcher, type Watcher } from "../audit/watcher.js"
import { type AuditOptions } from "./audit.js"
import { PolicyLoadError } from "../policy/types.js"

export interface WatchOptions {
  json: boolean
  once: boolean
  debounceMs: number
  strict: boolean
  detectors?: readonly string[]
  policyPath?: string
  allowFail?: readonly string[]
  maxFiles: number
  maxDepth: number
  /** Reserved for v0.2; v0.1 only emits a marker event. */
  quarantine: boolean
  /** Maximum daemon runtime in seconds. Default Infinity. Used by tests. */
  maxRuntimeSec?: number
}

interface WatchEvent {
  kind: "started" | "ready" | "fs-event" | "scanned" | "shutdown" | "warning"
  timestamp: string
  payload?: unknown
}

/** Top-level dispatch for `phub watch`. Returns process exit code. */
export async function watchCommand(
  rootArg: string | undefined,
  opts: WatchOptions,
): Promise<number> {
  const root = resolve(rootArg ?? process.cwd())
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    process.stderr.write(`phub watch: root must be an existing directory: ${root}\n`)
    return 2
  }

  // Initial audit. Same shape as `phub audit` — reuse runAudit so policy
  // and lock handling are guaranteed to match. (ADR-0027 § "no parallel
  // logic" rule.)
  const auditOpts: AuditOptions = {
    json: opts.json,
    sarif: false,
    strict: opts.strict,
    detectors: opts.detectors ?? [],
    allowFailFor: opts.allowFail ?? [],
    maxFiles: opts.maxFiles,
    maxDepth: opts.maxDepth,
  }
  if (opts.policyPath !== undefined) auditOpts.policyPath = opts.policyPath

  let initial: AuditResult
  try {
    initial = runAudit(root, auditOpts)
  } catch (err) {
    if (err instanceof PolicyLoadError) {
      process.stderr.write(`phub watch: invalid policy at ${err.source}: ${err.message}\n`)
      return 2
    }
    throw err
  }

  emit(opts, {
    kind: "started",
    timestamp: nowIso(),
    payload: {
      root,
      mode: opts.once ? "once" : "daemon",
      policySource: initial.policySource,
      artifactCount: initial.artifacts.length,
      flaggedCount: initial.summary.flaggedArtifacts,
    },
  })

  if (opts.once) {
    return initial.exitCode
  }

  // Daemon mode.
  const exitCode = await runDaemon(root, opts, auditOpts)
  return exitCode
}

async function runDaemon(
  root: string,
  opts: WatchOptions,
  auditOpts: AuditOptions,
): Promise<number> {
  let watcher: Watcher | null = null
  let stopping = false
  let exitCode: 0 | 1 = 0

  const stopAll = (): void => {
    if (stopping) return
    stopping = true
    if (watcher !== null) watcher.stop()
  }

  watcher = startWatcher(root, {
    debounceMs: opts.debounceMs,
    onEvent: (event) => {
      if (stopping) return
      emit(opts, { kind: "fs-event", timestamp: event.timestamp, payload: event })

      // Re-audit the whole tree on each event. v0.1 keeps this simple
      // and correct; v0.2 may incrementalize by classifying only the
      // changed path. The audit walker caps at maxFiles + maxDepth so
      // it stays bounded.
      let result: AuditResult
      try {
        result = runAudit(root, auditOpts)
      } catch (err) {
        emit(opts, {
          kind: "warning",
          timestamp: nowIso(),
          payload: { message: err instanceof Error ? err.message : String(err) },
        })
        return
      }

      emit(opts, {
        kind: "scanned",
        timestamp: nowIso(),
        payload: {
          flaggedCount: result.summary.flaggedArtifacts,
          totalFindings: result.summary.totalFindings,
          // Just the flagged artifacts on the wire — full inventory
          // would flood stdout.
          flagged: result.artifacts
            .filter((a) => a.flagged)
            .map((a) => ({
              path: a.path,
              classification: a.classification,
              digest: a.digest,
              verdicts: a.adjustedVerdicts
                .filter((adj) => adj.verdict.severity === Severity.FAIL && !adj.verdict.passed)
                .map((adj) => ({
                  cciId: adj.verdict.cciId,
                  severity: adj.verdict.severity,
                  summary: adj.verdict.summary,
                })),
            })),
        },
      })

      if (result.exitCode === 1) exitCode = 1
    },
    onError: (err) => {
      emit(opts, {
        kind: "warning",
        timestamp: nowIso(),
        payload: { message: `watcher: ${err.message}` },
      })
    },
  })

  emit(opts, {
    kind: "ready",
    timestamp: nowIso(),
    payload: { debounceMs: opts.debounceMs, quarantine: opts.quarantine },
  })

  const shutdown = (signal: string): void => {
    stopAll()
    emit(opts, {
      kind: "shutdown",
      timestamp: nowIso(),
      payload: { signal, exitCode },
    })
  }

  process.once("SIGINT", () => {
    shutdown("SIGINT")
    process.exit(exitCode)
  })
  process.once("SIGTERM", () => {
    shutdown("SIGTERM")
    process.exit(exitCode)
  })

  await new Promise<void>((resolveDone) => {
    if (opts.maxRuntimeSec !== undefined && opts.maxRuntimeSec > 0) {
      const timer = setTimeout(() => {
        shutdown(`max-runtime-${opts.maxRuntimeSec}s`)
        resolveDone()
      }, opts.maxRuntimeSec * 1000)
      timer.unref()
    }
    // Otherwise: block forever; only signal handlers cause exit.
  })

  return exitCode
}

/** Emit a single event. Daemon mode → NDJSON; otherwise human-readable. */
function emit(opts: WatchOptions, event: WatchEvent): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(event) + "\n")
    return
  }
  switch (event.kind) {
    case "started": {
      const p = event.payload as Record<string, unknown>
      process.stdout.write(
        `[watch] root=${p["root"]} mode=${p["mode"]} policy=${p["policySource"]} artifacts=${p["artifactCount"]} flagged=${p["flaggedCount"]}\n`,
      )
      return
    }
    case "ready": {
      const p = event.payload as Record<string, unknown>
      process.stdout.write(`[watch] ready (debounce=${p["debounceMs"]}ms)\n`)
      return
    }
    case "fs-event": {
      const p = event.payload as { path: string; rawKind: string }
      process.stdout.write(`[watch] ${p.rawKind}: ${p.path}\n`)
      return
    }
    case "scanned": {
      const p = event.payload as { flaggedCount: number; totalFindings: number }
      process.stdout.write(
        `[watch] scanned: ${p.flaggedCount} flagged artifact(s), ${p.totalFindings} finding(s)\n`,
      )
      return
    }
    case "warning": {
      const p = event.payload as { message: string }
      process.stderr.write(`[watch] WARN: ${p.message}\n`)
      return
    }
    case "shutdown": {
      const p = event.payload as { signal: string }
      process.stdout.write(`[watch] shutdown (${p.signal})\n`)
      return
    }
  }
}

function nowIso(): string {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return new Date(Date.now()).toISOString()
}
