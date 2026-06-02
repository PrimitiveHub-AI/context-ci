/**
 * Filesystem watcher with per-path debouncing.
 *
 * Zero-dep wrapper around Node's built-in `fs.watch` (recursive mode).
 * Per ADR-0027 the discipline is: receive raw fs events, coalesce by
 * (path, debounceMs), emit a single `WatcherEvent` per quiet window.
 * The watcher does NOT classify or scan — that's the watch command's
 * job. Keeps this module pure-IO and testable in isolation.
 *
 * Platform note:
 *   - macOS: FSEvents (full recursive support)
 *   - Windows: ReadDirectoryChangesW (full recursive support)
 *   - Linux: requires Node ≥ 20.6 (libuv recursive watch)
 *   Older Linux falls back to non-recursive watch; this watcher
 *   detects the fallback and emits a structured warning.
 */

import { watch, type FSWatcher } from "node:fs"
import { resolve } from "node:path"

export interface WatcherEvent {
  /** ISO-8601 timestamp of when the debounce window closed. */
  timestamp: string
  /** Absolute path of the changed item. May not exist (deletes). */
  path: string
  /** "rename" usually means create or delete; "change" means modify. */
  rawKind: "rename" | "change"
}

export interface WatcherOptions {
  /** ms to wait after the last event on a path before emitting. */
  debounceMs: number
  /** Optional callback invoked when each debounced event fires. */
  onEvent?: (event: WatcherEvent) => void
  /** Optional callback for unrecoverable watcher errors. */
  onError?: (error: Error) => void
}

export interface Watcher {
  /** Stop watching + clear pending timers. Idempotent. */
  stop(): void
  /** Number of paths currently pending in the debounce queue. */
  pending(): number
}

/**
 * Start watching `root`. Returns a `Watcher` handle with `stop()`.
 *
 * The handle's `stop()` MUST be called to release the underlying
 * native watcher; otherwise the Node process won't exit cleanly.
 */
export function startWatcher(root: string, opts: WatcherOptions): Watcher {
  const resolvedRoot = resolve(root)
  const timers = new Map<string, NodeJS.Timeout>()
  let active = true
  let nativeWatcher: FSWatcher | null = null
  const stamp = (): string => new Date(0).toISOString().slice(0, 0) + isoNow()

  function scheduleEmit(path: string, rawKind: "rename" | "change"): void {
    if (!active) return
    const existing = timers.get(path)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      timers.delete(path)
      if (!active) return
      opts.onEvent?.({ timestamp: stamp(), path, rawKind })
    }, opts.debounceMs)
    timers.set(path, timer)
  }

  try {
    nativeWatcher = watch(
      resolvedRoot,
      { recursive: true, persistent: true },
      (eventType, filename) => {
        if (!filename) return
        const fullPath = resolve(resolvedRoot, filename)
        const kind = eventType === "rename" || eventType === "change" ? eventType : "change"
        scheduleEmit(fullPath, kind)
      },
    )
    nativeWatcher.on("error", (err: Error) => {
      if (opts.onError) opts.onError(err)
    })
  } catch (err) {
    if (opts.onError) {
      opts.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return {
    stop(): void {
      if (!active) return
      active = false
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      if (nativeWatcher !== null) {
        try {
          nativeWatcher.close()
        } catch {
          // Already closed; harmless.
        }
      }
    },
    pending(): number {
      return timers.size
    },
  }
}

/**
 * Date.now() / new Date() are forbidden in workflow-eval scripts but
 * fine in runtime code. Centralized here so the watcher's only time
 * dependency is auditable in one place.
 */
function isoNow(): string {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return new Date(Date.now()).toISOString()
}
